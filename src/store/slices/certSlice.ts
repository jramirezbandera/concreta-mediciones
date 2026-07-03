/* ===========================================================================
   store/slices/certSlice — acciones de certificación (F-04).
   ---------------------------------------------------------------------------
   Extraído de `obraStore` (F-04): edición de cantidades a origen / por línea,
   creación y campos de cert, contradictorios y ajustes del resumen. La lógica
   es idéntica a la del store monolítico; solo cambia de fichero.
   =========================================================================== */
import type { Cert, PartidasMap, Rates } from '../../core/types';
import { estaCertToOrigen, prevDataOf, sumLineQty } from '../../core/certificacion';
import { round2 } from '../../core/money';
import { nextAjusteId, nextExtraId } from '../base';
import type { ObraSlice, ObraState } from '../obraStore';

/**
 * F7.0: congela en la cert el precio unitario VIGENTE de la partida al
 * certificarla (espeja `Cert.lineQty`, que congela la cantidad al marcar): el
 * precio que el usuario ve al certificar es el que queda en el documento;
 * editar después el presupuesto (recurso/precio/K) ya no lo reescribe. Sólo
 * congela la primera vez (el snapshot no se refresca); el K se congela con el
 * primer precio. `snapshotAt` estampa el último congelado (trazabilidad F7.1).
 */
function freezePrecio(
  partidas: PartidasMap,
  rates: Rates,
  cert: Cert,
  partidaId: string,
): void {
  if (cert.priceSnapshot?.[partidaId] != null) return;
  for (const chId in partidas) {
    const p = partidas[chId]?.find((x) => x.id === partidaId);
    if (!p) continue;
    (cert.priceSnapshot ??= {})[partidaId] = p.precio;
    cert.coefK ??= rates.coefK;
    cert.snapshotAt = new Date().toISOString();
    return;
  }
}

type CertSlice = Pick<
  ObraState,
  | 'onCertEdit'
  | 'setCertLine'
  | 'addCert'
  | 'setCertField'
  | 'addContradictorio'
  | 'editContradictorio'
  | 'deleteContradictorio'
  | 'addAjuste'
  | 'editAjuste'
  | 'deleteAjuste'
>;

export const createCertSlice: ObraSlice<CertSlice> = (set) => ({
  onCertEdit: (partidaId, value, mode) =>
    set((s) => {
      const cert = s.certs[s.curCert];
      if (!cert) return;
      if (mode === 'esta') {
        const prev = prevDataOf(s.certs, s.curCert)[partidaId] ?? 0;
        cert.data[partidaId] = estaCertToOrigen(prev, value);
      } else {
        // A origen: desviación CONSCIENTE del prototipo (que guardaba v crudo).
        // La cantidad ejecutada no puede ser negativa; round2 = 2 decimales,
        // consistente con `estaCertToOrigen` y con el seed (`makeCertsInit`),
        // que también redondean la cantidad a origen.
        cert.data[partidaId] = round2(Math.max(0, value));
      }
      // Teclear una cantidad/% es un override del total: deja de certificarse
      // por líneas (regresión §8a). Si no quedan líneas marcadas en la cert,
      // limpia el contenedor para no dejar `{}` huérfanos.
      if (cert.lineQty?.[partidaId]) {
        delete cert.lineQty[partidaId];
        if (Object.keys(cert.lineQty).length === 0) cert.lineQty = undefined;
      }
      freezePrecio(s.partidas, s.rates, cert, partidaId); // F7.0
    }),

  setCertLine: (partidaId, lineId, qty) =>
    set((s) => {
      const cert = s.certs[s.curCert];
      if (!cert) return;
      const lineQty = (cert.lineQty ??= {});
      const lines = (lineQty[partidaId] ??= {});
      if (qty == null || qty <= 0) {
        delete lines[lineId];
      } else {
        lines[lineId] = round2(qty);
      }
      // D-06 (suelo = lo ya certificado): si la cert ANTERIOR certificó esta
      // partida a mano (grueso, sin líneas), marcar las primeras líneas aquí
      // REEMPLAZABA el a-origen heredado por la Σ de líneas → cert negativa
      // sin querer. Marcar/desmarcar nunca baja del anterior; certificar en
      // negativo sigue siendo posible, pero solo TECLEANDO la cantidad.
      const anterior = prevDataOf(s.certs, s.curCert)[partidaId] ?? 0;
      if (Object.keys(lines).length === 0) {
        // Sin líneas marcadas: la partida deja de certificarse por líneas.
        delete lineQty[partidaId];
        if (anterior > 0) {
          cert.data[partidaId] = anterior; // el suelo también al desmarcar todo
          freezePrecio(s.partidas, s.rates, cert, partidaId); // F7.0
        } else {
          delete cert.data[partidaId];
        }
        if (Object.keys(lineQty).length === 0) cert.lineQty = undefined;
      } else {
        cert.data[partidaId] = Math.max(sumLineQty(lines), anterior);
        freezePrecio(s.partidas, s.rates, cert, partidaId); // F7.0
      }
    }),

  addCert: () =>
    set((s) => {
      const last = s.certs.at(-1);
      const num = (last?.num ?? 0) + 1;
      // Clonado superficial por nivel (no `structuredClone`: los valores son
      // drafts de Immer y el proxy no es clonable). data es plano; lineQty
      // tiene un nivel de anidación.
      const data: Record<string, number> = { ...(last?.data ?? {}) };
      let lineQty: Record<string, Record<string, number>> | undefined;
      if (last?.lineQty) {
        lineQty = {};
        for (const pid in last.lineQty) lineQty[pid] = { ...last.lineQty[pid] };
      }
      // Los contradictorios se heredan a-origen (mismo id → "anterior" cuadra).
      const extras = last?.extras?.map((e) => ({ ...e }));
      // Ajustes: solo los recurrentes (pago adelantado, retención extra…), con
      // id nuevo por cert (no tienen enlace inter-cert, a diferencia de extras).
      // Los puntuales (una corrección de una cert concreta) NO se arrastran.
      const recurrentes = last?.ajustes
        ?.filter((a) => a.recurrente)
        .map((a) => ({ ...a, id: nextAjusteId() }));
      const ajustes = recurrentes && recurrentes.length > 0 ? recurrentes : undefined;
      // F7.0: la cert nace con TODOS los precios congelados ("hereda/congela").
      // Hereda los de la última cert (así su "anterior" reproduce al céntimo lo
      // ya certificado) y congela al precio vivo los que falten (partidas nuevas
      // o última cert legada sin snapshot). El K congelado se hereda igual.
      const precios: Record<string, number> = {};
      for (const chId in s.partidas)
        for (const p of s.partidas[chId] ?? [])
          precios[p.id] = last?.priceSnapshot?.[p.id] ?? p.precio;
      s.certs.push({
        id: `c${num}`,
        num,
        period: '',
        retencion: last?.retencion ?? 0,
        data,
        lineQty,
        extras,
        ajustes,
        priceSnapshot: precios,
        coefK: last?.coefK ?? s.rates.coefK,
        snapshotAt: new Date().toISOString(),
      });
      s.curCert = s.certs.length - 1;
    }),

  setCertField: (field, value) =>
    set((s) => {
      const cert = s.certs[s.curCert];
      if (!cert) return;
      if (field === 'period') {
        if (typeof value === 'string') cert.period = value;
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        cert.retencion = Math.min(1, Math.max(0, value)); // retención ∈ [0,1]
      }
    }),

  addContradictorio: (chapterId) =>
    set((s) => {
      const cert = s.certs[s.curCert];
      if (!cert) return;
      const extras = (cert.extras ??= []);
      const n = extras.filter((e) => e.chapterId === chapterId).length + 1;
      extras.push({
        id: nextExtraId(),
        chapterId,
        pos: `C${n}`,
        title: '',
        ud: '',
        cantidad: 0,
        precio: 0,
      });
    }),

  editContradictorio: (extraId, field, value) =>
    set((s) => {
      const e = s.certs[s.curCert]?.extras?.find((x) => x.id === extraId);
      if (!e) return;
      if (field === 'title' || field === 'ud') {
        if (typeof value === 'string') e[field] = value;
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        // cantidad/precio no pueden ser negativos; cantidad a 2 dec, precio
        // (dinero) a 2 dec también (coherente con el banco de precios).
        e[field] = round2(Math.max(0, value));
      }
    }),

  deleteContradictorio: (extraId) =>
    set((s) => {
      const cert = s.certs[s.curCert];
      if (!cert?.extras) return;
      cert.extras = cert.extras.filter((e) => e.id !== extraId);
      if (cert.extras.length === 0) cert.extras = undefined;
    }),

  addAjuste: () =>
    set((s) => {
      const cert = s.certs[s.curCert];
      if (!cert) return;
      const ajustes = (cert.ajustes ??= []);
      // Por defecto: descuento fijo puntual (el caso más común: una corrección).
      ajustes.push({
        id: nextAjusteId(),
        concepto: '',
        tipo: 'fijo',
        valor: 0,
        signo: -1,
        recurrente: false,
      });
    }),

  editAjuste: (id, field, value) =>
    set((s) => {
      const a = s.certs[s.curCert]?.ajustes?.find((x) => x.id === id);
      if (!a) return;
      if (field === 'concepto') {
        if (typeof value === 'string') a.concepto = value;
      } else if (field === 'tipo') {
        if ((value === 'pct' || value === 'fijo') && value !== a.tipo) {
          a.tipo = value;
          a.valor = 0; // fracción ⇄ euros no son intercambiables → resetear
        }
      } else if (field === 'signo') {
        if (value === -1 || value === 1) a.signo = value;
      } else if (field === 'recurrente') {
        if (typeof value === 'boolean') a.recurrente = value;
      } else if (field === 'valor') {
        if (typeof value === 'number' && Number.isFinite(value)) {
          a.valor = a.tipo === 'pct' ? Math.min(1, Math.max(0, value)) : round2(Math.max(0, value));
        }
      }
    }),

  deleteAjuste: (id) =>
    set((s) => {
      const cert = s.certs[s.curCert];
      if (!cert?.ajustes) return;
      cert.ajustes = cert.ajustes.filter((a) => a.id !== id);
      if (cert.ajustes.length === 0) cert.ajustes = undefined;
    }),
});

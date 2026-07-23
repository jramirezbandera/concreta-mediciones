/* ===========================================================================
   store/slices/certSlice — acciones de certificación (F-04).
   ---------------------------------------------------------------------------
   Extraído de `obraStore` (F-04): edición de cantidades a origen / por línea,
   creación y campos de cert, contradictorios y ajustes del resumen. La lógica
   es idéntica a la del store monolítico; solo cambia de fichero.
   =========================================================================== */
import type { Cert, Partida, PartidasMap, Rates } from '../../core/types';
import { ajusteEsRetencion, estaCertToOrigen, prevDataOf, sumLineQty } from '../../core/certificacion';
import { findPartidaById } from '../../core/tree';
import { lineParcial, partidaCantidad } from '../../core/medicion';
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
function freezePrecioFor(cert: Cert, rates: Rates, p: Partida): void {
  if (cert.priceSnapshot?.[p.id] != null) return;
  (cert.priceSnapshot ??= {})[p.id] = p.precio;
  cert.coefK ??= rates.coefK;
  cert.snapshotAt = new Date().toISOString();
}

/** Variante que resuelve la partida por id (escaneo O(capítulos)); para el caso
 *  de una sola partida. Las acciones masivas usan `freezePrecioFor` con la `p`
 *  del bucle para no reescanear (design review D2 / eng review Issue 1). */
function freezePrecio(partidas: PartidasMap, rates: Rates, cert: Cert, partidaId: string): void {
  if (cert.priceSnapshot?.[partidaId] != null) return;
  const p = findPartida(partidas, partidaId);
  if (p) freezePrecioFor(cert, rates, p);
}

/** Último % de retención usado en la obra (fracción 0..1), de la cert más
 *  reciente que lo tenga: prioriza el ajuste-retención (%) y cae al `Cert.retencion`
 *  legacy. `undefined` si nunca se usó → el preset arranca en el 5% estándar. */
function lastRetencionRate(s: ObraState): number | undefined {
  for (let i = s.certs.length - 1; i >= 0; i--) {
    const c = s.certs[i];
    if (!c) continue;
    const ret = c.ajustes?.find((a) => ajusteEsRetencion(a) && a.tipo === 'pct');
    if (ret) return ret.valor;
    if (c.retencion > 0) return c.retencion;
  }
  return undefined;
}

/** Resuelve una partida por id (delega en el resolvedor compartido `core/tree`,
 *  única implementación tras el refactor T6 de F-A3). */
function findPartida(partidas: PartidasMap, id: string): Partida | undefined {
  return findPartidaById(partidas, id)?.partida;
}

/** Quita la certificación por líneas de una partida y limpia el contenedor
 *  `lineQty` si queda vacío (convención de `setCertLine`). Un solo sitio para
 *  esta regla, compartido por onCertEdit/setCertLine/completar (eng review Issue 2). */
function dropLineQty(cert: Cert, partidaId: string): void {
  if (!cert.lineQty?.[partidaId]) return;
  delete cert.lineQty[partidaId];
  if (Object.keys(cert.lineQty).length === 0) cert.lineQty = undefined;
}

/**
 * Lleva una partida al 100% a origen en la cert en curso, SIN reducir (design
 * review / eng review Issue 3): `data = max(actual, ofertada, prev)`. Respeta el
 * suelo D-06 (`prev`) y conserva un sobre-tecleo del periodo. `ofertada<=0` →
 * no-op (no hay 100% definible). Mutador PURO sobre el draft: las acciones
 * masivas lo ejecutan dentro de UN solo `set` (no N `onCertEdit`).
 *
 * Si la partida tiene MEDICIÓN, completar equivale a marcar TODAS sus líneas al
 * parcial a-origen (no a soltar `lineQty`): así el desplegable queda
 * sincronizado —todas las casillas marcadas— con el 100% de la partida. Antes se
 * soltaba `lineQty` y el detalle mostraba las líneas SIN marcar pese a estar la
 * partida completa (desconcertante en obra). Como Σ de parciales = ofertada, el
 * a-origen sale idéntico; el `max` conserva el suelo y un sobre-tecleo previo.
 */
function completeDraft(s: ObraState, p: Partida): void {
  const cert = s.certs[s.curCert];
  if (!cert) return;
  const ofertada = partidaCantidad(p);
  if (ofertada <= 0) return;
  const prev = prevDataOf(s.certs, s.curCert)[p.id] ?? 0;
  const current = cert.data[p.id] ?? 0;
  const med = p.med ?? [];
  if (med.length > 0) {
    // Marca cada línea a su parcial (>0; una línea de parcial 0 no se certifica,
    // como en `setCertLine`). ofertada>0 garantiza ≥1 parcial positivo.
    const lines: Record<string, number> = {};
    for (const l of med) {
      const parcial = lineParcial(l);
      if (parcial > 0) lines[l.id] = parcial;
    }
    (cert.lineQty ??= {})[p.id] = lines;
    cert.data[p.id] = round2(Math.max(sumLineQty(lines), current, prev));
  } else {
    cert.data[p.id] = round2(Math.max(current, ofertada, prev));
    dropLineQty(cert, p.id);
  }
  freezePrecioFor(cert, s.rates, p);
}

type CertSlice = Pick<
  ObraState,
  | 'onCertEdit'
  | 'setCertLine'
  | 'completePartida'
  | 'uncompletePartida'
  | 'completePartidas'
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
      // por líneas (regresión §8a) y limpia el contenedor si queda vacío.
      dropLineQty(cert, partidaId);
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
        dropLineQty(cert, partidaId);
        if (anterior > 0) {
          cert.data[partidaId] = anterior; // el suelo también al desmarcar todo
          freezePrecio(s.partidas, s.rates, cert, partidaId); // F7.0
        } else {
          delete cert.data[partidaId];
        }
      } else {
        cert.data[partidaId] = Math.max(sumLineQty(lines), anterior);
        freezePrecio(s.partidas, s.rates, cert, partidaId); // F7.0
      }
    }),

  completePartida: (partidaId) =>
    set((s) => {
      const p = findPartida(s.partidas, partidaId);
      if (p) completeDraft(s, p);
    }),

  uncompletePartida: (partidaId) =>
    set((s) => {
      const cert = s.certs[s.curCert];
      if (!cert) return;
      // Descompletar = volver al a-origen del periodo anterior (suelo D-06), no
      // a 0 a origen (no borrar lo ya certificado). prev==0 → borra la entrada.
      const prev = prevDataOf(s.certs, s.curCert)[partidaId] ?? 0;
      if (prev > 0) {
        cert.data[partidaId] = prev;
        const p = findPartida(s.partidas, partidaId);
        if (p) freezePrecioFor(cert, s.rates, p);
      } else {
        delete cert.data[partidaId];
      }
      dropLineQty(cert, partidaId);
    }),

  completePartidas: (partidaIds) =>
    set((s) => {
      // Masiva WYSIWYG (eng review Issue 5): la UI pasa EXACTAMENTE las partidas
      // visibles (obra / capítulo / lo visible). UN solo `set` (no N onCertEdit →
      // N autosaves): mapa id→p una vez (O(N)) y `completeDraft` con la p resuelta.
      const map = new Map<string, Partida>();
      for (const chId in s.partidas) for (const p of s.partidas[chId] ?? []) map.set(p.id, p);
      for (const id of partidaIds) {
        const p = map.get(id);
        if (p) completeDraft(s, p);
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

  addAjuste: (preset) =>
    set((s) => {
      const cert = s.certs[s.curCert];
      if (!cert) return;
      const ajustes = (cert.ajustes ??= []);
      if (preset === 'retencion') {
        // Retención de garantía predefinida: % recurrente (se hereda cert a cert)
        // que RESTA. Precarga el último % de retención usado en la obra (ajuste o
        // legacy) o el 5% estándar (obra privada / LCSP) si es la primera vez.
        ajustes.push({
          id: nextAjusteId(),
          concepto: 'Retención garantía',
          tipo: 'pct',
          valor: lastRetencionRate(s) ?? 0.05,
          signo: -1,
          recurrente: true,
          preset: 'retencion',
        });
        return;
      }
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

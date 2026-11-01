/* ===========================================================================
   store/slices/certSlice — acciones de certificación (F-04).
   ---------------------------------------------------------------------------
   Extraído de `obraStore` (F-04): edición de cantidades a origen / por línea,
   creación y campos de cert, contradictorios y ajustes del resumen. La lógica
   es idéntica a la del store monolítico; solo cambia de fichero.
   =========================================================================== */
import type { Cert, MedLine, Partida, PartidasMap, Rates } from '../../core/types';
import { ajusteEsRetencion, estaCertToOrigen, prevDataOf, sumLineQty } from '../../core/certificacion';
import { findPartidaById } from '../../core/tree';
import { lineParcial, partidaCantidad } from '../../core/medicion';
import { round2 } from '../../core/money';
import { nextAjusteId, nextExtraId } from '../base';
import type { ObraSlice, ObraState } from '../obraStore';
import { composeCertFirmantes, firmaCertDefinitiva } from '../../core/listado';
import { useToastStore } from '../toastStore';
import { structural } from './estructuraSlice';

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
  if (cert.lineSnap?.[partidaId]) {
    delete cert.lineSnap[partidaId];
    if (Object.keys(cert.lineSnap).length === 0) cert.lineSnap = undefined;
  }
  if (!cert.lineQty?.[partidaId]) return;
  delete cert.lineQty[partidaId];
  if (Object.keys(cert.lineQty).length === 0) cert.lineQty = undefined;
}

/** Congela qué era la línea al certificarla (v12, `Cert.lineSnap`). */
function snapLinea(cert: Cert, partidaId: string, l: MedLine): void {
  ((cert.lineSnap ??= {})[partidaId] ??= {})[l.id] = { comment: l.comment, dims: [l.uds, l.largo, l.ancho, l.alto] };
}

/** Suelta el congelado de una línea desmarcada (y los contenedores vacíos). */
function dropSnapLinea(cert: Cert, partidaId: string, lineId: string): void {
  const lines = cert.lineSnap?.[partidaId];
  if (!lines) return;
  delete lines[lineId];
  if (Object.keys(lines).length === 0) delete cert.lineSnap![partidaId];
  if (Object.keys(cert.lineSnap!).length === 0) cert.lineSnap = undefined;
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
  if (!cert || cert.cerradas?.[p.id]) return; // cerrada: su cantidad no se toca
  const ofertada = partidaCantidad(p);
  if (ofertada <= 0) return;
  const prev = prevDataOf(s.certs, s.curCert)[p.id] ?? 0;
  const current = cert.data[p.id] ?? 0;
  const med = p.med ?? [];
  if (med.length > 0) {
    // Marca cada línea a su parcial CON SIGNO (E12): un hueco medido con Restar
    // (parcial < 0) se certifica también, así +100 y −10 certifican 90. Solo la
    // de parcial 0 se queda sin marcar, como en `setCertLine`.
    const lines: Record<string, number> = {};
    if (cert.lineSnap?.[p.id]) delete cert.lineSnap[p.id];
    for (const l of med) {
      const parcial = lineParcial(l);
      if (parcial !== 0) {
        lines[l.id] = parcial;
        snapLinea(cert, p.id, l);
      }
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
  | 'emitirCert'
  | 'reabrirCert'
  | 'setCertField'
  | 'addContradictorio'
  | 'editContradictorio'
  | 'deleteContradictorio'
  | 'toggleCerrada'
  | 'addAjuste'
  | 'editAjuste'
  | 'deleteAjuste'
>;

/** Aviso al intentar cambiar una cert emitida (T-2). */
function avisarEmitida(num: number): void {
  useToastStore.getState().show(`La certificación nº ${num} está emitida: reábrela para cambiarla.`, undefined, { tone: 'warn' });
}

export const createCertSlice: ObraSlice<CertSlice> = (set, get) => {
  /** Edición de la cert EN CURSO: si está emitida no cambia nada y lo avisa (T-2). */
  const editar = (fn: (s: ObraState) => void): void => {
    const { certs, curCert } = get();
    const cert = certs[curCert];
    if (cert?.emitidaAt) {
      avisarEmitida(cert.num);
      return;
    }
    set(fn);
  };
  return {
    onCertEdit: (partidaId, value, mode) =>
      editar((s) => {
        const cert = s.certs[s.curCert];
        // Partida cerrada: la cantidad queda bloqueada hasta reabrirla.
        if (!cert || cert.cerradas?.[partidaId]) return;
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
      editar((s) => {
        const cert = s.certs[s.curCert];
        if (!cert || cert.cerradas?.[partidaId]) return;
        const lineQty = (cert.lineQty ??= {});
        const lines = (lineQty[partidaId] ??= {});
        // E12: una línea negativa (Restar) se certifica con su cantidad negativa;
        // solo el 0 desmarca.
        if (qty == null || qty === 0 || !Number.isFinite(qty)) {
          delete lines[lineId];
          dropSnapLinea(cert, partidaId, lineId);
        } else {
          lines[lineId] = round2(qty);
          const l = findPartida(s.partidas, partidaId)?.med.find((x) => x.id === lineId);
          if (l) snapLinea(cert, partidaId, l);
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
      editar((s) => {
        const p = findPartida(s.partidas, partidaId);
        if (p) completeDraft(s, p);
      }),

    uncompletePartida: (partidaId) =>
      editar((s) => {
        const cert = s.certs[s.curCert];
        if (!cert || cert.cerradas?.[partidaId]) return;
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
      editar((s) => {
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
        // Lo que era cada línea viaja con su cantidad (v12): dos niveles, valores planos.
        let lineSnap: Cert['lineSnap'];
        if (last?.lineSnap) {
          lineSnap = {};
          for (const pid in last.lineSnap) {
            lineSnap[pid] = {};
            for (const lid in last.lineSnap[pid]) {
              const x = last.lineSnap[pid]![lid]!;
              lineSnap[pid]![lid] = { comment: x.comment, dims: [...x.dims] };
            }
          }
        }
        // Los contradictorios se heredan a-origen (mismo id → "anterior" cuadra).
        const extras = last?.extras?.map((e) => ({ ...e }));
        // Las partidas cerradas siguen cerradas (lo que no se ejecuta no vuelve solo).
        const cerradas = last?.cerradas ? { ...last.cerradas } : undefined;
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
          lineSnap,
          extras,
          cerradas,
          ajustes,
          priceSnapshot: precios,
          coefK: last?.coefK ?? s.rates.coefK,
          snapshotAt: new Date().toISOString(),
        });
        s.curCert = s.certs.length - 1;
      }),

    setCertField: (field, value) =>
      editar((s) => {
        const cert = s.certs[s.curCert];
        if (!cert) return;
        if (field === 'period') {
          if (typeof value === 'string') cert.period = value;
        } else if (typeof value === 'number' && Number.isFinite(value)) {
          cert.retencion = Math.min(1, Math.max(0, value)); // retención ∈ [0,1]
        }
      }),

    addContradictorio: (chapterId) =>
      editar((s) => {
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
      editar((s) => {
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
      editar((s) => {
        const cert = s.certs[s.curCert];
        if (!cert?.extras) return;
        cert.extras = cert.extras.filter((e) => e.id !== extraId);
        if (cert.extras.length === 0) cert.extras = undefined;
      }),

    toggleCerrada: (partidaId) =>
      editar((s) => {
        const cert = s.certs[s.curCert];
        if (!cert) return;
        if (cert.cerradas?.[partidaId]) {
          delete cert.cerradas[partidaId];
          if (Object.keys(cert.cerradas).length === 0) cert.cerradas = undefined;
        } else {
          (cert.cerradas ??= {})[partidaId] = true;
        }
      }),

    addAjuste: (preset) =>
      editar((s) => {
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
      editar((s) => {
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
      editar((s) => {
        const cert = s.certs[s.curCert];
        if (!cert?.ajustes) return;
        cert.ajustes = cert.ajustes.filter((a) => a.id !== id);
        if (cert.ajustes.length === 0) cert.ajustes = undefined;
      }),

    emitirCert: (index) => {
      const s0 = get();
      const c = s0.certs[index];
      // En orden: no se emite la nº 3 con la nº 2 en borrador (su «anterior» podría cambiar).
      if (!c || c.emitidaAt || s0.certs.slice(0, index).some((x) => !x.emitidaAt)) return false;
      structural(() =>
        set((s) => {
          const cert = s.certs[index]!;
          const fecha = new Date().toISOString();
          // Precios: los que aún se leían en vivo (cert legada o partida añadida
          // después) se congelan ahora al precio vivo, que es con el que se
          // valoraba: la emisión no mueve ningún importe.
          const precios = (cert.priceSnapshot ??= {});
          for (const ps of Object.values(s.partidas)) for (const p of ps ?? []) precios[p.id] ??= p.precio;
          cert.coefK ??= s.rates.coefK;
          cert.snapshotAt ??= fecha;
          // Firma: la que haya ahora, aunque sea provisional (la emitida no se re-sella).
          if (!firmaCertDefinitiva(cert.firmantesSnapshot)) {
            cert.firmantesSnapshot = composeCertFirmantes(s.obra);
            cert.firmadoAt = fecha;
          }
          cert.emitidaAt = fecha;
          (cert.historial ??= []).push({ accion: 'emitida', fecha });
        }),
      );
      return true;
    },

    reabrirCert: (index) => {
      const s0 = get();
      const c = s0.certs[index];
      // Solo la última emitida: reabrir una del medio cambiaría el «anterior» de las emitidas después.
      if (!c?.emitidaAt || s0.certs[index + 1]?.emitidaAt) return false;
      structural(() =>
        set((s) => {
          const cert = s.certs[index]!;
          delete cert.emitidaAt;
          (cert.historial ??= []).push({ accion: 'reabierta', fecha: new Date().toISOString() });
        }),
      );
      return true;
    },
  };
};

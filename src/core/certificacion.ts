/* ===========================================================================
   core/certificacion — cálculo de certificaciones de obra (port de
   certificaciones.jsx). Doble semántica "a origen" / "esta certificación".
   Importes en CÉNTIMOS. El coeficiente K (§4) se aplica al precio, igual que
   en el presupuesto.
   =========================================================================== */
import type { Ajuste, Cert, CertExtra, Chapter, Partida, PartidaBaja, PartidasMap, Rates } from './types';
import { type Cents, importeCents, round2, scaleCents, sumCents, toCents } from './money';
import { partidaCantidad, partidaImporte } from './medicion';

export interface CertRow {
  ofertada: number; // cantidad presupuestada
  ejecutada: number; // cantidad ejecutada A ORIGEN (curData)
  prev: number; // cantidad ejecutada en la certificación anterior
  pct: number; // % ejecución = ejecutada / ofertada · 100
  aOrigen: Cents; // importe a origen
  anterior: Cents; // importe certificado hasta la anterior
  estaCert: Cents; // importe de esta certificación = aOrigen − anterior
}

/* ---- Snapshot de precios (F7.0) --------------------------------------------
   Este módulo leía `p.precio` EN VIVO: editar un recurso/precio/K reescribía
   importes ya certificados (residuo de precio de T-2). La cert congela el
   precio unitario (y el K) al certificar (`Cert.priceSnapshot`/`Cert.coefK`);
   aquí se VALORA con lo congelado si existe, en vivo si no (certs legadas). */

/** Precios congelados de una cert: euros SIN K por partida + K congelado. */
export interface CertSnapshot {
  precios: Record<string, number>;
  coefK: number;
}

/** Snapshot con el que valorar una cert (`undefined` si es legada → en vivo).
 *  `liveCoefK` = fallback si la cert congeló precios pero no K (defensivo). */
export function certSnapshotOf(
  cert: Pick<Cert, 'priceSnapshot' | 'coefK'> | undefined,
  liveCoefK = 1,
): CertSnapshot | undefined {
  if (!cert?.priceSnapshot) return undefined;
  return { precios: cert.priceSnapshot, coefK: cert.coefK ?? liveCoefK };
}

/** Precio unitario efectivo (euros) con el que la cert valora la partida:
 *  congelado × K congelado si está en el snapshot; vivo × K vivo si no
 *  (partida añadida al presupuesto después de congelar, o cert legada). */
export function certPrecioK(p: Partida, coefK = 1, snap?: CertSnapshot): number {
  if (snap) {
    const congelado = snap.precios[p.id];
    if (congelado != null) return congelado * snap.coefK;
  }
  return (p.precio ?? 0) * coefK;
}

/** Cálculo por partida. `curData`/`prevData` = cantidades ejecutadas a origen. */
export function certCalc(
  p: Partida,
  curData: Record<string, number>,
  prevData: Record<string, number>,
  coefK = 1,
  snap?: CertSnapshot,
): CertRow {
  const ofertada = partidaCantidad(p);
  const ejecutada = curData[p.id] ?? 0;
  const prev = prevData[p.id] ?? 0;
  const pct = ofertada > 0 ? (ejecutada / ofertada) * 100 : 0;
  const precio = certPrecioK(p, coefK, snap);
  const aOrigen = importeCents(ejecutada, precio);
  const anterior = importeCents(prev, precio);
  const estaCert = aOrigen - anterior; // ambos en céntimos → resta exacta
  return { ofertada, ejecutada, prev, pct, aOrigen, anterior, estaCert };
}

/* ---- Partidas eliminadas del presupuesto (auditoría D-01) ------------------
   Borrar una partida (o su capítulo) no toca las certs: sus cantidades
   (`Cert.data`) y su precio congelado (`priceSnapshot`, que `addCert` hereda
   cert a cert) siguen ahí. Semántica elegida: PRESERVAR EL DOCUMENTO — lo ya
   certificado se valora desde el snapshot aunque la partida no exista (es la
   promesa de F7.0: un documento emitido siempre se reproduce). Antes estos
   módulos solo iteraban las partidas VIVAS y el importe desaparecía de certs
   ya emitidas. Sin snapshot (cert legada) no hay precio con el que valorar y
   se omite, como antes. */

export interface CertDeletedTotals {
  aOrigen: Cents;
  anterior: Cents;
  estaCert: Cents;
}

/** Id de la fila/capítulo sintético «Eliminado del presupuesto» que agrupa ese
 *  rastro en los resúmenes y documentos. */
export const DELETED_ROW_ID = '__eliminado';

/** Fila valorada de una partida BORRADA (con NOMBRE si dejó tombstone — v3). */
export interface CertDeletedRow {
  id: string;
  code: string;
  title: string;
  ud: string;
  /** Precio efectivo (euros) con el que la cert la valora: congelado × K congelado. */
  precio: number;
  ejecutada: number;
  prev: number;
  aOrigen: Cents;
  anterior: Cents;
  estaCert: Cents;
}

/** Filas de las partidas certificadas que YA NO están en el presupuesto: claves
 *  de `curData`/`prevData` fuera de `alive`, valoradas con precio congelado × K
 *  congelado del snapshot. Con tombstone (`bajas`, v3) llevan código/título/ud
 *  reales; sin él (borrado pre-v3), fila genérica. Sin snapshot → [] (cert
 *  legada, no valorable). */
export function certDeletedRows(
  alive: ReadonlySet<string>,
  curData: Record<string, number>,
  prevData: Record<string, number>,
  snap?: CertSnapshot,
  bajas: Record<string, PartidaBaja> = {},
): CertDeletedRow[] {
  if (!snap) return [];
  const rows: CertDeletedRow[] = [];
  const seen = new Set<string>();
  for (const pid of [...Object.keys(curData), ...Object.keys(prevData)]) {
    if (alive.has(pid) || seen.has(pid)) continue;
    seen.add(pid);
    const congelado = snap.precios[pid];
    if (congelado == null) continue; // sin precio congelado no hay valoración posible
    const precio = congelado * snap.coefK;
    const ejecutada = curData[pid] ?? 0;
    const prev = prevData[pid] ?? 0;
    if (ejecutada === 0 && prev === 0) continue; // sin importe: nada que mostrar
    const b = bajas[pid];
    const aOrigen = importeCents(ejecutada, precio);
    const anterior = importeCents(prev, precio);
    rows.push({
      id: pid,
      code: b?.code ?? '—',
      title: b?.title ?? 'Partida eliminada del presupuesto',
      ud: b?.ud ?? '',
      precio: round2(precio),
      ejecutada,
      prev,
      aOrigen,
      anterior,
      estaCert: aOrigen - anterior,
    });
  }
  return rows;
}

/** Totales agregados de `certDeletedRows` (lo que consumen `certTotals` y el
 *  resumen por capítulos, donde no hacen falta las filas con nombre). */
export function certDeletedTotals(
  alive: ReadonlySet<string>,
  curData: Record<string, number>,
  prevData: Record<string, number>,
  snap?: CertSnapshot,
): CertDeletedTotals {
  let aOrigen = 0;
  let anterior = 0;
  for (const r of certDeletedRows(alive, curData, prevData, snap)) {
    aOrigen += r.aOrigen;
    anterior += r.anterior;
  }
  return { aOrigen, anterior, estaCert: aOrigen - anterior };
}

/* ---- Precios contradictorios (F4.4) --------------------------------------
   El contradictorio se certifica como una partida más DENTRO de la cert, pero
   su precio NO lleva coeficiente K (es precio efectivo pactado). `aOrigen` /
   `anterior` / `estaCert` con la misma doble semántica que `certCalc`. */

export interface CertExtraRow {
  aOrigen: Cents; // importe a origen = cantidad · precio
  anterior: Cents; // importe certificado hasta la cert anterior
  estaCert: Cents; // aOrigen − anterior
}

/** Mapa id→cantidad a-origen de una lista de contradictorios (para el "anterior"). */
export function extrasCantidad(extras: CertExtra[] = []): Record<string, number> {
  const m: Record<string, number> = {};
  for (const e of extras) m[e.id] = e.cantidad;
  return m;
}

/** Cálculo de un contradictorio. `prevCantidad` = su cantidad en la cert anterior (0 si nuevo). */
export function extraCalc(e: CertExtra, prevCantidad: number): CertExtraRow {
  const aOrigen = importeCents(e.cantidad, e.precio);
  const anterior = importeCents(prevCantidad, e.precio);
  return { aOrigen, anterior, estaCert: aOrigen - anterior };
}

/* ---- Ajustes configurables del resumen (pago adelantado, correcciones…) -----
   Un `Ajuste` (ver types) suma o resta a la base imponible ANTES de IVA. Los `%`
   se calculan SIEMPRE sobre el importe de esta cert (`pecEsta`), no en cascada, así
   cada línea es independiente y auditable por separado. `AjusteRow` es la fila ya
   valorada (con la etiqueta compuesta) que consumen el resumen y los exports. */

export interface AjusteRow {
  id: string;
  label: string; // etiqueta legible (auto-compone el % si es porcentual)
  signo: -1 | 1;
  importe: Cents; // magnitud SIN signo (el signo va aparte, como la retención)
}

/** Importe (céntimos, sin signo) de un ajuste sobre el importe de esta cert. */
export function ajusteImporte(a: Ajuste, pecEsta: Cents): Cents {
  return a.tipo === 'pct' ? scaleCents(pecEsta, a.valor) : toCents(a.valor);
}

/** Etiqueta legible de un ajuste para el resumen y los documentos: para `pct`
 *  auto-compone el porcentaje (10,197 %) tras el concepto; para `fijo`, el concepto. */
export function ajusteLabel(a: Ajuste): string {
  if (a.tipo !== 'pct') return a.concepto;
  const pct = (a.valor * 100).toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
  return `${a.concepto} ${pct} %`.trim();
}

export interface CertTotals {
  budgetPEM: Cents; // PEM del presupuesto (para el % global)
  certPEM: Cents; // PEM certificado a origen (Σ aOrigen)
  prevPEM: Cents; // PEM certificado anterior (Σ anterior)
  pctGlobal: number; // certPEM / budgetPEM · 100
  ggbiOrigen: Cents;
  pecOrigen: Cents;
  pecPrev: Cents;
  pecEsta: Cents; // importe de esta certificación (PEC)
  retencion: Cents; // retención aplicada
  ajustesRows: AjusteRow[]; // ajustes valorados (para resumen y exports)
  ajustesTotal: Cents; // Σ con signo de los ajustes (lo que mueven la base)
  base: Cents; // base = pecEsta − retención + Σ ajustes
  iva: Cents;
  liquido: Cents; // líquido a abonar = base + IVA
}

/** Totales de la certificación (réplica de computeTotals del prototipo). */
export function certTotals(
  partidas: Partida[],
  curData: Record<string, number>,
  prevData: Record<string, number>,
  rates: Rates,
  retencion: number,
  coefK = 1,
  extras: CertExtra[] = [],
  prevExtras: CertExtra[] = [],
  snap?: CertSnapshot,
  ajustes: Ajuste[] = [],
): CertTotals {
  let budgetPEM = 0;
  let certPEM = 0;
  let prevPEM = 0;
  for (const p of partidas) {
    // budgetPEM es la referencia del % global → SIEMPRE el presupuesto vivo
    // (el snapshot congela lo certificado, no el presupuesto).
    budgetPEM += partidaImporte(p, coefK);
    const k = certCalc(p, curData, prevData, coefK, snap);
    certPEM += k.aOrigen;
    prevPEM += k.anterior;
  }
  // Contradictorios: suman al certificado/anterior pero NO al PEM de presupuesto
  // (no están en el contrato base → el % global puede pasar de 100%).
  const prevExtraCant = extrasCantidad(prevExtras);
  for (const e of extras) {
    const k = extraCalc(e, prevExtraCant[e.id] ?? 0);
    certPEM += k.aOrigen;
    prevPEM += k.anterior;
  }
  // Partidas borradas del presupuesto con importe certificado (D-01): valen su
  // snapshot — el histórico no se reescribe. No tocan budgetPEM (ya no están en
  // el contrato vivo, como los contradictorios).
  const alive = new Set(partidas.map((p) => p.id));
  const del = certDeletedTotals(alive, curData, prevData, snap);
  certPEM += del.aOrigen;
  prevPEM += del.anterior;
  const pctGlobal = budgetPEM > 0 ? (certPEM / budgetPEM) * 100 : 0;
  const ggbi = rates.gg + rates.bi;
  const ggbiOrigen = scaleCents(certPEM, ggbi);
  const pecOrigen = certPEM + ggbiOrigen;
  // MISMA fórmula que pecOrigen (auditoría B-03): antes `scaleCents(prev, 1+ggbi)`
  // redondeaba JUNTO lo que pecOrigen redondea APARTE → la línea «Certificación
  // anterior» de la cert N no reproducía el «PEC a origen» facturado en la N−1
  // (±1 céntimo en los PEM acabados en ,50) y Σ pecEsta ≠ pecOrigen final.
  const pecPrev = prevPEM + scaleCents(prevPEM, ggbi);
  const pecEsta = pecOrigen - pecPrev;
  const ret = scaleCents(pecEsta, retencion);
  // Ajustes: cada `%` sobre `pecEsta` (no en cascada); los fijos, tal cual. Todos
  // pre-IVA. `ajustesTotal` lleva el signo (−1 resta, +1 suma) → mueve la base.
  const ajustesRows: AjusteRow[] = ajustes.map((a) => ({
    id: a.id,
    label: ajusteLabel(a),
    signo: a.signo,
    importe: ajusteImporte(a, pecEsta),
  }));
  const ajustesTotal = sumCents(ajustesRows.map((r) => r.signo * r.importe));
  const base = pecEsta - ret + ajustesTotal;
  const iva = scaleCents(base, rates.iva);
  const liquido = base + iva;
  return {
    budgetPEM,
    certPEM,
    prevPEM,
    pctGlobal,
    ggbiOrigen,
    pecOrigen,
    pecPrev,
    pecEsta,
    retencion: ret,
    ajustesRows,
    ajustesTotal,
    base,
    iva,
    liquido,
  };
}

/** Datos de la certificación anterior de la lista ({} si es la primera). */
export function prevDataOf(certs: Cert[], index: number): Record<string, number> {
  return index > 0 ? (certs[index - 1]?.data ?? {}) : {};
}

/* ---- Avance por capítulo (para CertChapterSummary) ------------------------ */

export interface CertChapterRow {
  id: string;
  code: string;
  title: string;
  budget: Cents; // importe presupuestado del capítulo
  cert: Cents; // importe certificado a origen del capítulo
  pct: number; // cert / budget · 100
}

/** Avance certificado por capítulo (céntimos). Filtra los de presupuesto 0.
 *  El rastro certificado de partidas/capítulos BORRADOS (D-01/D-02) se agrupa
 *  en una fila sintética final (`DELETED_ROW_ID`): sin ella el total de la cert
 *  no cuadraría con la Σ de capítulos (dinero invisible). */
export function certChapterRows(
  chapters: Chapter[],
  partidas: PartidasMap,
  curData: Record<string, number>,
  prevData: Record<string, number>,
  coefK = 1,
  extras: CertExtra[] = [],
  snap?: CertSnapshot,
): CertChapterRow[] {
  const chapterIds = new Set(chapters.map((c) => c.id));
  const rows = chapters
    .map((ch) => {
      let budget = 0;
      let cert = 0;
      for (const p of partidas[ch.id] ?? []) {
        budget += partidaImporte(p, coefK);
        cert += certCalc(p, curData, prevData, coefK, snap).aOrigen;
      }
      // Contradictorios del capítulo: certifican pero no aumentan el presupuesto.
      for (const e of extras) {
        if (e.chapterId === ch.id) cert += extraCalc(e, 0).aOrigen;
      }
      return {
        id: ch.id,
        code: ch.code,
        title: ch.title,
        budget,
        cert,
        pct: budget > 0 ? (cert / budget) * 100 : 0,
      };
    })
    .filter((r) => r.budget > 0 || r.cert > 0);
  // «Eliminado del presupuesto»: partidas borradas (valoradas por snapshot) +
  // contradictorios de capítulos borrados. `alive` = lo alcanzable VÍA capítulos
  // (un bucket huérfano de `partidas` tampoco se pinta arriba).
  const alive = new Set(chapters.flatMap((ch) => (partidas[ch.id] ?? []).map((p) => p.id)));
  let deletedCert = certDeletedTotals(alive, curData, prevData, snap).aOrigen;
  for (const e of extras) {
    if (!chapterIds.has(e.chapterId)) deletedCert += extraCalc(e, 0).aOrigen;
  }
  if (deletedCert !== 0) {
    rows.push({
      id: DELETED_ROW_ID,
      code: '—',
      title: 'Eliminado del presupuesto',
      budget: 0,
      cert: deletedCert,
      pct: 0,
    });
  }
  return rows;
}

/* ---- % de ejecución editable (dogfood #1) --------------------------------
   El % y la cantidad NO son dinero: se redondean a precisión de CANTIDAD
   (2 decimales), no a céntimos (eng-review F4, Codex #10). */

/** Cantidad ejecutada que corresponde a un % de la ofertada. */
export function pctToCantidad(ofertada: number, pct: number): number {
  return round2((ofertada * pct) / 100);
}

/** % de ejecución de una cantidad sobre la ofertada (0 si no hay ofertada). */
export function cantidadToPct(ofertada: number, cantidad: number): number {
  return ofertada > 0 ? round2((cantidad / ofertada) * 100) : 0;
}

/* ---- Certificación por líneas (dogfood #3) --------------------------------
   `lineQty[partidaId]` = cantidad ejecutada A ORIGEN por línea (snapshot). La
   cantidad ejecutada de la partida certificada por líneas = Σ de esas cantidades
   (redondeo a precisión de CANTIDAD, no céntimos). */

/** Σ a-origen de las líneas marcadas de una partida ({}/undefined → 0). */
export function sumLineQty(lines: Record<string, number> | undefined): number {
  if (!lines) return 0;
  return round2(Object.values(lines).reduce((a, b) => a + b, 0));
}

/* ---- Edición en modo "esta certificación" --------------------------------
   El input muestra la cantidad de ESTA cert (ejecutada − anterior); al
   confirmar `v`, se guarda como cantidad A ORIGEN = max(0, prev + v). */

/** Valor a mostrar en el input en modo "esta certificación". */
export function estaCertDisplay(ejecutada: number, prev: number): number {
  return round2(ejecutada - prev);
}

/** Convierte el valor "esta cert" tecleado a cantidad a-origen para guardar. */
export function estaCertToOrigen(prev: number, v: number): number {
  return round2(Math.max(0, prev + v));
}

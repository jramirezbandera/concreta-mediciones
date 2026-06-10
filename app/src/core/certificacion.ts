/* ===========================================================================
   core/certificacion — cálculo de certificaciones de obra (port de
   certificaciones.jsx). Doble semántica "a origen" / "esta certificación".
   Importes en CÉNTIMOS. El coeficiente K (§4) se aplica al precio, igual que
   en el presupuesto.
   =========================================================================== */
import type { Cert, Chapter, Partida, PartidasMap, Rates } from './types';
import { type Cents, importeCents, round2, scaleCents } from './money';
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

/** Cálculo por partida. `curData`/`prevData` = cantidades ejecutadas a origen. */
export function certCalc(
  p: Partida,
  curData: Record<string, number>,
  prevData: Record<string, number>,
  coefK = 1,
): CertRow {
  const ofertada = partidaCantidad(p);
  const ejecutada = curData[p.id] ?? 0;
  const prev = prevData[p.id] ?? 0;
  const pct = ofertada > 0 ? (ejecutada / ofertada) * 100 : 0;
  const precio = (p.precio ?? 0) * coefK;
  const aOrigen = importeCents(ejecutada, precio);
  const anterior = importeCents(prev, precio);
  const estaCert = aOrigen - anterior; // ambos en céntimos → resta exacta
  return { ofertada, ejecutada, prev, pct, aOrigen, anterior, estaCert };
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
  base: Cents; // base = pecEsta − retención
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
): CertTotals {
  let budgetPEM = 0;
  let certPEM = 0;
  let prevPEM = 0;
  for (const p of partidas) {
    budgetPEM += partidaImporte(p, coefK);
    const k = certCalc(p, curData, prevData, coefK);
    certPEM += k.aOrigen;
    prevPEM += k.anterior;
  }
  const pctGlobal = budgetPEM > 0 ? (certPEM / budgetPEM) * 100 : 0;
  const ggbi = rates.gg + rates.bi;
  const ggbiOrigen = scaleCents(certPEM, ggbi);
  const pecOrigen = certPEM + ggbiOrigen;
  const pecPrev = scaleCents(prevPEM, 1 + ggbi);
  const pecEsta = pecOrigen - pecPrev;
  const ret = scaleCents(pecEsta, retencion);
  const base = pecEsta - ret;
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

/** Avance certificado por capítulo (céntimos). Filtra los de presupuesto 0. */
export function certChapterRows(
  chapters: Chapter[],
  partidas: PartidasMap,
  curData: Record<string, number>,
  prevData: Record<string, number>,
  coefK = 1,
): CertChapterRow[] {
  return chapters
    .map((ch) => {
      let budget = 0;
      let cert = 0;
      for (const p of partidas[ch.id] ?? []) {
        budget += partidaImporte(p, coefK);
        cert += certCalc(p, curData, prevData, coefK).aOrigen;
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
    .filter((r) => r.budget > 0);
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

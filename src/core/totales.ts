/* ===========================================================================
   core/totales — totales de presupuesto, en CÉNTIMOS (acumulación exacta).
   Portado de data.js. §0 decisión 3: PEM = Σ partidas (sin BASE_PEM).
   El coeficiente K (§4) se aplica en `partidaImporte`, así que el PEM ya viene
   ajustado por K.
   =========================================================================== */
import type { Partida, PartidasMap, Rates } from './types';
import { type Cents, scaleCents, sumCents } from './money';
import { partidaImporte } from './medicion';

/** Importe del capítulo: Σ importes de sus partidas (céntimos). */
export function chapterTotal(partidas: Partida[], coefK = 1): Cents {
  return sumCents((partidas ?? []).map((p) => partidaImporte(p, coefK)));
}

/** Importe por capítulo, indexado por id. */
export function chapterTotals(map: PartidasMap, coefK = 1): Record<string, Cents> {
  const out: Record<string, Cents> = {};
  for (const id in map) out[id] = chapterTotal(map[id] ?? [], coefK);
  return out;
}

/** PEM = Σ importes de todas las partidas (céntimos). Sin cubos ocultos. */
export function pem(map: PartidasMap, coefK = 1): Cents {
  return sumCents(Object.values(map).map((ps) => chapterTotal(ps, coefK)));
}

/** PEC s/IVA = round2(PEM · (1 + gg + bi)). */
export function pec(pemCents: Cents, rates: Rates): Cents {
  return scaleCents(pemCents, 1 + rates.gg + rates.bi);
}

/**
 * Total con IVA = round2((PEM + round2(PEM·(gg+bi))) · (1 + iva)).
 * Réplica exacta del prototipo: el GG+BI se redondea aparte antes del IVA
 * (puede diferir en un céntimo de `pec`).
 */
export function totalConIva(pemCents: Cents, rates: Rates): Cents {
  const ggbi = scaleCents(pemCents, rates.gg + rates.bi);
  const base = sumCents([pemCents, ggbi]);
  return scaleCents(base, 1 + rates.iva);
}

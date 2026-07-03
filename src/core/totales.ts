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

/** PEC s/IVA = PEM + GG + BI, cada tasa redondeada POR LÍNEA — la MISMA
 *  convención que la hoja Resumen y el documento (`buildResumen`), que es lo
 *  que se firma. Antes `scaleCents(PEM, 1+gg+bi)` (redondeo junto) difería del
 *  documento en 1 céntimo en ~25 % de los PEM posibles (auditoría B-07): la
 *  barra de estado y el Resumen enseñaban dos PEC distintos del mismo dato. */
export function pec(pemCents: Cents, rates: Rates): Cents {
  return sumCents([pemCents, scaleCents(pemCents, rates.gg), scaleCents(pemCents, rates.bi)]);
}

/**
 * Coeficiente K que lleva el PEM lo más cerca posible de un objetivo: la razón
 * directa objetivo/base, donde `baseCents` es el PEM calculado a K=1 (el que ve
 * `pem(map, 1)`). Como K multiplica cada precio ANTES del redondeo por partida
 * (`partidaImporte`), el PEM no es exactamente lineal en K: aplicar el K
 * resultante puede dejar una desviación de pocos céntimos respecto al objetivo
 * —la misma tolerancia con la que el resto del motor cuadra contra el .bc3—.
 * 6 decimales: precisión sobrada para cuadrar al céntimo sin floats absurdos.
 * Devuelve 1 si la base o el objetivo no son positivos (no se puede escalar 0).
 */
export function coefKParaObjetivo(baseCents: Cents, targetCents: Cents): number {
  if (baseCents <= 0 || targetCents <= 0) return 1;
  return Math.round((targetCents / baseCents) * 1e6) / 1e6;
}

/**
 * Total con IVA = PEC + round2(PEC·iva) — misma convención por-línea que el
 * documento (`buildResumen`: total = pec + iva), ver `pec` (auditoría B-07).
 */
export function totalConIva(pemCents: Cents, rates: Rates): Cents {
  const p = pec(pemCents, rates);
  return sumCents([p, scaleCents(p, rates.iva)]);
}

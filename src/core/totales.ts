/* ===========================================================================
   core/totales — totales de presupuesto, en CÉNTIMOS (acumulación exacta).
   Portado de data.js. §0 decisión 3: sin BASE_PEM, todo sale de las partidas.
   El coeficiente K (§4) se aplica en `partidaImporte`, así que los importes ya
   vienen ajustados por K.

   La cadena, en el orden del RGLCAP (arts. 130-131):

     Σ partidas ............ costes DIRECTOS  (`costesDirectos`, = Σ capítulos)
       + CI (·ci) .......... costes INDIRECTOS de la obra (`costesIndirectos`)
       = PEM ............... ejecución material (`pem`)
       + GG + BI ........... = PEC s/ IVA (`pec`)
       + IVA ............... = presupuesto base de licitación (`totalConIva`)

   Con `rates.ci = 0` (el defecto, y todas las obras anteriores a la v5 del
   esquema) el PEM ES la suma de capítulos: la cadena queda igual que siempre.
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

/**
 * Costes DIRECTOS de la obra = Σ importes de todas las partidas (céntimos). Sin
 * cubos ocultos: es exactamente lo que suman los capítulos del desglose.
 * OJO: no es el PEM salvo que `rates.ci` sea 0 — el PEM añade los indirectos.
 */
export function costesDirectos(map: PartidasMap, coefK = 1): Cents {
  return sumCents(Object.values(map).map((ps) => chapterTotal(ps, coefK)));
}

/**
 * Costes INDIRECTOS de la obra (€) = round2(costes directos · ci). Son los
 * gastos de la OBRA que no se imputan a una unidad concreta (instalaciones a pie
 * de obra, personal técnico adscrito, imprevistos): RGLCAP art. 130 los reparte
 * como un % sobre los directos, DENTRO del PEM. Distinto de los gastos generales
 * (art. 131), que son de la EMPRESA y van sobre el PEM ya cerrado.
 */
export function costesIndirectos(cdCents: Cents, rates: Rates): Cents {
  return scaleCents(cdCents, rates.ci);
}

/**
 * PEM = costes directos + costes indirectos (céntimos). Toma el CD ya calculado
 * (`costesDirectos`) en vez del mapa: la firma —céntimos + tasas— es la misma
 * que la de `pec` y `totalConIva`, así los tres eslabones de la cadena se
 * encadenan sin que nadie se salte uno por error.
 */
export function pem(cdCents: Cents, rates: Rates): Cents {
  return cdCents + costesIndirectos(cdCents, rates);
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
 * directa objetivo/base, donde `baseCents` es el PEM calculado a K=1. El CI no
 * estorba: multiplica base y objetivo por igual, así que se va en la razón.
 * Como K multiplica cada precio ANTES del redondeo por partida
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

/**
 * % de costes indirectos MAYORITARIO entre las partidas que traen uno declarado
 * (`ciPct`, el chip de las importadas de un banco). Es la propuesta que la hoja
 * Resumen ofrece cuando la obra aún no tiene CI: el valor que más partidas
 * declaran, y a igualdad de partidas el mayor (prudente: no infra-presupuesta).
 * `undefined` si ninguna partida declara CI. NO se aplica solo — quien decide el
 * CI de la obra es el usuario (el chip dice de dónde viene el número).
 */
export function ciMayoritario(map: PartidasMap): number | undefined {
  const votos = new Map<number, number>();
  for (const ps of Object.values(map))
    for (const p of ps ?? [])
      if (p.ciPct != null && p.ciPct > 0) votos.set(p.ciPct, (votos.get(p.ciPct) ?? 0) + 1);
  let mejor: number | undefined;
  let max = 0;
  for (const [pct, n] of votos)
    if (n > max || (n === max && mejor != null && pct > mejor)) {
      mejor = pct;
      max = n;
    }
  return mejor;
}

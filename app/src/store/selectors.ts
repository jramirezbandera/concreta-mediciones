/* ===========================================================================
   store/selectors — selectores derivados memoizados sobre `core/`.
   ---------------------------------------------------------------------------
   Todos los números económicos salen del motor `core/` (céntimos enteros), de
   modo que el store expone EXACTAMENTE los mismos valores que los tests del
   core (PEM seed = 26.291,91 €). Cada selector cachea su último resultado por
   identidad de entradas: como las mutaciones del store son inmutables (Immer
   crea referencias nuevas sólo cuando algo cambia), la igualdad por referencia
   basta para no recalcular ni romper la igualdad `Object.is` de Zustand (evita
   renders espurios y bucles con selectores que devuelven objetos).
   =========================================================================== */
import { recursoUsage } from '../core/banco';
import {
  certChapterRows as certChapterRowsCore,
  certTotals as certTotalsCore,
  type CertChapterRow,
  type CertTotals,
} from '../core/certificacion';
import type { Cents } from '../core/money';
import type { Chapter, PartidasMap, Rates } from '../core/types';
import { chapterTotals as chapterTotalsCore, pec as pecCore, pem as pemCore, totalConIva as totalConIvaCore } from '../core/totales';
import type { ObraState } from './obraStore';

/** Memoiza la última llamada por identidad de argumentos (memoize-one). */
function memo1<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let last: { args: A; result: R } | null = null;
  return (...args: A): R => {
    if (
      last &&
      last.args.length === args.length &&
      last.args.every((a, i) => Object.is(a, args[i]))
    ) {
      return last.result;
    }
    const result = fn(...args);
    last = { args, result };
    return result;
  };
}

export interface Counts {
  chapters: number;
  partidas: number;
  lineas: number; // líneas de medición en total
}

const _chapterTotals = memo1((partidas: PartidasMap, coefK: number) =>
  chapterTotalsCore(partidas, coefK),
);
const _pem = memo1((partidas: PartidasMap, coefK: number) => pemCore(partidas, coefK));
const _pec = memo1((pemCents: Cents, rates: Rates) => pecCore(pemCents, rates));
const _total = memo1((pemCents: Cents, rates: Rates) => totalConIvaCore(pemCents, rates));
const _counts = memo1((partidas: PartidasMap, chapters: Chapter[]): Counts => {
  let nPart = 0;
  let nLin = 0;
  for (const id in partidas)
    for (const p of partidas[id] ?? []) {
      nPart += 1;
      nLin += p.med?.length ?? 0;
    }
  return { chapters: chapters.length, partidas: nPart, lineas: nLin };
});

/** Importe por capítulo (céntimos), indexado por id de capítulo. */
export const selectChapterTotals = (s: ObraState): Record<string, Cents> =>
  _chapterTotals(s.partidas, s.rates.coefK);

/** PEM = Σ importes de todas las partidas (céntimos), ya ajustado por K. */
export const selectPem = (s: ObraState): Cents => _pem(s.partidas, s.rates.coefK);

/** PEC s/IVA = round2(PEM · (1 + gg + bi)) (céntimos). */
export const selectPec = (s: ObraState): Cents => _pec(selectPem(s), s.rates);

/** Total con IVA del presupuesto (céntimos). */
export const selectTotalConIva = (s: ObraState): Cents => _total(selectPem(s), s.rates);

/** Conteos para la StatusBar (capítulos · partidas · líneas de medición). */
export const selectCounts = (s: ObraState): Counts => _counts(s.partidas, s.chapters);

const _usage = memo1((partidas: PartidasMap) => recursoUsage(partidas));

/** Cuántas partidas usan cada recurso (para el chip "compartido" de la justificación). */
export const selectRecursoUsage = (s: ObraState): Record<string, number> => _usage(s.partidas);

/* ---- selectores de certificación (F4) ---- */

/** Referencia estable para "sin datos previos" (no romper la memoización). */
const EMPTY_DATA: Record<string, number> = {};

const _certTotals = memo1(
  (
    partidas: PartidasMap,
    curData: Record<string, number>,
    prevData: Record<string, number>,
    rates: Rates,
    retencion: number,
  ): CertTotals =>
    certTotalsCore(Object.values(partidas).flat(), curData, prevData, rates, retencion, rates.coefK),
);
const _certChapterRows = memo1(
  (
    chapters: Chapter[],
    partidas: PartidasMap,
    curData: Record<string, number>,
    prevData: Record<string, number>,
    coefK: number,
  ): CertChapterRow[] => certChapterRowsCore(chapters, partidas, curData, prevData, coefK),
);

const curCertData = (s: ObraState): Record<string, number> => s.certs[s.curCert]?.data ?? EMPTY_DATA;
const prevCertData = (s: ObraState): Record<string, number> =>
  s.curCert > 0 ? (s.certs[s.curCert - 1]?.data ?? EMPTY_DATA) : EMPTY_DATA;

/** Totales económicos de la certificación en curso (céntimos). */
export const selectCertTotals = (s: ObraState): CertTotals =>
  _certTotals(s.partidas, curCertData(s), prevCertData(s), s.rates, s.certs[s.curCert]?.retencion ?? 0);

/** Avance certificado por capítulo de la cert en curso. */
export const selectCertChapterRows = (s: ObraState): CertChapterRow[] =>
  _certChapterRows(s.chapters, s.partidas, curCertData(s), prevCertData(s), s.rates.coefK);

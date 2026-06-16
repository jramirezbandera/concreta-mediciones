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
  certSnapshotOf,
  certTotals as certTotalsCore,
  type CertChapterRow,
  type CertTotals,
} from '../core/certificacion';
import { buildResumen, type ResumenListado } from '../core/listado';
import type { Cents } from '../core/money';
import type { CertExtra, Chapter, PartidasMap, Rates } from '../core/types';
import { chapterTotals as chapterTotalsCore, pec as pecCore, pem as pemCore, totalConIva as totalConIvaCore } from '../core/totales';
import { copyTargetOf, type CopyTarget, type ObraState } from './obraStore';

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
const EMPTY_EXTRAS: CertExtra[] = [];

const _certTotals = memo1(
  (
    partidas: PartidasMap,
    curData: Record<string, number>,
    prevData: Record<string, number>,
    rates: Rates,
    retencion: number,
    extras: CertExtra[],
    prevExtras: CertExtra[],
    // F7.0: snapshot de precios de la cert (campos sueltos → memo por identidad).
    priceSnapshot: Record<string, number> | undefined,
    certK: number | undefined,
  ): CertTotals =>
    certTotalsCore(
      Object.values(partidas).flat(),
      curData,
      prevData,
      rates,
      retencion,
      rates.coefK,
      extras,
      prevExtras,
      certSnapshotOf({ priceSnapshot, coefK: certK }, rates.coefK),
    ),
);
const _certChapterRows = memo1(
  (
    chapters: Chapter[],
    partidas: PartidasMap,
    curData: Record<string, number>,
    prevData: Record<string, number>,
    coefK: number,
    extras: CertExtra[],
    priceSnapshot: Record<string, number> | undefined,
    certK: number | undefined,
  ): CertChapterRow[] =>
    certChapterRowsCore(
      chapters,
      partidas,
      curData,
      prevData,
      coefK,
      extras,
      certSnapshotOf({ priceSnapshot, coefK: certK }, coefK),
    ),
);

const curCertData = (s: ObraState): Record<string, number> => s.certs[s.curCert]?.data ?? EMPTY_DATA;
const prevCertData = (s: ObraState): Record<string, number> =>
  s.curCert > 0 ? (s.certs[s.curCert - 1]?.data ?? EMPTY_DATA) : EMPTY_DATA;
const curCertExtras = (s: ObraState): CertExtra[] => s.certs[s.curCert]?.extras ?? EMPTY_EXTRAS;
const prevCertExtras = (s: ObraState): CertExtra[] =>
  s.curCert > 0 ? (s.certs[s.curCert - 1]?.extras ?? EMPTY_EXTRAS) : EMPTY_EXTRAS;

/** Totales económicos de la certificación en curso (céntimos). */
export const selectCertTotals = (s: ObraState): CertTotals =>
  _certTotals(
    s.partidas,
    curCertData(s),
    prevCertData(s),
    s.rates,
    s.certs[s.curCert]?.retencion ?? 0,
    curCertExtras(s),
    prevCertExtras(s),
    s.certs[s.curCert]?.priceSnapshot,
    s.certs[s.curCert]?.coefK,
  );

/** Avance certificado por capítulo de la cert en curso. */
export const selectCertChapterRows = (s: ObraState): CertChapterRow[] =>
  _certChapterRows(
    s.chapters,
    s.partidas,
    curCertData(s),
    prevCertData(s),
    s.rates.coefK,
    curCertExtras(s),
    s.certs[s.curCert]?.priceSnapshot,
    s.certs[s.curCert]?.coefK,
  );

/* ---- selector de la hoja Resumen (F7.1) ---- */

const _resumen = memo1((chapters: Chapter[], partidas: PartidasMap, rates: Rates) =>
  buildResumen(chapters, partidas, rates),
);

/** Hoja resumen (desglose por capítulos + PEM/GG/BI/PEC/IVA/total, céntimos). */
export const selectResumen = (s: ObraState): ResumenListado =>
  _resumen(s.chapters, s.partidas, s.rates);

/* ---- selector de destino de copia (F5, panel Referencia) ---- */

const _copyTarget = memo1((chapters: Chapter[], active: string): CopyTarget =>
  copyTargetOf(chapters, active),
);

/** Capítulo/sub destino de "Copiar a …" según la selección del sidebar. */
export const selectCopyTarget = (s: ObraState): CopyTarget => _copyTarget(s.chapters, s.active);

/**
 * ¿Una copia desde Referencia debe entrar como precio CONTRADICTORIO (chip P.C.)?
 * Sí cuando la vista activa es Certificaciones: el destino/vista determina la
 * naturaleza (en Presupuesto = partida normal/BASE). Regla en UN solo sitio para
 * que ningún call site de copia la vuelva a cablear a `false` por descuido.
 */
export const selectCopyContra = (s: ObraState): boolean => s.view === 'certificaciones';

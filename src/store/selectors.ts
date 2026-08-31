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
  retenidoAcumulado as retenidoAcumuladoCore,
  tieneRetencion,
  type CertChapterRow,
  type CertTotals,
} from '../core/certificacion';
import { buildResumen, type ResumenListado } from '../core/listado';
import type { Cents } from '../core/money';
import type { Ajuste, Cert, CertExtra, Chapter, PartidasMap, Rates } from '../core/types';
import {
  chapterTotals as chapterTotalsCore,
  ciMayoritario,
  costesDirectos as cdCore,
  costesIndirectos as ciCore,
  pec as pecCore,
  pem as pemCore,
  totalConIva as totalConIvaCore,
} from '../core/totales';
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
const _cd = memo1((partidas: PartidasMap, coefK: number) => cdCore(partidas, coefK));
const _ciProp = memo1((partidas: PartidasMap) => ciMayoritario(partidas));
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

/** Costes directos = Σ importes de las partidas (céntimos), ya ajustado por K.
 *  Es lo que suman los capítulos; el PEM le añade los indirectos. */
export const selectCostesDirectos = (s: ObraState): Cents => _cd(s.partidas, s.rates.coefK);

/** % de CI que declaran mayoritariamente las partidas importadas de un banco
 *  (chip «CI x%»); `undefined` si ninguna lo trae. La hoja Resumen lo OFRECE
 *  cuando la obra aún no tiene indirectos — aplicarlo lo decide el usuario. */
export const selectCiPropuesto = (s: ObraState): number | undefined => _ciProp(s.partidas);

/** Costes indirectos de la obra (céntimos) = round2(costes directos · ci). */
export const selectCostesIndirectos = (s: ObraState): Cents =>
  ciCore(selectCostesDirectos(s), s.rates);

/** PEM = costes directos + indirectos (céntimos). Con `ci = 0` es la Σ de capítulos. */
export const selectPem = (s: ObraState): Cents => pemCore(selectCostesDirectos(s), s.rates);

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
const EMPTY_AJUSTES: Ajuste[] = [];

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
    // Ajustes del resumen: van en la CLAVE de memo (recomputar al editarlos).
    ajustes: Ajuste[],
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
      ajustes,
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
    s.certs[s.curCert]?.ajustes ?? EMPTY_AJUSTES,
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

// Cruza TODAS las certs ≤ curCert → memo por identidad de `[partidas, certs,
// index, rates]` (las mutaciones inmutables de Immer cambian la referencia solo
// al tocar algo). `null` cuando la obra no ha tenido retención hasta aquí = no
// se pinta la línea; un número (incluido 0) = se pinta (constancia).
const _retenidoAcumulado = memo1(
  (partidas: PartidasMap, certs: Cert[], index: number, rates: Rates): Cents | null =>
    tieneRetencion(certs, index)
      ? retenidoAcumuladoCore(Object.values(partidas).flat(), certs, index, rates)
      : null,
);

/** Retenido de garantía acumulado neto hasta la cert en curso (céntimos); `null`
 *  si la obra no ha tenido retención hasta aquí (la línea informativa no se muestra). */
export const selectRetenidoAcumulado = (s: ObraState): Cents | null =>
  _retenidoAcumulado(s.partidas, s.certs, s.curCert, s.rates);

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

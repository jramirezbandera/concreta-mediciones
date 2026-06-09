/* Barrel del store de la obra: estado + acciones + selectores derivados. */
export { ALL, useObraStore, seedObraData } from './obraStore';
export type { CertMode, ObraData, ObraState } from './obraStore';
export {
  selectChapterTotals,
  selectCounts,
  selectPec,
  selectPem,
  selectTotalConIva,
} from './selectors';
export type { Counts } from './selectors';

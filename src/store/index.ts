/* Barrel del store de la obra: estado + acciones + selectores derivados. */
export {
  ALL,
  SCHEMA_VERSION,
  useObraStore,
  seedObraData,
  blankObraData,
  toSerializable,
  fromSerializable,
  copyTargetOf,
} from './obraStore';
export type { CertMode, CopyTarget, ObraData, ObraState } from './obraStore';
export {
  selectCertChapterRows,
  selectCertTotals,
  selectChapterTotals,
  selectCopyTarget,
  selectCounts,
  selectPec,
  selectPem,
  selectRecursoUsage,
  selectResumen,
  selectTotalConIva,
} from './selectors';
export type { Counts } from './selectors';
export { useClipboardStore } from './clipboardStore';
export { useToastStore } from './toastStore';

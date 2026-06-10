/* ===========================================================================
   features/exportar/docx — exportador Word (F7.3).
   `docx` (MIT, isomórfica) entra SOLO vía el import dinámico de `docxRender`
   → chunk aparte, fuera del bundle inicial (eng-review F7).
   =========================================================================== */
import { useObraStore } from '../../store';
import type { PrintTarget } from '../print';
import { downloadBlob } from './download';

/** Genera y DESCARGA el .docx del listado pedido. */
export async function exportDocx(target: PrintTarget): Promise<void> {
  const { docxFor } = await import('./docxRender');
  const out = await docxFor(target, useObraStore.getState());
  if (out) downloadBlob(out.blob, out.fileName);
}

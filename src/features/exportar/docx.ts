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

/** Genera y DESCARGA el estudio de gestión de residuos en Word. `hoy` (ISO)
 *  es la fecha del estudio si no tiene una. */
export async function exportDocxRcd(hoy: string): Promise<void> {
  const { docxRcdFor } = await import('./docxRcd');
  const out = await docxRcdFor(useObraStore.getState(), hoy);
  if (out) downloadBlob(out.blob, out.fileName);
}

/** Genera y DESCARGA el plan de control de calidad en Word, y guarda en el plan
 *  lo emitido (O5) para avisar si el cálculo cambia después. */
export async function exportDocxPcc(hoy: string): Promise<void> {
  const { docxPccFor } = await import('./docxPcc');
  const out = await docxPccFor(useObraStore.getState(), hoy);
  if (!out) return;
  downloadBlob(out.blob, out.fileName);
  useObraStore.getState().setPlanCalidad({ emitido: out.emitido });
}

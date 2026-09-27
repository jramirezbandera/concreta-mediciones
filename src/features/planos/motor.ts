/* Motor de PDF en uso: el real (pdf.js) salvo en tests, que ponen el doble. */
import { pdfAdapter } from './pdfAdapter';
import type { PdfAdapter } from './pdfTipos';

let actual: PdfAdapter = pdfAdapter;

export function motorPdf(): PdfAdapter {
  return actual;
}

/** Tests: usa otro motor (`null` vuelve al real). */
export function __setMotorPdfForTests(a: PdfAdapter | null): void {
  actual = a ?? pdfAdapter;
}

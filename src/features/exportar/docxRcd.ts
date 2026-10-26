/* ===========================================================================
   features/exportar/docxRcd — el estudio de gestión de residuos en Word.

   Pinta `core/rcd/documento` (el texto ya decidido) con `docxBloques`, el
   pintor que comparte con el plan de control de calidad. Solo se alcanza por
   import dinámico, como `docxRender` (chunk aparte).
   =========================================================================== */
import { obraMeta } from '../../core/listado';
import { calcularEstudioRcd } from '../../core/rcd/calculo';
import { documentoRcd } from '../../core/rcd/documento';
import type { EstudioRcdDatos } from '../../core/rcd/tipos';
import type { Chapter, Obra, PartidasMap, Rates } from '../../core/types';
import { documentoDocx } from './docxBloques';
import { docFileName } from './fileName';

export interface DocxRcdState {
  chapters: Chapter[];
  partidas: PartidasMap;
  rates: Rates;
  obra: Obra;
  estudioRcd?: EstudioRcdDatos;
}

export interface DocxResult {
  blob: Blob;
  fileName: string;
}

/** El estudio de residuos de la obra en Word (`null` si no tiene estudio). */
export async function docxRcdFor(s: DocxRcdState, hoy: string): Promise<DocxResult | null> {
  if (!s.estudioRcd) return null;
  const r = calcularEstudioRcd({ chapters: s.chapters, partidas: s.partidas, rates: s.rates, obra: s.obra, estudio: s.estudioRcd, hoy });
  const meta = obraMeta(s.obra);
  const doc = documentoRcd(r, s.estudioRcd, {
    denominacion: meta.denominacion,
    localidad: meta.localidad,
    promotor: meta.promotor,
    constructora: meta.constructora,
  });
  const blob = await documentoDocx(doc, meta, r.fecha, 'Pendiente: técnico que redacta y firma el estudio.');
  return { blob, fileName: docFileName('Estudio de residuos', meta.denominacion, 'docx') };
}

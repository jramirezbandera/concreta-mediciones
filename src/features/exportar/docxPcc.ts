/* ===========================================================================
   features/exportar/docxPcc — el plan de control de calidad en Word.

   Pinta `core/pcc/documento` con `docxBloques`, como el de residuos, y
   devuelve lo emitido (O5) para guardarlo en el plan. Solo se alcanza por
   import dinámico: el cálculo, el catálogo y las tablas del Código van en este
   chunk, no en el principal (P1).
   =========================================================================== */
import { obraMeta } from '../../core/listado';
import { calcularPlanCalidad } from '../../core/pcc/calculo';
import { documentoPcc } from '../../core/pcc/documento';
import { emitidoDe } from '../../core/pcc/emitido';
import type { PlanCalidadDatos, PlanEmitido } from '../../core/pcc/tipos';
import type { Banco, Chapter, Obra, PartidasMap, Rates } from '../../core/types';
import { documentoDocx } from './docxBloques';
import { docFileName } from './fileName';

export interface DocxPccState {
  chapters: Chapter[];
  partidas: PartidasMap;
  recursos: Banco;
  rates: Rates;
  obra: Obra;
  planCalidad?: PlanCalidadDatos;
}

export interface DocxPccResult {
  blob: Blob;
  fileName: string;
  emitido: PlanEmitido;
}

/** El plan de control de la obra en Word (`null` si no tiene plan). `hoy` (ISO): la fecha si el plan no tiene una, y la de lo emitido. */
export async function docxPccFor(s: DocxPccState, hoy: string): Promise<DocxPccResult | null> {
  if (!s.planCalidad) return null;
  const r = calcularPlanCalidad({ chapters: s.chapters, partidas: s.partidas, banco: s.recursos, rates: s.rates, obra: s.obra, plan: s.planCalidad, hoy });
  const meta = obraMeta(s.obra);
  const doc = documentoPcc(r, s.planCalidad, {
    denominacion: meta.denominacion,
    localidad: meta.localidad,
    promotor: meta.promotor,
    constructora: meta.constructora,
  });
  const blob = await documentoDocx(doc, meta, r.fecha, 'Pendiente: técnico que redacta y firma el plan.');
  return { blob, fileName: docFileName('Plan de control de calidad', meta.denominacion, 'docx'), emitido: emitidoDe(r, hoy) };
}

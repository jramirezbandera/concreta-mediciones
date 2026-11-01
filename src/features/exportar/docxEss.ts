/* ===========================================================================
   features/exportar/docxEss — el estudio básico de seguridad y salud en Word.

   Pinta `core/ess/documento` con `docxBloques`, como residuos y calidad. Solo
   se alcanza por import dinámico: el catálogo de fichas y las reglas van en
   este chunk, no en el principal (docs/plan-seguridad-salud.md, E3).
   =========================================================================== */
import { estudioSs } from '../../core/ess/documento';
import type { EstudioSsDatos } from '../../core/ess/tipos';
import { obraMeta } from '../../core/listado';
import type { PlanCalidadDatos } from '../../core/pcc/tipos';
import type { EstudioRcdDatos } from '../../core/rcd/tipos';
import type { Banco, Chapter, Obra, PartidasMap, Rates } from '../../core/types';
import { documentoDocx } from './docxBloques';
import { docFileName } from './fileName';

export interface DocxEssState {
  chapters: Chapter[];
  partidas: PartidasMap;
  recursos: Banco;
  rates: Rates;
  obra: Obra;
  estudioRcd?: EstudioRcdDatos;
  planCalidad?: PlanCalidadDatos;
  seguridadSalud?: EstudioSsDatos;
}

/** El estudio de la obra en Word (`null` si no tiene estudio). `hoy` (ISO): la fecha si el estudio no tiene una. */
export async function docxEssFor(
  s: DocxEssState,
  hoy: string,
): Promise<{ blob: Blob; fileName: string } | null> {
  if (!s.seguridadSalud) return null;
  const datos = s.seguridadSalud.fecha ? s.seguridadSalud : { ...s.seguridadSalud, fecha: hoy };
  const { doc } = estudioSs({
    chapters: s.chapters,
    partidas: s.partidas,
    banco: s.recursos,
    rates: s.rates,
    obra: s.obra,
    estudioRcd: s.estudioRcd,
    datos,
    excluidos: [s.planCalidad?.capituloControl],
  });
  const meta = obraMeta(s.obra);
  const blob = await documentoDocx(
    doc,
    meta,
    datos.fecha ?? hoy,
    'Pendiente: técnico que redacta y firma el estudio.',
  );
  return {
    blob,
    fileName: docFileName('Estudio básico de seguridad y salud', meta.denominacion, 'docx'),
  };
}

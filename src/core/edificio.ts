/* ===========================================================================
   core/edificio — superficie construida y plantas de la obra, tecleadas una
   vez en la ficha. Las leen el estudio de residuos (ratios por m² y tramo de
   plantas de ECO-eficiencia) y el plan de calidad (lotes de hormigón): un
   solo número para los dos anejos (TD2).
   =========================================================================== */
import type { Obra } from './types';

export interface Edificio {
  superficieConstruida: number | null;
  plantasSobreRasante: number | null;
  plantasBajoRasante: number | null;
}

export const CAMPOS_EDIFICIO = ['superficieConstruida', 'plantasSobreRasante', 'plantasBajoRasante'] as const satisfies readonly (keyof Edificio)[];

/** Un número que se puede usar, o `null`: un `.json` importado puede traer cualquier cosa. */
export function numeroEdificio(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null;
}

export function edificioDe(obra: Obra): Edificio {
  return {
    superficieConstruida: numeroEdificio(obra.superficieConstruida),
    plantasSobreRasante: numeroEdificio(obra.plantasSobreRasante),
    plantasBajoRasante: numeroEdificio(obra.plantasBajoRasante),
  };
}

/** Plantas de la estructura (sobre y bajo rasante), las que cuentan los lotes de
 *  hormigón. Sin las de sobre rasante no hay cuenta. */
export function plantasTotales(e: Edificio): number | null {
  return e.plantasSobreRasante == null ? null : e.plantasSobreRasante + (e.plantasBajoRasante ?? 0);
}

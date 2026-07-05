/* ===========================================================================
   features/certificaciones/completeScope — conteo por categoría de «Completar»
   una lista de partidas (para la confirmación masiva). Compartido por la tabla
   y las tarjetas. `ids` = las partidas que CAMBIAN (se rellenan al 100%); las
   ya ≥100% y las de ofertada 0 no se tocan (never-reduce / no-op).
   =========================================================================== */
import { partidaCantidad } from '../../core/medicion';
import type { Partida } from '../../core/types';

export interface CompleteScope {
  /** Ids de las partidas que se rellenan al 100% (las que cambian). */
  ids: string[];
  /** = ids.length (rellenadas). */
  fill: number;
  /** Ya estaban ≥100% a origen: intactas. */
  already: number;
  /** De las que cambian, cuántas se certifican por líneas (se marcan todas sus líneas). */
  withLines: number;
  /** Ofertada 0: sin 100% definible, se saltan. */
  skipped: number;
}

/** Clasifica una lista de partidas visibles para el diálogo de «Completar». */
export function completeScope(
  ps: Partida[],
  curData: Record<string, number>,
  lineQty: Record<string, Record<string, number>> | undefined,
): CompleteScope {
  const ids: string[] = [];
  let already = 0;
  let withLines = 0;
  let skipped = 0;
  for (const p of ps) {
    const ofertada = partidaCantidad(p);
    if (ofertada <= 0) {
      skipped++;
      continue;
    }
    const ejec = curData[p.id] ?? 0;
    if (ejec >= ofertada) {
      already++;
      continue;
    }
    ids.push(p.id);
    if (lineQty?.[p.id]) withLines++;
  }
  return { ids, fill: ids.length, already, withLines, skipped };
}

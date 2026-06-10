/* ===========================================================================
   hooks/usePartidaRow — datos derivados de una fila de partida (T6).
   ---------------------------------------------------------------------------
   UN solo sitio calcula los valores derivados de cada partida; la fila de tabla
   (`PartidaRow`, F2.1) y la tarjeta móvil (`PartidaCard`, F2.5) sólo PRESENTAN
   este objeto, sin duplicar la matemática desktop/móvil (§0 decisión 5 / T6).

   Todo lo económico sale del motor `core/` (importe en céntimos enteros vía
   `partidaImporte`, idéntico al PEM de los selectores). `partidaRowData` es una
   función PURA (testeable sin React); `usePartidaRow` la envuelve leyendo del
   store las dos entradas compartidas por todas las filas: `coefK` y el banco.
   =========================================================================== */
import { descompUnit, precioCuadraDescompuesto } from '../core/banco';
import { partidaCantidad, partidaImporte } from '../core/medicion';
import type { Cents } from '../core/money';
import type { Banco, Partida } from '../core/types';
import { useObraStore } from '../store';

export interface PartidaRowData {
  /** Cantidad de la partida (Σ medición o cantidad fija). */
  cantidad: number;
  /** Importe en céntimos: round2(cantidad · precio · coefK). */
  importe: Cents;
  /** Peso de la partida sobre el total del capítulo (0–100). */
  pct: number;
  /** Precio unitario resultante de la descomposición (€, informativo). */
  descompUnit: number;
  /**
   * El precio efectivo NO cuadra con su descompuesto → señal de override
   * (precio fijado a mano o autoridad de la fuente). Data-driven (§0 decisión 6).
   */
  isOverride: boolean;
}

/** Núcleo puro: calcula los derivados de la fila. Sin React, unit-testable. */
export function partidaRowData(
  p: Partida,
  chapterTotal: Cents,
  coefK: number,
  banco: Banco,
): PartidaRowData {
  const importe = partidaImporte(p, coefK);
  return {
    cantidad: partidaCantidad(p),
    importe,
    pct: chapterTotal > 0 ? (importe / chapterTotal) * 100 : 0,
    descompUnit: descompUnit(p.items, banco),
    isOverride: !precioCuadraDescompuesto(p, banco),
  };
}

/**
 * Hook: derivados de una fila leyendo `coefK` y el banco del store (compartidos
 * por todas las filas; referencias estables con Immer → sin renders espurios).
 * `chapterTotal` lo pasa el contenedor, que ya lo tiene de `selectChapterTotals`.
 */
export function usePartidaRow(p: Partida, chapterTotal: Cents): PartidaRowData {
  const coefK = useObraStore((s) => s.rates.coefK);
  const banco = useObraStore((s) => s.recursos);
  return partidaRowData(p, chapterTotal, coefK, banco);
}

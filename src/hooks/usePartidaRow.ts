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

/** Derivados económicos de una partida que NO dependen del total del capítulo.
 *  El peso % se calcula aparte en `WeightBar` (con su propia suscripción al
 *  total) para no re-renderizar la fila entera al cambiar el denominador (T1.1). */
export interface PartidaEconomics {
  /** Cantidad de la partida (Σ medición o cantidad fija). */
  cantidad: number;
  /** Importe en céntimos: round2(cantidad · precio · coefK). */
  importe: Cents;
  /** Precio unitario resultante de la descomposición (€, informativo). */
  descompUnit: number;
  /**
   * El precio efectivo NO cuadra con su descompuesto → señal de override
   * (precio fijado a mano o autoridad de la fuente). Data-driven (§0 decisión 6).
   */
  isOverride: boolean;
}

/** Derivados de la fila CON el peso %. Se conserva para los tests del núcleo y
 *  para usos que ya disponen del total del capítulo. */
export interface PartidaRowData extends PartidaEconomics {
  /** Peso de la partida sobre el total del capítulo (0–100). */
  pct: number;
}

/** Núcleo puro SIN dependencia del total del capítulo. Sin React, unit-testable. */
export function partidaEconomics(p: Partida, coefK: number, banco: Banco): PartidaEconomics {
  return {
    cantidad: partidaCantidad(p),
    importe: partidaImporte(p, coefK),
    descompUnit: descompUnit(p.items, banco),
    isOverride: !precioCuadraDescompuesto(p, banco),
  };
}

/** Núcleo puro con el peso %. (Tests / usos que ya tienen el total del capítulo.) */
export function partidaRowData(
  p: Partida,
  chapterTotal: Cents,
  coefK: number,
  banco: Banco,
): PartidaRowData {
  const e = partidaEconomics(p, coefK, banco);
  return { ...e, pct: chapterTotal > 0 ? (e.importe / chapterTotal) * 100 : 0 };
}

/**
 * Hook: derivados económicos de una fila leyendo `coefK` y el banco del store.
 * Ya NO depende del total del capítulo (el peso % lo calcula `WeightBar` con su
 * propia suscripción), de modo que `PartidaRow` se memoiza por `p` y NO
 * re-renderiza al editar OTRA partida del capítulo. `coefK` y `recursos` son
 * referencias estables con Immer salvo que cambien de verdad → editar una
 * medición no dispara este hook en las filas hermanas.
 */
export function usePartidaRow(p: Partida): PartidaEconomics {
  const coefK = useObraStore((s) => s.rates.coefK);
  const banco = useObraStore((s) => s.recursos);
  return partidaEconomics(p, coefK, banco);
}

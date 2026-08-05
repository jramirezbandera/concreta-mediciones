/* ===========================================================================
   presupuesto/precioOrigen — señal visual de DE DÓNDE viene el precio.
   ---------------------------------------------------------------------------
   Feedback de obra (2026-08): «que se vea si el precio viene de la
   justificación o se puso a mano» (Arquímedes lo pinta de otro color). La
   clasificación es del dominio (`core/banco.precioOrigen`); aquí vive SOLO su
   traducción a señal de interfaz, en un único sitio para que la fila de tabla,
   la tarjeta móvil y el panel de justificación digan exactamente lo mismo.

   Regla de color (§6 a11y: el color NUNCA es la única señal):
     · descompuesto → cifra en ACCENT  + tooltip/lector «viene del descompuesto»
     · manual       → punto neutro     + tooltip con la cifra del descompuesto
     · directo      → sin marca        + tooltip «sin justificación»
   =========================================================================== */
import type { PrecioOrigen } from '../../core/banco';
import { fmtNum } from '../../core/money';

export interface PrecioOrigenSignal {
  /** Pinta la cifra en color accent: el precio SIGUE a su justificación. */
  accent: boolean;
  /** Punto a la izquierda de la cifra: hay justificación pero el precio va por libre. */
  dot: boolean;
  /** Tooltip de la celda (y texto para lector de pantalla, versión corta en `sr`). */
  title: string;
  /** Etiqueta breve para lector de pantalla (el `title` de una celda no se anuncia). */
  sr: string;
}

/**
 * Señal de la celda de precio. `descomp` = suma de la justificación (€) y
 * `nItems` = conceptos que la componen (para redactar el tooltip).
 */
export function precioOrigenSignal(
  origen: PrecioOrigen,
  descomp: number,
  nItems: number,
): PrecioOrigenSignal {
  if (origen === 'descompuesto') {
    return {
      accent: true,
      dot: false,
      title: `Precio calculado desde su justificación (${nItems} ${nItems === 1 ? 'concepto' : 'conceptos'}): al editar un concepto se recalcula solo.`,
      sr: 'precio calculado del descompuesto',
    };
  }
  if (origen === 'manual') {
    return {
      accent: false,
      dot: true,
      title: `Precio fijado a mano: no sigue a su justificación, que suma ${fmtNum(descomp)} €.`,
      sr: 'precio fijado a mano',
    };
  }
  return {
    accent: false,
    dot: false,
    title: 'Precio directo: la partida no tiene justificación de precio.',
    sr: 'precio directo, sin justificación',
  };
}

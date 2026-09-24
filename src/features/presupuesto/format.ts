/** Helpers de formato locales del presupuesto (no componentes). */

/** ¿Conviene 0 decimales? (uds entera se ve "8", no "8,00"). */
export function decOf(v: number | ''): number {
  return v !== '' && Number.isInteger(Number(v)) ? 0 : 2;
}

/** Aviso de una columna de medición que la forma de medir no usa pero que
 *  tiene datos (`medColumnas` la enseña igualmente para que no quede oculta). */
export const FUERA_TITLE =
  'La forma de medir no usa esta columna, pero alguna línea tiene un dato en ella y multiplica el parcial. Vacíala para ocultarla.';

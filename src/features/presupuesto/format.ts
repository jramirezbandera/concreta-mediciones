/** Helpers de formato locales del presupuesto (no componentes). */

/** ¿Conviene 0 decimales? (uds entera se ve "8", no "8,00"). */
export function decOf(v: number | ''): number {
  return v !== '' && Number.isInteger(Number(v)) ? 0 : 2;
}

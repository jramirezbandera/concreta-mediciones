/* Disposición del visor de planos en el hueco lateral (§5.1): su propio ancho
   (no el 320–640 de Referencia) y split u overlay según el ancho útil. */

export const SIDEBAR_W = 286;
export const PLANOS_MIN = 480;
export const PRESUPUESTO_MIN = 520;

/**
 * ≥ 1366: split. 1024–1365: split si caben el lienzo (≥ 480) y el presupuesto
 * (≥ 520); si no, overlay. Por debajo, overlay de solo ver. El ancho, el 55 %
 * del área principal por defecto, entre 480 y «ancho útil − 520».
 */
export function disposicionPlanos(w: number, isDesktop: boolean, ancho: number | null) {
  const util = w - (isDesktop ? SIDEBAR_W : 0);
  const split = w >= 1366 || (w >= 1024 && util >= PLANOS_MIN + PRESUPUESTO_MIN);
  const max = Math.max(PLANOS_MIN, util - PRESUPUESTO_MIN);
  const width = Math.round(Math.min(Math.max(ancho ?? util * 0.55, PLANOS_MIN), max));
  return { split, width, max };
}

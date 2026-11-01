// =============================================================================
// Ayudas para escribir las fichas del catálogo (feature-35, paso 3). Solo
// azúcar: `r` abrevia un riesgo con su causa.
// =============================================================================

import type { ClaveRiesgo, RiesgoFicha } from '../tipos';

/** Un riesgo de ficha: clave de K-SYS.15 y, si se sabe, la causa entre paréntesis en el análisis. */
export const r = (clave: ClaveRiesgo, causa?: string): RiesgoFicha =>
  causa ? { clave, causa } : { clave };

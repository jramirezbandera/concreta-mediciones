/* ===========================================================================
   store/base — cimientos puros COMPARTIDOS por los slices del store (F-04).
   ---------------------------------------------------------------------------
   Constantes y helpers sin estado que usan varios slices (`copySlice`,
   `estructuraSlice`) y el root del store. Viven aquí —y no en `obraStore`—
   para que los slices los importen SIN crear un ciclo de valores con el módulo
   que los ensambla. Solo dependen de `core/`.
   =========================================================================== */
import type { Chapter, SubChapter } from '../core/types';
import { rawUuid } from '../core/id';
import { flattenContainers } from '../core/tree';

/** Selección especial del sidebar: "Toda la obra". */
export const ALL = '__ALL__';

/**
 * Ids ÚNICOS por construcción (F6, eng-review run 5 / Tensión 1-B). Antes eran
 * contadores de sesión (`p·N`…) que arrancaban en 0 cada carga → al recargar una
 * obra persistida colisionaban. Peor: el id de línea `m·N` vive CONGELADO en los
 * snapshots de certificación (`Cert.lineQty`), así que rehidratar contadores
 * podía reusar un id que una cert vieja aún referencia (corrupción del cobro).
 * `crypto.randomUUID` elimina la clase entera: sin contadores, sin rehidratación,
 * sin escaneo que olvidar. El prefijo (`p-`/`r-`/`m-`/`x-`) sólo da legibilidad;
 * la unicidad la garantiza el uuid. Seed (`p111`) y bc3 (`b3-*`) ids son literales
 * (no salen de aquí) y no cambian.
 */
export function uid(prefix: string): string {
  return `${prefix}-${rawUuid()}`;
}
export const nextRecursoCode = (): string => uid('r');
export const nextPartidaId = (): string => uid('p');
export const nextMedLineId = (): string => uid('m');
export const nextExtraId = (): string => uid('x');
export const nextAjusteId = (): string => uid('a');
export const nextAgenteId = (): string => uid('ag');

/** Sub del capítulo por id, a CUALQUIER profundidad (jerarquía N niveles). */
export function subIn(ch: Chapter, subId: string): SubChapter | undefined {
  return flattenContainers(ch).find((f) => f.sub.id === subId)?.sub;
}

import { createContext } from 'react';
import type { Cents } from '../../core/money';

/**
 * Denominador del peso % de una fila (total del CAPÍTULO o del SUB aislado). Lo
 * provee `PartidasTable` y lo consume `WeightBar`; el contexto atraviesa
 * `React.memo`, así al cambiar el total solo se re-renderizan las barras y no el
 * cuerpo de cada `PartidaRow` (T1.1). En su propio módulo para no mezclar la
 * exportación del contexto con la del componente (fast-refresh).
 */
export const WeightContext = createContext<Cents>(0);

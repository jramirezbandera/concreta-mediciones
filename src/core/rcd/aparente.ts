/* ===========================================================================
   core/rcd/aparente — densidad APARENTE del residuo suelto (t/m³), para dar
   los m³ de contenedor (D6): la declarada en el estudio, o la de la
   herramienta ECO-eficiencia por código (provisional, D8). Aparte de
   `densidades` para que las reglas (store) no carguen la tabla de ECO.
   =========================================================================== */
import eco from './tablas/ecoeficiencia-2013.json';
import type { CodigoLer, EstudioRcdDatos } from './tipos';

const APARENTE_ECO = new Map<CodigoLer, number>();
for (const f of eco.detallado) {
  if (f.densidadAparente != null && !APARENTE_ECO.has(f.ler)) APARENTE_ECO.set(f.ler, f.densidadAparente);
}
// Tierras: la de las tierras de excavación (la fila de áridos da la misma).
APARENTE_ECO.set('17 05 04', eco.tierras.excavacion.densidadAparente);

export interface DensidadAparente {
  tPorM3: number;
  fuente: string;
}

export const FUENTE_APARENTE_ECO = 'Herramienta -RCDs =+ ECO-eficiencia (ECO-ARQ, Universidad de Sevilla, 2013)';

/** La declarada en el estudio manda; si no, la de ECO-eficiencia; si no, `null`. */
export function densidadAparente(ler: CodigoLer, estudio?: Pick<EstudioRcdDatos, 'densidadesAparentes'> | null): DensidadAparente | null {
  const d = estudio?.densidadesAparentes?.[ler];
  if (d && d.tPorM3 > 0) return d;
  const e = APARENTE_ECO.get(ler);
  return e != null && e > 0 ? { tPorM3: e, fuente: FUENTE_APARENTE_ECO } : null;
}

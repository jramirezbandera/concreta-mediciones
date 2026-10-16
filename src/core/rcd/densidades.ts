/* ===========================================================================
   core/rcd/densidades — de volumen a peso, y de material colocado a escombro.

   Dos densidades distintas (D6):
     · la del MATERIAL EN OBRA (macizo), para pasar la medición de una
       demolición a toneladas: CTE DB SE-AE, anejo C (K-RCD.15), en kN/m³ con
       1 kN/m³ ≈ 0,1 t/m³. Un intervalo («19 a 23») se toma por su valor
       central (D7) y el técnico puede cambiarlo;
     · la APARENTE del residuo suelto, para dar los m³ de contenedor que
       imprime el estudio: la de la herramienta ECO-eficiencia por código
       (provisional, D8), o la que declare el técnico con su fuente. Vive en
       `aparente.ts`, para que las reglas no carguen la tabla de ECO.
   Nunca se rellena una que falte: el m³ aparente sale `null` y el documento
   imprime el m³ en obra con su nota.
   =========================================================================== */
import seAe from './tablas/densidades-se-ae.json';
import type { CodigoLer } from './tipos';

export interface MaterialSeAe {
  id: string;
  material: string;
  kNm3: [number, number];
  /** t/m³ por defecto: el valor central del intervalo × 0,1. */
  tPorM3: number;
  tabla: string;
  ler: CodigoLer;
}

export interface PesoSuperficieSeAe {
  id: string;
  elemento: string;
  kNm2: number;
  tPorM2: number;
  espesor: number | null;
  tabla: string;
  ler: CodigoLer;
}

export const SE_AE_ID: string = seAe.id;
export const SE_AE_CITA: string = seAe.cita;

/** kN → t (SE-AE B.3.3: 1 kp = 10 N). Redondeo a 4 decimales: los valores de la
 *  tabla tienen como mucho uno. */
export const kNaT = (kN: number): number => Math.round(kN * 0.1 * 1e4) / 1e4;

const MATERIALES: MaterialSeAe[] = seAe.materiales.map((m) => ({
  id: m.id,
  material: m.material,
  kNm3: [m.kNm3[0]!, m.kNm3[1]!],
  tPorM3: kNaT((m.kNm3[0]! + m.kNm3[1]!) / 2),
  tabla: m.tabla,
  ler: m.ler,
}));
const PESOS: PesoSuperficieSeAe[] = seAe.pesosSuperficie.map((p) => ({ ...p, tPorM2: kNaT(p.kNm2) }));

export function materialesSeAe(): readonly MaterialSeAe[] {
  return MATERIALES;
}
export function pesosSuperficieSeAe(): readonly PesoSuperficieSeAe[] {
  return PESOS;
}
export function materialSeAe(id: string): MaterialSeAe | undefined {
  return MATERIALES.find((m) => m.id === id);
}
export function pesoSuperficieSeAe(id: string): PesoSuperficieSeAe | undefined {
  return PESOS.find((p) => p.id === id);
}
/** Referencia guardada en el componente: «se-ae-2009-04:ladrillo-hueco». */
export const refSeAe = (id: string): string => `${SE_AE_ID}:${id}`;

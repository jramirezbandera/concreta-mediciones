/* ===========================================================================
   core/rcd/fracciones — a qué fracción de separación va cada código, qué
   obliga a separar en obra (4.º) y qué destino se propone por defecto (3.º).

   Separación (K-RCD.4):
     · Ley 7/2022, art. 30.2: desde el 2022-07-01 se clasifican SIEMPRE, sin
       umbral, madera, minerales (hormigón, ladrillos, azulejos, cerámica y
       piedra), metales, vidrio, plástico y yeso;
     · RD 105/2008, art. 5.5: papel y cartón, cuando pasa de 0,5 t;
     · peligrosos, siempre aparte (Ley 7/2022 art. 30.1 en demolición; en
       Andalucía, Decreto 73/2012 art. 88.1 a), con cualquier cantidad).
   Los envases de cada material van con su fracción (INTERPRETACIÓN: son
   residuos de ese material generados en la obra).

   Destino (K-RCD.7): planta de valorización por defecto; vertedero solo para
   el amianto (sin tratamiento posible) y con la justificación del art. 86.2
   del Decreto 73/2012. La operación por defecto es una PROPUESTA nuestra
   (la confirma el gestor); los nombres vienen de los anexos II y III de la
   Ley 7/2022 (`tablas/operaciones.json`).
   =========================================================================== */
import tablaOp from './tablas/operaciones.json';
import type { CodigoLer, Fraccion, GrupoRcd } from './tipos';

const POR_PREFIJO: Array<[string, Fraccion]> = [
  ['17 01 01', 'minerales'],
  ['17 01 02', 'minerales'],
  ['17 01 03', 'minerales'],
  ['17 01 07', 'minerales'],
  ['17 02 01', 'madera'],
  ['17 02 02', 'vidrio'],
  ['17 02 03', 'plastico'],
  ['17 03 02', 'bituminosas'],
  ['17 04', 'metales'],
  ['17 05', 'tierras'],
  ['17 06 04', 'aislamiento'],
  ['17 08 02', 'yeso'],
  ['17 09 04', 'mezcla'],
  ['15 01 01', 'papelCarton'],
  ['15 01 02', 'plastico'],
  ['15 01 03', 'madera'],
  ['15 01 04', 'metales'],
  ['15 01 07', 'vidrio'],
  ['20 01 01', 'papelCarton'],
  ['20 01 02', 'vidrio'],
  ['20 01 38', 'madera'],
  ['20 01 39', 'plastico'],
  ['20 01 40', 'metales'],
];

export function fraccionDe(ler: CodigoLer, peligroso: boolean): Fraccion {
  if (peligroso) return 'peligrosos';
  return POR_PREFIJO.find(([p]) => ler.startsWith(p))?.[1] ?? 'otros';
}

export const NOMBRE_FRACCION: Record<Fraccion, string> = {
  minerales: 'Fracciones minerales (hormigón, ladrillos, azulejos, cerámica y piedra)',
  madera: 'Madera',
  metales: 'Metales',
  vidrio: 'Vidrio',
  plastico: 'Plástico',
  yeso: 'Yeso',
  papelCarton: 'Papel y cartón',
  tierras: 'Tierras y piedras',
  mezcla: 'Residuos mezclados',
  bituminosas: 'Mezclas bituminosas',
  aislamiento: 'Materiales de aislamiento',
  peligrosos: 'Residuos peligrosos',
  otros: 'Otros residuos',
};

/** Las seis fracciones de la Ley 7/2022, art. 30.2. */
export const FRACCIONES_SIN_UMBRAL: readonly Fraccion[] = ['madera', 'minerales', 'metales', 'vidrio', 'plastico', 'yeso'];
/** RD 105/2008, art. 5.5: papel y cartón, 0,5 t. */
export const UMBRAL_PAPEL_T = 0.5;

/** Grupo de la plantilla (y de las partidas de gestión por grupo). */
export function grupoDe(fraccion: Fraccion): GrupoRcd {
  if (fraccion === 'tierras') return 'tierras';
  if (fraccion === 'peligrosos') return 'peligrosos';
  if (fraccion === 'minerales' || fraccion === 'mezcla') return 'petrea';
  return 'noPetrea';
}

export interface Operacion {
  codigo: string;
  nombre: string;
}
const OPERACIONES = new Map<string, Operacion>(tablaOp.operaciones.map((o) => [o.codigo, o]));
export const OPERACIONES_ID: string = tablaOp.id;
export const OPERACIONES_CITA: string = tablaOp.cita;

export function operacion(codigo: string): Operacion | undefined {
  return OPERACIONES.get(codigo);
}

export function todasLasOperaciones(): Operacion[] {
  return [...OPERACIONES.values()];
}

const OP_POR_FRACCION: Partial<Record<Fraccion, string>> = {
  minerales: 'R0506',
  bituminosas: 'R0506',
  tierras: 'R0508',
  mezcla: 'R1201',
  madera: 'R0305',
  plastico: 'R0305',
  papelCarton: 'R0304',
  vidrio: 'R0504',
  metales: 'R0403',
  yeso: 'R0507',
  aislamiento: 'R1201',
  otros: 'R1201',
};

/** Códigos con amianto: sin valorización posible, a vertedero de peligrosos. */
const AMIANTO = new Set(['17 06 01', '17 06 05']);
export function tieneAmianto(ler: CodigoLer): boolean {
  return AMIANTO.has(ler);
}

/** Operación y destino propuestos por defecto. `operacion: null` = la decide
 *  el gestor (peligrosos distintos del amianto): sale pendiente. */
export function destinoPorDefecto(ler: CodigoLer, fraccion: Fraccion): { operacion: string | null; destino: string } {
  if (AMIANTO.has(ler)) return { operacion: 'D0503', destino: 'Gestor autorizado de residuos peligrosos (vertedero de residuos peligrosos)' };
  if (fraccion === 'peligrosos') return { operacion: null, destino: 'Gestor autorizado de residuos peligrosos' };
  const op = OP_POR_FRACCION[fraccion] ?? null;
  const planta = fraccion === 'minerales' || fraccion === 'mezcla' || fraccion === 'bituminosas' || fraccion === 'tierras';
  return {
    operacion: op,
    destino: planta ? 'Planta de valorización de residuos de construcción y demolición' : 'Gestor autorizado de residuos no peligrosos',
  };
}

/** ¿Es una operación de depósito en vertedero (D05)? */
export function esVertedero(codigo: string | null | undefined): boolean {
  return !!codigo && codigo.startsWith('D05');
}

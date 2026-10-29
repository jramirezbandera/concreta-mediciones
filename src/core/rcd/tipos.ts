/* ===========================================================================
   core/rcd/tipos — estudio de gestión de residuos de construcción y demolición
   (RD 105/2008, art. 4.1.a, con la Ley 7/2022). Plan: docs/plan-estudio-residuos.md.

   Dos cosas se guardan en la obra:
     · en cada PARTIDA, qué residuo da y cómo se pasa su medición a t y m³
       (`ResiduoPartida`, en `Partida.rcd`): es una propiedad de la unidad de
       obra, como su descomposición, y es lo que el registro `~R` del .bc3
       lleva por partida;
     · en la OBRA, los datos del estudio que no son de ninguna partida
       (`EstudioRcdDatos`, en `ObraData.estudioRcd`).
   El cálculo (`calcularEstudioRcd`) es una función pura que devuelve
   `EstudioRcd`: lo leen la vista, el Word y, más adelante, la memoria de
   Instalaciones.
   =========================================================================== */

/** Código de la lista europea de residuos normalizado: «17 01 02», sin asterisco
 *  (si es peligroso lo dice la tabla, `CodigoLerInfo.peligroso`). */
import type { Huella } from '../huella';

export type CodigoLer = string;

/** Tipo de componente, los del registro `~R` de FIEBDC-3: 0 colocación (merma
 *  de un material de la descomposición), 1 demolición, 2 excavación, 3 embalaje. */
export type TipoComponente = 'demolicion' | 'excavacion' | 'colocacion' | 'embalaje';

/**
 * Cómo se pasa la medición de la partida a toneladas y m³ de residuo. El modo
 * tiene que casar con la unidad de la partida (`unidadRcd`).
 *   · volumen        m³ de la partida = m³ en obra del residuo; t = m³ × densidad.
 *   · espesor        m² × espesor = m³ en obra; t = m³ × densidad.
 *   · pesoSuperficie m² × t/m² (tablas C.4 y C.5 del SE-AE); m³ = m² × espesor.
 *   · seccion        m × sección (m²) = m³ en obra; t = m³ × densidad.
 *   · pesoUnidad     ud × kg/ud; m³ = ud × m³/ud (o t ÷ densidad).
 *   · masa           la partida ya va en kg o t; m³ = t ÷ densidad.
 *   · directo        t y m³ por unidad ya calculados (los trae el `~R` de un .bc3).
 * `null` en un parámetro = falta el dato: se pide, nunca se rellena.
 */
export type Conversion =
  | { modo: 'volumen' }
  | { modo: 'espesor'; espesor: number | null }
  | { modo: 'pesoSuperficie'; tPorM2: number | null; espesor: number | null }
  | { modo: 'seccion'; seccion: number | null }
  | { modo: 'pesoUnidad'; kgPorUd: number | null; m3PorUd: number | null }
  | { modo: 'masa' }
  | { modo: 'directo'; tPorUd: number; m3PorUd: number; m3Base: BaseM3 };

/** Qué volumen es: el del material colocado o el del escombro suelto (contenedor). */
export type BaseM3 = 'enObra' | 'aparente';

/** Densidad del material en obra elegida para un componente (t/m³), con la
 *  clave de la fila de la tabla de la que sale («se-ae-2009-04:ladrillo-hueco»). */
export interface DensidadElegida {
  tPorM3: number | null;
  ref?: string;
}

export interface ComponenteRcd {
  /** Código validado contra la tabla vigente en la fecha del estudio. */
  ler: CodigoLer;
  tipo: TipoComponente;
  conversion: Conversion;
  densidad?: DensidadElegida;
  /** Reparto 0..1 de la medición cuando da varios residuos. Ausente = 1. */
  parte?: number;
  /** Elemento que se clasifica aparte para reutilizar (Ley 7/2022 art. 30.2:
   *  tejas, sanitarios, elementos estructurales). */
  reutilizable?: boolean;
}

/**
 * Estado de la asignación de una partida:
 *   · propuesta  la puso una regla, el banco o la IA; NO suma hasta confirmarla;
 *   · confirmada la revisó el usuario;
 *   · noGenera   confirmado que no da residuo (mano de obra, transporte de escombros…);
 *   · gestion    partida del capítulo de gestión (7.º): gestiona, no genera.
 */
export type EstadoResiduo = 'propuesta' | 'confirmada' | 'noGenera' | 'gestion';

export interface OrigenPropuesta {
  tipo: 'regla' | 'banco' | 'ia' | 'manual';
  /** Id de la regla, programa del `~V`, modelo de IA… */
  ref?: string;
  /** Por qué se propone, en una frase («Demolición de tabique · ladrillo hueco»). */
  motivo: string;
}

/** Si el precio de la partida ya lleva la carga y el transporte del residuo. */
export type Transporte = 'incluido' | 'excluido' | 'noDice';

/** Grupos de la plantilla habitual (y de las partidas de gestión por grupo). */
export type GrupoRcd = 'tierras' | 'petrea' | 'noPetrea' | 'peligrosos';

export interface ResiduoPartida {
  estado: EstadoResiduo;
  origen: OrigenPropuesta;
  componentes: ComponenteRcd[];
  transporte?: Transporte;
  /** Solo en estado `gestion`: qué gestiona, para la coherencia del 7.º. */
  gestiona?: { codigos?: CodigoLer[]; grupo?: GrupoRcd; capacidadContenedorM3?: number | null };
  /** La partida al confirmarla: si cambia, el residuo vuelve a «revisar» y no suma (TD1). */
  huella?: Huella;
}

/* ---- datos del estudio (los que no son de una partida) -------------------- */

export type TipoObraRcd = 'nueva' | 'reforma' | 'demolicion';
export type Comunidad = 'andalucia' | 'otra';
export type Amianto = 'no' | 'posible' | 'identificado';

/** Grupos de opciones del nivel detallado de ECO-eficiencia. */
export type GrupoOpcionEco =
  | 'tipologia'
  | 'plantas'
  | 'cimentacion'
  | 'estructuraVertical'
  | 'estructuraHorizontal'
  | 'cubierta'
  | 'fachada'
  | 'pavimento';

/** Superficies del proyecto que corrigen el nivel detallado de ECO-eficiencia
 *  frente a su edificio de referencia (nº de arquetas y m²). */
export type SuperficieEco = 'arquetas' | 'forjados' | 'cubiertas' | 'hojaExterior' | 'particiones' | 'pavimentos';

export type TipoObraEcoBasico =
  | 'nuevaResidencial'
  | 'nuevaNoResidencial'
  | 'demolicionResidencial'
  | 'demolicionNoResidencial'
  | 'rehabilitacionResidencial'
  | 'rehabilitacionNoResidencial';

/** Ratio por m² tecleado por el técnico, con su fuente. */
export interface RatioManual {
  ler: CodigoLer;
  tPorM2: number;
  m3PorM2: number | null;
  fuente: string;
}

/**
 * Estimación por ratios de la obra nueva (D8/D9): con ECO-eficiencia (nivel
 * detallado para vivienda, básico para otros usos) o con ratios tecleados.
 */
export interface DatosRatios {
  metodo: 'ecoeficiencia' | 'manual';
  /** Id de la tabla usada (`ecoeficiencia-2013`). */
  tabla?: string;
  nivel?: 'detallado' | 'basico';
  /** Solo nivel básico: uso de la obra nueva. */
  tipoBasico?: TipoObraEcoBasico;
  /* La superficie construida y las plantas son de la obra (`core/edificio`, TD2). */
  superficieSolar?: number | null;
  superficieOcupacion?: number | null;
  /** Id de la opción elegida en cada grupo. La de «plantas» solo cuenta si la
   *  ficha no dice las plantas sobre rasante. */
  opciones?: Partial<Record<GrupoOpcionEco, string>>;
  /** Para el nivel básico: '1' | '2-4' | '>4', si la ficha no dice las plantas. */
  plantasBasico?: string;
  superficies?: Partial<Record<SuperficieEco, number>>;
  /** Las tierras de la obra: de los ratios o de las partidas de excavación. */
  incluirTierras: boolean;
  manual?: RatioManual[];
}

export interface DestinoDeclarado {
  operacion?: string | null;
  destino?: string;
  gestor?: { nombre: string; autorizacion: string } | null;
  /** Justificación del vertedero directo (Decreto 73/2012 art. 86.2). */
  justificacionVertedero?: string;
}

export interface EstudioRcdDatos {
  version: 1;
  fase: 'basico' | 'ejecucion';
  /** Fecha del estudio (ISO, aaaa-mm-dd): decide la tabla LER vigente (D10). */
  fecha: string | null;
  inicioPrevisto?: string | null;
  tipos: TipoObraRcd[];
  /** De la provincia de la obra si no se dice (D11). */
  comunidad: Comunidad | null;
  amianto: Amianto | null;
  amiantoElementos?: string;
  tierrasReutilizadas?: { m3: number; destino: string } | null;
  separacion: 'enObra' | 'gestorExterno' | null;
  plantaMovil: boolean | null;
  destinos: Record<CodigoLer, DestinoDeclarado>;
  /** €/t o €/m³ por código, solo sin capítulo de gestión enlazado. */
  precios: Record<CodigoLer, { eurPorT?: number | null; eurPorM3?: number | null }>;
  /** Id del capítulo o subcapítulo de gestión de residuos (7.º). */
  capituloGestion: string | null;
  fianza: { importe: number | null; criterio: string } | null;
  /** PEM de toda la obra (€), cuando el presupuesto no la mide entera (proyecto
   *  básico): base del % del coste y de la fianza mínima. Ausente = el del presupuesto. */
  pemObra?: number | null;
  ordenanza: { nombre: string; articuloFianza: string } | null;
  /** Remisión del 5.º: «Plano nº … ». */
  plano: string | null;
  /** Técnico redactor, que firma (D14). */
  redactor: { nombre: string; titulacion: string; colegiado: string } | null;
  ratios: DatosRatios | null;
  /** Densidad aparente por código (t/m³) declarada por el técnico, con fuente. */
  densidadesAparentes?: Record<CodigoLer, { tPorM3: number; fuente: string }>;
  /** Reparto de la fianza mínima (Decreto 73/2012 art. 81.1) confirmado. */
  repartoFianza?: { confirmado: boolean };
}

/* ---- resultado del cálculo ------------------------------------------------- */

export type Fraccion =
  | 'minerales'
  | 'madera'
  | 'metales'
  | 'vidrio'
  | 'plastico'
  | 'yeso'
  | 'papelCarton'
  | 'tierras'
  | 'mezcla'
  | 'bituminosas'
  | 'aislamiento'
  | 'peligrosos'
  | 'otros';

/** De dónde sale una cantidad del 1.º, con su cuenta legible. */
export type OrigenCantidad =
  | {
      kind: 'partida';
      partidaId: string;
      chapterId: string;
      code: string;
      title: string;
      cantidad: number;
      ud: string;
      t: number;
      m3EnObra: number | null;
      m3Aparente: number | null;
      formula: string;
    }
  | { kind: 'ratio'; fuente: string; base: string; t: number; m3Aparente: number | null; formula: string };

export interface FilaCodigo {
  ler: CodigoLer;
  descripcion: string;
  peligroso: boolean;
  fraccion: Fraccion;
  t: number;
  /** m³ de escombro (contenedor). `null` si falta la densidad aparente de algo. */
  m3Aparente: number | null;
  /** m³ del material colocado, cuando se sabe. */
  m3EnObra: number | null;
  origen: OrigenCantidad[];
  /** Alguna partida confirmada sin un dato (espesor, peso…): suma lo que se sabe. */
  incompleta: boolean;
}

export interface FilaDestino {
  ler: CodigoLer;
  descripcion: string;
  peligroso: boolean;
  operacion: string | null;
  operacionNombre: string | null;
  destino: string;
  gestor: { nombre: string; autorizacion: string } | null;
  /** La operación es la propuesta por defecto, no una declarada. */
  porDefecto: boolean;
}

export interface FilaFraccion {
  fraccion: Fraccion;
  nombre: string;
  t: number;
  obligatoria: boolean;
  motivo: string;
  cita: string;
}

export interface FilaPeligroso {
  ler: CodigoLer;
  descripcion: string;
  elemento: string;
  t: number;
  m3Aparente: number | null;
}

export interface CosteRcd {
  modo: 'capitulo' | 'precios' | 'pendiente';
  /** Céntimos. */
  importe: number | null;
  /** % del PEM. */
  pctPem: number | null;
  capitulo?: { id: string; code: string; title: string };
  partidas: Array<{ id: string; code: string; title: string; ud: string; cantidad: number; precio: number; importe: number }>;
}

export interface FianzaRcd {
  /** RD 105/2008 art. 6.3: base cuando hay estudio = su presupuesto (céntimos). */
  baseEstudio: number | null;
  /** Andalucía, Decreto 73/2012 art. 81.1, mínimo sobre el PEM según el reparto. */
  minimoAndalucia: { importe: number; reparto: Array<{ supuesto: 'derribo' | 'nueva' | 'excavacion'; base: number; pct: number }> } | null;
  declarada: { importe: number | null; criterio: string } | null;
  /** PEM de la obra usado (céntimos): el declarado o el del presupuesto; `null`
   *  si el presupuesto solo tiene la gestión y no se ha declarado. */
  pemObra: number | null;
  /** El PEM de la obra lo tecleó el técnico (`EstudioRcdDatos.pemObra`). */
  pemDeclarado: boolean;
  /** PEM del presupuesto (céntimos), para enseñarlo junto al declarado. */
  pemPresupuesto: number;
}

export type Apartado = '1' | '2' | '3' | '4' | '5' | '6' | '7';

export interface Pendiente {
  id: string;
  apartado: Apartado | 'inventario' | 'fianza' | 'firma' | 'datos';
  texto: string;
  partidaId?: string;
  ler?: CodigoLer;
}

export interface Aviso {
  id: string;
  texto: string;
  partidaId?: string;
  ler?: CodigoLer;
}

export interface EstudioRcd {
  version: { motor: 1; ler: string; densidades: string; ratios: string | null };
  fecha: string;
  /** La comunidad que aplicó (declarada o de la provincia). */
  comunidad: Comunidad | null;
  /** Alguna partida confirmada tiene residuos de demolición. */
  hayDemolicion: boolean;
  alcance: { apartados: Apartado[]; inventario: boolean; motivo: string };
  porCodigo: FilaCodigo[];
  totales: { t: number; m3Aparente: number | null; m3EnObra: number | null; peligrososT: number };
  destinos: FilaDestino[];
  separacion: FilaFraccion[];
  inventario: FilaPeligroso[];
  coste: CosteRcd;
  fianza: FianzaRcd;
  pendientes: Pendiente[];
  avisos: Aviso[];
}

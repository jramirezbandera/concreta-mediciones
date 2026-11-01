// =============================================================================
// Los datos de la obra para el estudio básico de seguridad y salud (feature-35,
// paso 1). SOLO TIPOS Y CONSTANTES: las funciones puras viven en `datos.ts`.
//
// Lo que depende de la obra no se supone (PLAN-MEMORIA §2, principio 4): todo es
// opcional y sin valores por defecto. Lo que falta sale pendiente en «Antes de
// entregar» (`pendientesSeguridadSalud`). Base normativa: K-SYS en
// research/verificacion-seguridad-salud.md.
// =============================================================================

/**
 * Presupuesto del proyecto (K-SYS.1): PEC = (PEM + GG + BI) × (1 + IVA), Guía
 * folio 24. Sin valores por defecto (decisión 2): los porcentajes los declara el
 * proyectista. Más adelante pueden venir de concreta-mediciones.
 */
export interface PresupuestoObra {
  /** Presupuesto de ejecución material [€]. */
  pem?: number;
  /** Gastos generales [% del PEM]. */
  gg_pct?: number;
  /** Beneficio industrial [% del PEM]. */
  bi_pct?: number;
  /** IVA [%]. */
  iva_pct?: number;
}

/**
 * Ayuda para estimar los trabajadores desde el PEM (decisión 3; analisis §6.1):
 * la Guía no da método (K-SYS.2). El dato que cuenta es el que confirma el
 * proyectista en `ManoDeObra.maxTrabajadores`.
 */
export interface EstimacionTrabajadores {
  /** Parte del PEM que es mano de obra [%]. */
  manoObra_pct?: number;
  /** Coste medio de la hora de trabajo [€/h]. */
  costeHora?: number;
}

/** Un periodo en que el número de trabajadores es constante (Guía folio 25). */
export interface PeriodoObra {
  /** «Estructura», «Acabados»… Solo para leer la tabla. */
  descripcion?: string;
  /** Tᵢ: trabajadores en el periodo. */
  trabajadores: number;
  /** Dᵢ: días de trabajo del periodo (1 día = jornada de 8 h). */
  dias: number;
}

/** Duración y mano de obra (art. 4.1 b y c; K-SYS.2). */
export interface ManoDeObra {
  /** Duración estimada [días laborables]. */
  plazoDias?: number;
  /** Máximo de trabajadores a la vez, también autónomos y subcontratas. */
  maxTrabajadores?: number;
  estimacion?: EstimacionTrabajadores;
  /**
   * Volumen de mano de obra [jornadas], solo si plazo × trabajadores pasa de
   * 500 (si no, el supuesto c queda descartado sin pedirlo). Con `periodos`,
   * manda la suma de la tabla.
   */
  jornadas?: number;
  /** Tabla opcional para la suma Σ Tᵢ × Dᵢ. */
  periodos?: PeriodoObra[];
}

/** Lo que se declara del amianto (RD 396/2006 art. 10.2; K-SYS.9). */
export type EstadoAmianto = 'no_identificado' | 'posible' | 'identificado';

export const ESTADOS_AMIANTO: readonly EstadoAmianto[] = [
  'no_identificado',
  'posible',
  'identificado',
];

export const NOMBRE_ESTADO_AMIANTO: Record<EstadoAmianto, string> = {
  no_identificado: 'No se han identificado materiales con amianto',
  posible: 'Puede haber materiales con amianto',
  identificado: 'Se han identificado materiales con amianto',
};

export interface Amianto {
  estado: EstadoAmianto;
  /** Dónde está o puede estar: «bajantes de fibrocemento del patio». */
  ubicacion?: string;
  /**
   * Friable (proyectado, calorifugados, paneles aislantes) o no friable
   * (fibrocemento, amianto-vinilo), RD 396/2006 art. 11.2. Sin dato, no se sabe.
   */
  friable?: boolean;
}

/** Quiénes intervienen: deciden los coordinadores (art. 3) y el art. 2.3. */
export interface Coordinacion {
  /** ¿Varios proyectistas durante la elaboración del proyecto? (art. 3.1; decisión 13). */
  variosProyectistas?: boolean;
  /** ¿Más de una empresa, o una empresa y autónomos, o varios autónomos? (art. 3.2). */
  variasEmpresas?: boolean;
  /**
   * Solo en vivienda: el promotor reforma o construye su propia vivienda y
   * contrata directamente a autónomos (art. 2.3; K-SYS.11).
   */
  cabezaFamilia?: boolean;
}

/** El centro asistencial más próximo (decisión 7): lo declara el proyectista. */
export interface CentroAsistencial {
  nombre: string;
  direccion?: string;
  /** Distancia por carretera [km]. */
  distancia_km?: number;
  /** Tiempo de llegada [min]. */
  tiempo_min?: number;
}

/** Los servicios de la tabla «existe / no existe» (analisis §3, apartado 3; ss07). */
export type ServicioAfectado =
  | 'linea_aerea'
  | 'linea_enterrada'
  | 'transformador'
  | 'gas'
  | 'agua'
  | 'saneamiento'
  | 'telecomunicaciones';

export const SERVICIOS_AFECTADOS: readonly ServicioAfectado[] = [
  'linea_aerea',
  'linea_enterrada',
  'transformador',
  'gas',
  'agua',
  'saneamiento',
  'telecomunicaciones',
];

export const NOMBRE_SERVICIO: Record<ServicioAfectado, string> = {
  linea_aerea: 'Líneas eléctricas aéreas',
  linea_enterrada: 'Líneas eléctricas enterradas',
  transformador: 'Centros de transformación',
  gas: 'Conducciones de gas',
  agua: 'Conducciones de agua',
  saneamiento: 'Red de saneamiento',
  telecomunicaciones: 'Líneas de telecomunicaciones',
};

/** El entorno de la obra (apartados 3 y 9 del estudio). */
export interface Entorno {
  centroAsistencial?: CentroAsistencial;
  /** Edificio o local en uso durante la obra (otras actividades, art. 6.2). */
  edificioEnUso?: boolean;
  /** Se ocupa la vía pública (vallado, acopios, andamio sobre la acera). */
  viaPublica?: boolean;
  /** `true` existe, `false` no existe; sin clave, sin declarar. */
  servicios?: Partial<Record<ServicioAfectado, boolean>>;
  /**
   * Tensión nominal de las líneas aéreas próximas [kV], para las distancias de la
   * tabla 1 del RD 614/2001 (K-SYS.16). Solo con líneas aéreas.
   */
  tensionLineas_kV?: number;
}

/** Medios que cambian lo que se imprime (K-SYS.16 y K-SYS.17). */
export interface MediosObra {
  /** Grúa torre: el viento de 72 km/h y el RD 836/2003. */
  gruaTorre?: boolean;
  /** Grúa móvil autopropulsada: el RD 837/2003. */
  gruaMovil?: boolean;
}

/**
 * Las 28 claves de riesgo (K-SYS.15): la lista del análisis §4.2, con los
 * nombres que fija la verificación. Los nombres van con el catálogo (paso 3).
 */
export type ClaveRiesgo =
  | 'distinto'
  | 'mismo'
  | 'desplome'
  | 'manipulacion'
  | 'desprendidos'
  | 'pisadas'
  | 'choque-inmoviles'
  | 'choque-moviles'
  | 'golpes'
  | 'proyeccion'
  | 'atrapamiento'
  | 'vuelco'
  | 'sobreesfuerzos'
  | 'temperaturas'
  | 'termicos'
  | 'electrico'
  | 'nocivas'
  | 'causticas'
  | 'radiaciones'
  | 'explosiones'
  | 'incendios'
  | 'seres-vivos'
  | 'atropellos'
  | 'quimicos'
  | 'biologicos'
  | 'ruido'
  | 'vibraciones'
  | 'amianto';

export const CLAVES_RIESGO: readonly ClaveRiesgo[] = [
  'distinto',
  'mismo',
  'desplome',
  'manipulacion',
  'desprendidos',
  'pisadas',
  'choque-inmoviles',
  'choque-moviles',
  'golpes',
  'proyeccion',
  'atrapamiento',
  'vuelco',
  'sobreesfuerzos',
  'temperaturas',
  'termicos',
  'electrico',
  'nocivas',
  'causticas',
  'radiaciones',
  'explosiones',
  'incendios',
  'seres-vivos',
  'atropellos',
  'quimicos',
  'biologicos',
  'ruido',
  'vibraciones',
  'amianto',
];

/** Un riesgo que el proyectista añade a una ficha. */
export interface RiesgoAnadido {
  clave: ClaveRiesgo;
  causa?: string;
}

/** Lo que se quita y se añade en una lista de textos de la ficha. */
export interface EdicionLista {
  /** Textos del catálogo que se quitan, tal cual. Si el catálogo cambia el texto, vuelve a salir. */
  quitados?: string[];
  anadidos?: string[];
}

/** Lo que el proyectista edita dentro de una ficha (paso 4). */
export interface EdicionFicha {
  riesgos?: { quitados?: ClaveRiesgo[]; anadidos?: RiesgoAnadido[] };
  medidas?: EdicionLista;
  protecciones?: EdicionLista;
  epi?: EdicionLista;
  /** Una ficha «redactada por la app» que el proyectista ha revisado. */
  revisada?: boolean;
}

/**
 * La selección de fichas, como DIFERENCIA con la propuesta de la app (paso 4):
 * un cambio en la obra se refleja sin perder lo que el proyectista decidió.
 * Las claves son los ids del catálogo («IP1», «F14», «MA1», «M6»…).
 */
export interface SeleccionFichas {
  anadidas?: string[];
  quitadas?: string[];
  ediciones?: Record<string, EdicionFicha>;
}

/**
 * Lo que el proyectista declara para la dotación de servicios higiénicos
 * (K-SYS.5). Todo opcional: sin reparto por sexos se imprime la ratio del
 * convenio y la frase de la Guía; sin «corta duración», la dotación entera.
 */
export interface ServiciosHigienicosDatos {
  /**
   * Obra de corta duración o de escasa importancia (VII CGSC art. 231.4; Guía
   * folios 79–80): admite soluciones alternativas a la dotación.
   */
  cortaDuracion?: boolean;
  /** La solución alternativa, en palabras del proyectista («aseo de la vivienda, cedido por el promotor»). */
  alternativa?: string;
  /** Reparto por sexos, para la dotación recomendada de la Guía. */
  hombres?: number;
  mujeres?: number;
}

/**
 * Lo que el proyecto guarda para el estudio básico (`Proyecto.seguridadSalud`).
 * Opcional y sin schema nuevo: los expedientes guardados se siguen leyendo.
 */
export interface EstudioSeguridadSalud {
  presupuesto?: PresupuestoObra;
  manoDeObra?: ManoDeObra;
  /**
   * Túneles, galerías, conducciones subterráneas o presas (art. 4.1 d). Las
   * zanjas a cielo abierto no cuentan (Guía folio 25).
   */
  subterraneas?: boolean;
  /**
   * En obra nueva: se derriba una construcción existente en la parcela, y el
   * amianto pasa a ser obligatorio como en una obra sobre edificio existente.
   */
  demolicionPrevia?: boolean;
  amianto?: Amianto;
  coordinacion?: Coordinacion;
  entorno?: Entorno;
  medios?: MediosObra;
  serviciosHigienicos?: ServiciosHigienicosDatos;
  seleccion?: SeleccionFichas;
  /** Los planos del estudio, como los numera el proyectista («SS01–SS02»; decisión 10). */
  planos?: string;
}

// ── El catálogo de fichas (paso 3) ───────────────────────────────────────────

/** Los cinco grupos del catálogo (analisis §4.1), con los ids del análisis. */
export type GrupoFicha = 'IP' | 'F' | 'MA' | 'M' | 'TP';

export const GRUPOS_FICHA: readonly GrupoFicha[] = ['IP', 'F', 'MA', 'M', 'TP'];

export const NOMBRE_GRUPO: Record<GrupoFicha, string> = {
  IP: 'Instalaciones provisionales',
  F: 'Fases de obra',
  MA: 'Medios auxiliares y protecciones colectivas',
  M: 'Maquinaria',
  TP: 'Trabajos posteriores',
};

/** Frecuencia de uso de una medida o un EPI, solo en el bloque «toda la obra» (decisión 6). */
export type Frecuencia = 'permanente' | 'frecuente' | 'ocasional';

export const NOMBRE_FRECUENCIA: Record<Frecuencia, string> = {
  permanente: 'Permanente',
  frecuente: 'Frecuente',
  ocasional: 'Ocasional',
};

/** Un riesgo de la ficha: la clave de K-SYS.15 y, si se sabe, la causa. */
export interface RiesgoFicha {
  clave: ClaveRiesgo;
  causa?: string;
}

/**
 * Una medida, protección colectiva o EPI. Casi siempre un texto; en el bloque
 * «toda la obra» lleva la frecuencia, y las medidas que evitan un riesgo con
 * una decisión de esta obra van marcadas `evitable` con la clave del riesgo
 * que evitan: salen en el apartado 7 del estudio, no en la ficha (decisión 1).
 * Las marcadas `enTexto` ya las dice el texto fijo del apartado donde va la
 * ficha (la dotación y los primeros auxilios del 6.2): no se repiten en su tabla.
 */
export type ItemFicha =
  | string
  | { texto: string; frecuencia?: Frecuencia; evitable?: ClaveRiesgo; enTexto?: true };

/** Los diez apartados del anexo II del RD 1627/1997 (K-SYS.4). */
export type ApartadoAnexoII = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Un apartado del anexo II que la ficha puede activar; la asignación es INTERPRETACIÓN (K-SYS.4). */
export interface AnexoIIFicha {
  apartado: ApartadoAnexoII;
  /** Cuándo se da: «si hay una línea de alta tensión próxima». Sin texto, siempre que la ficha esté. */
  cuando?: string;
}

/** Una entrada del catálogo (analisis §4.1): una unidad de obra, un medio o una máquina. */
export interface FichaCatalogo {
  /** «IP1», «F14», «MA1», «M6», «TP1». */
  id: string;
  grupo: GrupoFicha;
  titulo: string;
  /** Una línea para el apartado 4 del estudio (descripción de la obra). */
  descripcion: string;
  /** Marca «(vivienda)» del análisis: frecuente en una obra de vivienda. */
  vivienda: boolean;
  riesgos: RiesgoFicha[];
  /** En las protecciones colectivas (barandillas, redes…): los riesgos que evita, aparte de los propios. */
  evita?: RiesgoFicha[];
  medidas: ItemFicha[];
  protecciones: ItemFicha[];
  epi: ItemFicha[];
  anexoII?: AnexoIIFicha[];
  /** Una frase (art. 6.2, decisión 6): qué medidas eliminan la exposición y cuáles solo la reducen. */
  eficacia: string;
  /** Avisos que se imprimen con la ficha (plomo en demoliciones, zanjas y el art. 4.1 d…). */
  notas?: string[];
  /** Avisos para el proyectista en la pantalla de selección; NO se imprimen (ficha débil, redactada por la app…). */
  avisos?: string[];
  /** Solo trabajos posteriores (K-SYS.14): los elementos de seguridad que el proyecto prevé. */
  previsiones?: string[];
  /** Solo trabajos posteriores: los datos de la obra que importan para mantenerla. */
  informaciones?: string[];
  /** Estudios de los que sale («ss01»…): solo para trazar, no se imprimen. */
  fuentes: string[];
  /** Hueco del análisis §4.8 redactado por la app (decisión 11): el proyectista la revisa. */
  redactadaPorApp?: true;
}

/* ===========================================================================
   core/pcc/tipos — plan de control de calidad del proyecto de ejecución (CTE
   parte I, art. 6.1 y anejo I; Código Estructural, arts. 14, 17 y 19).
   Plan: docs/plan-control-calidad.md.

   Como en residuos, dos cosas se guardan en la obra:
     · en cada PARTIDA, qué control dispara (`ControlPartida`, en `Partida.pcc`):
       su familia y, en la estructura, el hormigón (designación, fila de la tabla
       57.5.4.1, dosificación) y el acero;
     · en la OBRA, los datos del plan que el presupuesto no trae
       (`PlanCalidadDatos`, en `ObraData.planCalidad`).
   E1 solo tiene la estructura (§5 del plan): la familia, las reglas, la
   valoración y el Word llegan en E2–E4.
   =========================================================================== */
import type { Huella } from '../huella';

/** Filas de edificación de la tabla 57.5.4.1. */
export type FilaLote = 'cim_superficial' | 'cim_mayor_200' | 'flexion' | 'pilares_muros' | 'otros_compresion';

export type TipoHormigon = 'HM' | 'HA' | 'HP';

/** Letra C de la tipificación (art. 33.6): S, P, B, F, L, o AC si es autocompactante. */
export type Consistencia = 'S' | 'P' | 'B' | 'F' | 'L' | 'AC';

/**
 * Designación T-R/C/TM/A (art. 33.6) leída del texto y validada contra la
 * tabla 27.1.a. `clases` son las válidas; las que no lo son (`IIa`, `CX1`,
 * `XC2a`) van aparte: la partida cuenta para los lotes, pero no dispara
 * durabilidad hasta que se corrijan (Q2, K-PCC.52).
 */
export interface DesignacionHormigon {
  /** Normalizada: «HA-25/B/20/XC2», o lo que se haya podido leer. */
  texto: string;
  tipo: TipoHormigon;
  fck: number;
  /** `null`: la designación no la dice (cuenta como convencional, K-PCC.56). */
  consistencia: Consistencia | null;
  arido: number | null;
  clases: string[];
  clasesNoValidas: string[];
  /** HRM / HRA: con árido reciclado. */
  reciclado: boolean;
}

export type SerieDiametro = 'fina' | 'media' | 'gruesa' | 'muyGruesa';

/** Estado de la asignación, como en residuos (§4 del plan). */
export type EstadoControl = 'propuesta' | 'confirmada' | 'sinControl' | 'capituloControl';

export interface OrigenControl {
  tipo: 'regla' | 'banco' | 'descomposicion' | 'manual';
  ref?: string;
  motivo: string;
}

export interface HormigonPartida {
  designacion: DesignacionHormigon;
  fila?: FilaLote;
  /** Partida no medida en m³ (forjado en m²): m³ por unidad. */
  m3PorUd?: number | null;
  /** Cimentación: volumen del mayor elemento (> 200 m³ → `cim_mayor_200`). */
  elementoMayorM3?: number | null;
  /** Id que separa suministros; por defecto, la designación normalizada (T14). */
  dosificacion?: string;
}

export interface AceroPartida {
  tipo: 'barras' | 'mallas' | 'ferralla';
  /** Partida no medida en kg (hormigón «incluso armadura»): kg por unidad. */
  kgPorUd?: number | null;
  /** kg por unidad y serie de diámetros. */
  series?: Partial<Record<SerieDiametro, number>> | null;
  /** Diámetros usados (mm): la geometría de la ferralla y las series. */
  diametros?: number[];
  /** Manda sobre la del plan. */
  procedencia?: 'taller' | 'obra';
}

export interface ControlPartida {
  estado: EstadoControl;
  origen: OrigenControl;
  familia?: string;
  /** Solo `capituloControl`: la fila de la valoración (A2). */
  ensayo?: string;
  /** Al confirmar (O6). */
  huella?: Huella;
  hormigon?: HormigonPartida;
  acero?: AceroPartida;
}

/* ---- datos del plan (los que no son de una partida) ----------------------- */

export type Distintivo = 'sin' | 'con' | 'dispersion';

/** Lo que el usuario cambia de un grupo de estructura (`fila|dosificacion`). */
export interface DatosGrupo {
  /** m² construidos que abarca el grupo; en cimentación, la superficie de la cimentación. */
  superficie?: number | null;
  plantas?: number | null;
  semanas?: number | null;
  /** Nº de elementos de cimentación (zapatas), para el lote de ejecución. */
  elementos?: number | null;
  /** m de muro, para el lote de ejecución. */
  muroM?: number | null;
}

/** Lo que cubre un precio (O4): solo lo que la fuente dice (`segun`). */
export interface CoberturaPrecio {
  por?: string;
  /** Precios que hacen falta por ensayo («precio por testigo, la norma pide 10» → 10). */
  porEnsayo?: number;
  probetas?: number;
  determinaciones?: number;
  puntos?: number;
  incluye?: string[];
  nota?: string;
  segun?: string;
}

/** Precio copiado de un banco con «Tomar precios de un banco» (A1): no se lee en vivo. */
export interface PrecioCopiado {
  ensayo: string;
  /** Código o códigos del banco (varios si el precio es una suma). */
  codigo: string;
  precio: number;
  ud: string;
  banco: string;
  /** ISO, el día en que se copió. */
  fecha: string;
  /** El `~T` del banco, para «Crear capítulo» (pasa por la lista de citas vetadas). */
  texto?: string;
  cubre?: CoberturaPrecio;
}

/** Datos de una familia que el presupuesto no trae. */
export interface DatosFamilia {
  /** Nº de tipos de producto distintos (lotes «por tipo»). Por defecto, uno, con aviso. */
  tipos?: number | null;
  /** Nº de procedencias (suelos, áridos). Por defecto, una. */
  procedencias?: number | null;
  /** Días de trabajo (lechadas, lodos). */
  dias?: number | null;
  /** Nº de pilotes o micropilotes, si la partida no va en ud. */
  pilotes?: number | null;
  paneles?: number | null;
  /** m³ de hormigón de los pilotes o las pantallas. */
  m3?: number | null;
  /** Diámetro de los pilotes (mm) y si están aislados (DB SE-C 5.4.2.1.9). */
  diametro?: number | null;
  aislados?: boolean | null;
  /** Recuento de unidades de lote que no salen del presupuesto: tramos, bajantes, montantes… */
  unidades?: Record<string, number | null>;
  /** Acero estructural (§5.7): soldadura en obra, tipos de cordón y conectores. */
  soldaduraObra?: boolean | null;
  cordones?: Array<'angulo' | 'tope'>;
  conectores?: boolean | null;
}

export interface PlanCalidadDatos {
  version: 1;
  /** Fecha del plan (ISO); si falta, hoy. */
  fecha?: string | null;
  /** De la provincia de la obra si no se dice. */
  comunidad?: 'andalucia' | 'otra' | null;
  uso?: 'vivienda' | 'otro' | null;
  /** Una sola vivienda; con `aislada`, la IT 5 andaluza solo pide fachada. */
  unifamiliar?: boolean | null;
  aislada?: boolean | null;
  /** Nº de viviendas o unidades de uso (pruebas por porcentaje, K-PCC.64). */
  viviendas?: number | null;
  /** REBT: inspección inicial por organismo de control (garaje de 25 plazas o más…). */
  inspeccionInicial?: boolean | null;
  zonaSismica?: boolean | null;
  /** IT 5: recintos de actividad e instalaciones colindantes con habitables, instalaciones comunes. */
  recintosIT5?: { actividad?: number | null; instalaciones?: number | null; comunes?: number | null };
  familias?: Record<string, DatosFamilia>;
  /** Ensayo del catálogo o prueba de obra terminada: `true` lo incluye, `false` quita uno propuesto (D8, D9). */
  marcados?: Record<string, boolean>;
  /** Prueba de instalaciones que pasa al laboratorio y a la valoración (D2). */
  aCargo?: Record<string, 'laboratorio' | 'instalador'>;
  /** Id del capítulo o subcapítulo de control de calidad del presupuesto (§9). */
  capituloControl?: string | null;
  precios?: Record<string, PrecioCopiado>;
  /** Precio tecleado por ensayo (€). */
  preciosManuales?: Record<string, number>;
  /** De la obra, tecleadas una vez: prerrellenan los grupos (D7). */
  superficieConstruida?: number | null;
  plantas?: number | null;
  grupos?: Record<string, DatosGrupo>;
  hormigon?: {
    distintivo?: Distintivo;
    modalidad?: 'estadistico' | 'cien';
    cubaM3?: number | null;
  };
  /** Meses de suministro por dosificación (durabilidad). */
  dosificaciones?: Record<string, { meses?: number | null }>;
  acero?: {
    procedencia?: 'taller' | 'obra';
    enderezado?: boolean;
    soldadura?: 'no' | 'noResistente' | 'resistente';
    distintivos?: { barras?: boolean; mallas?: boolean; ferralla?: boolean };
  };
  ejecucion?: { nivel?: 'normal' | 'intenso'; opcion?: 'A' | 'B' };
  /** Técnico redactor, que firma. */
  redactor?: { nombre: string; titulacion: string; colegiado: string } | null;
  /** Lo que salió en el último Word (O5): el plan reabierto avisa si el cálculo de hoy difiere. */
  emitido?: PlanEmitido | null;
}

/** Una fila de la valoración tal como salió en el Word. */
export interface FilaEmitida {
  ensayo: string;
  descripcion: string;
  cantidad: number;
  /** €. */
  precio: number | null;
  /** Céntimos. */
  importe: number | null;
}

export interface PlanEmitido {
  /** ISO, el día de la exportación. */
  fecha: string;
  version: PlanCalidad['version'];
  filas: FilaEmitida[];
  /** Céntimos. */
  total: number;
  porcentaje: number | null;
}

/** Lo que cambia frente al Word entregado. */
export interface DiferenciaEmitido {
  ensayo: string | null;
  texto: string;
}

/* ---- resultado del plan ----------------------------------------------------- */

/** LAB laboratorio; INST empresa instaladora; OC organismo de control; DF a criterio de la dirección facultativa. */
export type Quien = 'LAB' | 'INST' | 'OC' | 'DF';
export type FuentePrecio = 'banco' | 'junta' | 'manual' | 'pendiente';

/** Un ensayo o prueba del plan, con su cuenta. */
export interface FilaControl {
  /** Id del catálogo, «app-…» para los propios de la app, o el de la prueba si no tiene ensayo. */
  ensayo: string;
  familia: string;
  capa: 'recepcion' | 'obraTerminada';
  prueba?: string;
  descripcion: string;
  norma: string | null;
  nivel: 1 | 2 | 3 | null;
  unidad: string;
  /** Entero, redondeado hacia arriba (K-PCC.57). 0 si falta un dato o es a criterio de la DF. */
  cantidad: number;
  /** De qué sale el número (K-PCC.54). */
  regla: string;
  /** incluido: va al plan; aCriterio: cantidad 0, a juicio de la DF; noMarcado: nivel 2/3 o prueba sin marcar. */
  estado: 'incluido' | 'aCriterio' | 'noMarcado' | 'aCargoDeOtros';
  quien: Quien;
  cita?: string;
}

export interface PrecioFila {
  valor: number | null;
  fuente: FuentePrecio;
  banco?: string;
  fecha?: string;
  codigo?: string;
  cubre?: CoberturaPrecio;
}

export interface FilaValoracion {
  ensayo: string;
  descripcion: string;
  norma: string | null;
  unidad: string;
  cantidad: number;
  regla: string;
  precio: PrecioFila;
  /** Nº de precios: la cantidad ajustada a lo que cubre cada uno (O4). */
  precios: number;
  /** Céntimos; `null` si falta el precio. */
  importe: number | null;
}

/** Lo que paga otro agente (instalador, organismo de control): se lista sin importe (D2). */
export interface FilaSinCoste {
  ensayo: string;
  prueba?: string;
  descripcion: string;
  quien: Quien;
  cantidad: number;
  unidad: string;
  regla: string;
  cita?: string;
}

export interface DocumentoExigido {
  texto: string;
  cita: string;
}

export interface BloqueRecepcion {
  familia: string;
  nombre: string;
  partidas: Array<{ partidaId: string; code: string; title: string; cantidad: number; ud: string }>;
  documental: DocumentoExigido[];
  ensayos: FilaControl[];
}

export interface InspeccionEjecucion {
  id: string;
  fase: string;
  comprobacion: string;
  /** Nº de inspecciones; `null` si falta el dato (la cuenta lo dice). */
  cantidad: number | null;
  cuenta: string;
  rechazo: string;
  cita: string;
}

export interface BloqueEjecucion {
  familia: string;
  nombre: string;
  inspecciones: InspeccionEjecucion[];
}

export interface PruebaObraTerminada {
  id: string;
  familia: string;
  nombre: string;
  cita: string;
  /** R reglamento; P a criterio del proyecto; C condicionada a un dato. */
  oblig: 'R' | 'P' | 'C';
  quien: Quien;
  incluida: boolean;
  filas: FilaControl[];
}

export interface PlanCalidad {
  version: { motor: 1; catalogo: string; enlaceBcca: string; familias: string } & ResultadoEstructura['version'];
  fecha: string;
  comunidad: 'andalucia' | 'otra' | null;
  /** Normas que cita el plan, de las familias presentes y la comunidad. */
  marco: string[];
  recepcion: BloqueRecepcion[];
  ejecucion: BloqueEjecucion[];
  obraTerminada: PruebaObraTerminada[];
  estructura: ResultadoEstructura;
  valoracion: FilaValoracion[];
  aCargoDeOtros: FilaSinCoste[];
  /** Céntimos: Σ importes conocidos. */
  total: number;
  /** Todas las filas tienen precio. */
  totalCompleto: boolean;
  /** % del PEM sin el capítulo de control, como dato (ninguna norma fija un mínimo). */
  porcentaje: { valor: number; basePem: number } | null;
  /** El capítulo de control enlazado y su coherencia con la valoración (§9). */
  capitulo: CoherenciaCapitulo | null;
  /** Lo que cambia frente al último Word exportado (O5); vacío si no se exportó o no cambia. */
  emitido: DiferenciaEmitido[];
  /** Partidas propuestas sin confirmar y confirmadas que hay que revisar (O6). */
  sinRevisar: number;
  revisar: string[];
  pendientes: Pendiente[];
  avisos: Aviso[];
}

/** Partida del capítulo de control, con el ensayo con que se casa (§9, A2). */
export interface PartidaCapitulo {
  partidaId: string;
  chapterId: string;
  code: string;
  title: string;
  ud: string;
  cantidad: number;
  /** € por unidad, sin K. */
  precio: number;
  /** Céntimos, con K. */
  importe: number;
  ensayo: string | null;
  /** `ensayo`: por su `pcc.ensayo`; `codigo`: por el código del banco. */
  como: 'ensayo' | 'codigo' | null;
}

/** Partida que parece un ensayo por su texto: no casa hasta que el usuario lo confirme. */
export interface PropuestaCasar {
  partidaId: string;
  chapterId: string;
  ensayo: string;
  descripcion: string;
}

export interface CoherenciaCapitulo {
  id: string;
  code: string;
  title: string;
  partidas: PartidaCapitulo[];
  propuestas: PropuestaCasar[];
  /** Céntimos, con K: lo que suman sus partidas. */
  importe: number;
  /** Céntimos: lo que el capítulo añade al PEM, con sus costes indirectos (O1a). */
  aportePem: number;
  /** K ≠ 1 o CI > 0: la valoración (precios de laboratorio) y el aporte al PEM no son la misma cifra. */
  kci: boolean;
  /** Céntimos: los ensayos de nivel 1 de las familias presentes, a sus precios (aviso de plan pobre). */
  minimoNivel1: number;
}

/* ---- resultado del cálculo de la estructura ------------------------------- */

export interface Pendiente {
  id: string;
  texto: string;
  partidaId?: string;
  grupo?: string;
}

export interface Aviso {
  id: string;
  texto: string;
  partidaId?: string;
  grupo?: string;
}

/** Partida que entra en un grupo, con lo que aporta. */
export interface AporteHormigon {
  partidaId: string;
  code: string;
  title: string;
  m3: number;
  /** «45,00 m³» o «300,00 m² × 0,15 m³/m²». */
  formula: string;
}

/** De dónde sale cada dato de un grupo. */
export type OrigenDato = 'grupo' | 'obra' | 'partidas' | null;

export interface GrupoHormigon {
  clave: string;
  fila: FilaLote;
  dosificacion: string;
  designacion: DesignacionHormigon;
  partidas: AporteHormigon[];
  volumen: number;
  superficie: { valor: number | null; origen: OrigenDato };
  plantas: { valor: number | null; origen: OrigenDato };
  semanas: number | null;
  /** 1 sin distintivo; 5 con él; 2 con dispersión certificada. */
  ampliacion: 1 | 2 | 5;
  /** `null` en el control al 100 %. */
  lotes: number | null;
  /** Amasadas a controlar por lote (o por elemento, en `cim_mayor_200`), tras el tope. */
  n: number;
  amasadas: number;
  ensayos: {
    resistencia: number;
    consistencia: number;
    escurrimiento: number;
    anilloJapones: number;
    probetas: number;
  };
  /** Cuenta legible (K-PCC.54). */
  cuenta: string;
  /** Lo que se aplica como interpretación, para el plan. */
  notas: string[];
}

export interface Durabilidad {
  dosificacion: string;
  designacion: string;
  clases: string[];
  meses: number | null;
  penetracion: number;
  aireOcluido: number;
  cuenta: string;
}

export type EnsayoArmadura =
  | 'traccion'
  | 'doblado'
  | 'masaMetro'
  | 'geometria'
  | 'despegue'
  | 'dimensiones'
  | 'quimica';

export interface LoteArmaduras {
  /** `ferralla` (art. 59.2), `barras` (art. 58, elaboradas en obra) o `mallas` (59.1.4.2). */
  control: 'ferralla' | 'barras' | 'mallas';
  kg: number;
  /** Con distintivo del producto: solo documentación. */
  distintivo: boolean;
  lotes: number;
  ensayos: Partial<Record<EnsayoArmadura, number>>;
  partidas: Array<{ partidaId: string; code: string; title: string; kg: number; formula: string }>;
  cuenta: string;
  notas: string[];
}

export type FilaEjecucion = 'cimentacion' | 'flexion' | 'pilares_muros';

export interface LoteEjecucion {
  fila: FilaEjecucion;
  lotes: number;
  cuenta: string;
}

export interface ResultadoEstructura {
  version: { lotes: string; durabilidad: string; armaduras: string; ejecucion: string };
  distintivo: Distintivo;
  modalidad: 'estadistico' | 'cien';
  grupos: GrupoHormigon[];
  /** Σ por convencional y autocompactante (K-PCC.56). */
  totales: { lotes: number; amasadas: number; probetas: number };
  durabilidad: Durabilidad[];
  armaduras: LoteArmaduras[];
  ejecucion: { nivel: 'normal' | 'intenso'; lotes: LoteEjecucion[] };
  /** Por qué no se ofrece el control indirecto (§5.3). */
  indirecto: { ofrecido: false; motivo: string };
  pendientes: Pendiente[];
  avisos: Aviso[];
}

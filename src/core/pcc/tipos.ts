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
  huella?: { code: string; title: string; desc: string; ud: string };
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

export interface PlanCalidadDatos {
  version: 1;
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

// =============================================================================
// El motor del art. 4 del RD 1627/1997 (feature-35, paso 2). PURO.
//
// El PEC con su desglose, los cuatro supuestos del art. 4.1 con el dato del
// proyecto y si se superan, el resultado (básico, completo o pendiente de
// datos), el aviso de cercanía al umbral, los coordinadores del art. 3 y la
// dotación de servicios higiénicos del VII Convenio. Base normativa: K-SYS.1,
// 2, 5, 11 y 19 en research/verificacion-seguridad-salud.md. Lo que depende de
// la obra no se supone: sin dato, el supuesto queda «sin datos», no «no».
// =============================================================================

import type {
  Coordinacion,
  EstudioSeguridadSalud,
  PresupuestoObra,
  ServiciosHigienicosDatos,
} from './tipos';
import { UMBRAL_JORNADAS, cotaJornadas, jornadasDeclaradas } from './datos';

// ── Umbrales (RD 1627/1997 art. 4.1, VERIFICADO; Guía folio 24) ──────────────

/** Art. 4.1 a): «igual o superior a 75 millones de pesetas», 450.759,08 € (Guía folio 24). */
export const UMBRAL_PEC = 450_759.08;
/** Art. 4.1 b): duración «superior a 30 días laborables»… */
export const UMBRAL_DIAS = 30;
/** …«empleándose en algún momento a más de 20 trabajadores simultáneamente». Las dos a la vez. */
export const UMBRAL_TRABAJADORES = 20;
/** Aviso si el PEC queda por debajo del umbral a menos de este margen (decisión 4). */
export const MARGEN_AVISO_PEC = 0.05;

/** A céntimos, como en la hoja del art. 4 del estudio. */
const cents = (v: number): number => Math.round(v * 100) / 100;
const enCents = (v: number): number => Math.round(v * 100);

const euros = (v: number): string =>
  `${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const entero = (v: number): string => v.toLocaleString('es-ES', { maximumFractionDigits: 0 });

// ── PEC ──────────────────────────────────────────────────────────────────────

/** El desglose del PEC, para la tabla del apartado 1. */
export interface DesglosePec {
  pem: number;
  gg_pct: number;
  gg: number;
  bi_pct: number;
  bi: number;
  /** PEM + GG + BI: el «Total» de la hoja del estudio. */
  base: number;
  iva_pct: number;
  iva: number;
  pec: number;
}

/**
 * PEC = (PEM + GG + BI) × (1 + IVA) (Guía folio 24; K-SYS.1). Cada línea se
 * redondea a céntimos antes de sumar, como en la hoja del estudio (ss02 a
 * ss04). `null` si falta el PEM o alguno de los tres porcentajes: no se supone
 * ninguno (decisión 2). Un porcentaje del 0 % es un dato válido.
 */
export function calcularPec(pr: PresupuestoObra | undefined): DesglosePec | null {
  if (
    !pr ||
    pr.pem === undefined ||
    pr.gg_pct === undefined ||
    pr.bi_pct === undefined ||
    pr.iva_pct === undefined
  )
    return null;
  if (!(pr.pem > 0)) return null;
  // En céntimos enteros, para que el redondeo de cada línea sea el de la hoja
  // (9.808,575 → 9.808,58) y no dependa del error de coma flotante.
  const pemC = enCents(pr.pem);
  const ggC = Math.round((pemC * pr.gg_pct) / 100);
  const biC = Math.round((pemC * pr.bi_pct) / 100);
  const baseC = pemC + ggC + biC;
  const ivaC = Math.round((baseC * pr.iva_pct) / 100);
  const pecC = baseC + ivaC;
  return {
    pem: pemC / 100,
    gg_pct: pr.gg_pct,
    gg: ggC / 100,
    bi_pct: pr.bi_pct,
    bi: biC / 100,
    base: baseC / 100,
    iva_pct: pr.iva_pct,
    iva: ivaC / 100,
    pec: pecC / 100,
  };
}

// ── Los cuatro supuestos del art. 4.1 ────────────────────────────────────────

export type LetraSupuesto = 'a' | 'b' | 'c' | 'd';

/** `sin_datos`: falta lo que hace falta para decidir; no se supone que no. */
export type EstadoSupuesto = 'supera' | 'no_supera' | 'sin_datos';

/** Una fila de la tabla «Supuesto | Umbral | Proyecto | ¿Se supera?» (K-SYS.2). */
export interface Supuesto {
  letra: LetraSupuesto;
  /** El supuesto, en palabras del art. 4.1. */
  titulo: string;
  /** El umbral, para la columna de la tabla. */
  umbral: string;
  /** El dato del proyecto, para la columna de la tabla. */
  proyecto: string;
  estado: EstadoSupuesto;
  /** Por qué: el atajo de las jornadas, o lo que falta. */
  nota?: string;
}

/** Los datos que deciden el art. 4, ya derivados del proyecto. */
export interface DatosArt4 {
  pec?: number;
  plazoDias?: number;
  maxTrabajadores?: number;
  /** Las jornadas declaradas: el número o la suma de la tabla de periodos. */
  jornadas?: number;
  /** Túneles, galerías, conducciones subterráneas o presas. */
  subterraneas?: boolean;
}

/**
 * `completo`: se supera algún supuesto y hace falta el estudio de seguridad y
 * salud (fuera de alcance). `pendiente`: no se supera ninguno de los que se
 * pueden decidir, pero falta algún dato. `basico`: los cuatro, descartados.
 */
export type ResultadoArt4 = 'basico' | 'completo' | 'pendiente';

/** El PEC queda por debajo del umbral a menos del margen (decisión 4). */
export interface AvisoPec {
  /** Lo que falta para el umbral [€]. */
  diferencia: number;
  /** La diferencia como porcentaje del umbral, con dos decimales. */
  pct: number;
}

export interface EvaluacionArt4 {
  supuestos: Supuesto[];
  superados: LetraSupuesto[];
  sinDatos: LetraSupuesto[];
  resultado: ResultadoArt4;
  avisoPec?: AvisoPec;
}

const TITULOS: Record<LetraSupuesto, string> = {
  a: 'El presupuesto de ejecución por contrata incluido en el proyecto es igual o superior a 450.759,08 €',
  b: 'La duración estimada es superior a 30 días laborables, empleándose en algún momento a más de 20 trabajadores simultáneamente',
  c: 'El volumen de mano de obra estimada (la suma de los días de trabajo del total de los trabajadores) es superior a 500',
  d: 'Es una obra de túneles, galerías, conducciones subterráneas o presas',
};

const UMBRALES: Record<LetraSupuesto, string> = {
  a: `PEC ≥ ${euros(UMBRAL_PEC)}`,
  b: `> ${UMBRAL_DIAS} días laborables y > ${UMBRAL_TRABAJADORES} trabajadores a la vez`,
  c: `> ${UMBRAL_JORNADAS} jornadas`,
  d: 'Túneles, galerías, conducciones subterráneas o presas',
};

function supuestoA(pec: number | undefined): Supuesto {
  const s: Supuesto = {
    letra: 'a',
    titulo: TITULOS.a,
    umbral: UMBRALES.a,
    proyecto: 'Sin presupuesto',
    estado: 'sin_datos',
  };
  if (pec === undefined)
    return {
      ...s,
      nota: 'Falta el PEC: el PEM y los porcentajes de gastos generales, beneficio industrial e IVA.',
    };
  return {
    ...s,
    proyecto: `PEC ${euros(pec)}`,
    estado: enCents(pec) >= enCents(UMBRAL_PEC) ? 'supera' : 'no_supera',
  };
}

function supuestoB(plazoDias: number | undefined, maxTrabajadores: number | undefined): Supuesto {
  const dias = plazoDias === undefined ? undefined : plazoDias > UMBRAL_DIAS;
  const trabajadores =
    maxTrabajadores === undefined ? undefined : maxTrabajadores > UMBRAL_TRABAJADORES;
  // Las dos condiciones a la vez (Guía folio 24): con una que no se cumpla, basta.
  const estado: EstadoSupuesto =
    dias === false || trabajadores === false
      ? 'no_supera'
      : dias && trabajadores
        ? 'supera'
        : 'sin_datos';
  const partes = [
    plazoDias === undefined ? 'sin plazo' : `${entero(plazoDias)} días laborables`,
    maxTrabajadores === undefined
      ? 'sin máximo de trabajadores'
      : `${entero(maxTrabajadores)} trabajadores a la vez como máximo`,
  ];
  const s: Supuesto = {
    letra: 'b',
    titulo: TITULOS.b,
    umbral: UMBRALES.b,
    proyecto: partes.join('; '),
    estado,
  };
  if (estado === 'sin_datos') s.nota = 'Faltan el plazo o el máximo de trabajadores a la vez.';
  else if (estado === 'no_supera' && (dias === undefined || trabajadores === undefined)) {
    s.nota =
      dias === false
        ? 'Con 30 días laborables o menos, el supuesto no se da sea cual sea el número de trabajadores.'
        : 'Con 20 trabajadores a la vez o menos, el supuesto no se da sea cual sea la duración.';
  }
  return s;
}

function supuestoC(
  jornadas: number | undefined,
  plazoDias: number | undefined,
  maxTrabajadores: number | undefined,
): Supuesto {
  const s: Supuesto = {
    letra: 'c',
    titulo: TITULOS.c,
    umbral: UMBRALES.c,
    proyecto: 'Sin jornadas',
    estado: 'sin_datos',
  };
  if (jornadas !== undefined) {
    return {
      ...s,
      proyecto: `${entero(jornadas)} jornadas`,
      estado: jornadas > UMBRAL_JORNADAS ? 'supera' : 'no_supera',
    };
  }
  // El atajo (K-SYS.2, INTERPRETACIÓN aritmética): las jornadas no pueden pasar
  // del plazo por el máximo de trabajadores a la vez.
  const cota = cotaJornadas({ plazoDias, maxTrabajadores });
  if (cota !== undefined && cota <= UMBRAL_JORNADAS) {
    return {
      ...s,
      proyecto: `Como mucho ${entero(cota)} jornadas (${entero(plazoDias!)} días × ${entero(maxTrabajadores!)} trabajadores)`,
      estado: 'no_supera',
      nota: 'Las jornadas no pueden pasar del plazo por el máximo de trabajadores a la vez, que no llega a 500.',
    };
  }
  return {
    ...s,
    nota:
      cota === undefined
        ? 'Faltan las jornadas, o el plazo y el máximo de trabajadores para acotarlas.'
        : `El plazo por el máximo de trabajadores da ${entero(cota)}, más de 500: hay que declarar las jornadas (Σ Tᵢ × Dᵢ, con 1 día = jornada de 8 h).`,
  };
}

function supuestoD(subterraneas: boolean | undefined): Supuesto {
  const s: Supuesto = {
    letra: 'd',
    titulo: TITULOS.d,
    umbral: UMBRALES.d,
    proyecto: 'Sin declarar',
    estado: 'sin_datos',
  };
  if (subterraneas === undefined)
    return {
      ...s,
      nota: 'Falta decir si hay túneles, galerías, conducciones subterráneas o presas. Las zanjas a cielo abierto no cuentan (Guía folio 25).',
    };
  return {
    ...s,
    proyecto: subterraneas ? 'Sí' : 'No',
    estado: subterraneas ? 'supera' : 'no_supera',
  };
}

/** El aviso de cercanía (decisión 4): PEC por debajo del umbral a menos del 5 %. */
export function avisoCercaniaPec(pec: number | undefined): AvisoPec | undefined {
  if (pec === undefined) return undefined;
  const diferencia = cents(UMBRAL_PEC - pec);
  if (diferencia <= 0 || diferencia > UMBRAL_PEC * MARGEN_AVISO_PEC) return undefined;
  return { diferencia, pct: cents((diferencia / UMBRAL_PEC) * 100) };
}

/** Los cuatro supuestos del art. 4.1 sobre los datos ya derivados. */
export function evaluarSupuestos(d: DatosArt4): EvaluacionArt4 {
  const supuestos = [
    supuestoA(d.pec),
    supuestoB(d.plazoDias, d.maxTrabajadores),
    supuestoC(d.jornadas, d.plazoDias, d.maxTrabajadores),
    supuestoD(d.subterraneas),
  ];
  const superados = supuestos.filter((s) => s.estado === 'supera').map((s) => s.letra);
  const sinDatos = supuestos.filter((s) => s.estado === 'sin_datos').map((s) => s.letra);
  const resultado: ResultadoArt4 =
    superados.length > 0 ? 'completo' : sinDatos.length > 0 ? 'pendiente' : 'basico';
  const avisoPec = avisoCercaniaPec(d.pec);
  return { supuestos, superados, sinDatos, resultado, ...(avisoPec ? { avisoPec } : {}) };
}

export interface Art4 extends EvaluacionArt4 {
  pec: DesglosePec | null;
}

/** El art. 4 sobre lo que guarda el proyecto: el PEC desglosado y los supuestos. */
export function art4(e: EstudioSeguridadSalud | undefined): Art4 {
  const pec = calcularPec(e?.presupuesto);
  const m = e?.manoDeObra;
  const ev = evaluarSupuestos({
    pec: pec?.pec,
    plazoDias: m?.plazoDias,
    maxTrabajadores: m?.maxTrabajadores,
    jornadas: jornadasDeclaradas(m),
    subterraneas: e?.subterraneas,
  });
  return { pec, ...ev };
}

// ── Coordinadores (art. 3; K-SYS.11) ─────────────────────────────────────────

export type EstadoCoordinador = 'procede' | 'no_procede' | 'sin_datos';

export interface Coordinador {
  fase: 'proyecto' | 'ejecucion';
  estado: EstadoCoordinador;
  /** El motivo, para el apartado 0 («no procede» siempre lleva el suyo). */
  motivo: string;
}

export interface Coordinadores {
  proyecto: Coordinador;
  ejecucion: Coordinador;
}

/**
 * En proyecto, si intervienen varios proyectistas (art. 3.1; entonces el
 * coordinador elabora o hace que se elabore el estudio, art. 6.1). En
 * ejecución, si interviene más de una empresa, o una empresa y autónomos, o
 * varios autónomos (art. 3.2). La app no lo decide por su cuenta (decisión 13).
 */
export function coordinadores(c: Coordinacion | undefined): Coordinadores {
  const proyecto: Coordinador =
    c?.variosProyectistas === undefined
      ? {
          fase: 'proyecto',
          estado: 'sin_datos',
          motivo:
            'Falta decir si intervienen varios proyectistas en la elaboración del proyecto (art. 3.1).',
        }
      : c.variosProyectistas
        ? {
            fase: 'proyecto',
            estado: 'procede',
            motivo:
              'Intervienen varios proyectistas en la elaboración del proyecto, por lo que el promotor designa un coordinador en materia de seguridad y salud durante la elaboración del proyecto (art. 3.1); le corresponde elaborar o hacer que se elabore este estudio (art. 6.1).',
          }
        : {
            fase: 'proyecto',
            estado: 'no_procede',
            motivo:
              'No procede: en la elaboración del proyecto no intervienen varios proyectistas (art. 3.1).',
          };
  const ejecucion: Coordinador =
    c?.variasEmpresas === undefined
      ? {
          fase: 'ejecucion',
          estado: 'sin_datos',
          motivo:
            'Falta decir si en la ejecución intervendrá más de una empresa, o una empresa y trabajadores autónomos (art. 3.2).',
        }
      : c.variasEmpresas
        ? {
            fase: 'ejecucion',
            estado: 'procede',
            motivo:
              'Está previsto que en la ejecución intervenga más de una empresa, o una empresa y trabajadores autónomos, o varios trabajadores autónomos, por lo que el promotor designa un coordinador en materia de seguridad y salud durante la ejecución de la obra antes del inicio de los trabajos (art. 3.2).',
          }
        : {
            fase: 'ejecucion',
            estado: 'no_procede',
            motivo:
              'No procede: está previsto que ejecute la obra una sola empresa, sin trabajadores autónomos. Si durante la obra interviene más de una empresa, o una empresa y trabajadores autónomos, el promotor designará el coordinador tan pronto como se constate (art. 3.2).',
          };
  return { proyecto, ejecucion };
}

// ── Servicios higiénicos (K-SYS.5 y K-SYS.19) ────────────────────────────────

/** VII CGSC art. 232.2: una ducha y un lavabo por cada 10 «o fracción», simultáneos. */
export const RATIO_LAVABOS = 10;
export const RATIO_DUCHAS = 10;
/** VII CGSC art. 232.2: un retrete por cada 25 «o fracción». */
export const RATIO_RETRETES = 25;
/** Guía folios 79–80, recomendado: un retrete por cada 15 mujeres o fracción; urinario por cada 25 hombres. */
export const RATIO_RETRETES_MUJERES = 15;
export const RATIO_URINARIOS = 25;
/** VII CGSC art. 234.3: local de primeros auxilios cuando los trabajadores «supere[n] los 50». */
export const UMBRAL_LOCAL_PRIMEROS_AUXILIOS = 50;

const porFraccion = (n: number, ratio: number): number => Math.ceil(n / ratio);

export interface DotacionHigienica {
  /** n: el máximo de trabajadores a la vez (convenio art. 231.1: simultáneos, también subcontratas y autónomos). */
  trabajadores: number;
  /**
   * Obligatoria por el VII Convenio, art. 232.2. Las duchas, «cuando el tipo de
   * actividad o la salubridad lo requieran»; la Guía las recomienda siempre.
   */
  convenio: { lavabos: number; duchas: number; retretes: number };
  /** Recomendada por la Guía (folios 79–80), solo con el reparto por sexos declarado. */
  guia?: { hombres: number; mujeres: number; retretes: number; urinarios: number };
  /** Local de primeros auxilios (convenio art. 234.3), con más de 50 trabajadores. */
  localPrimerosAuxilios: boolean;
  /** Obra de corta duración o de escasa importancia: soluciones alternativas (convenio 231.4; Guía). */
  admiteAlternativa: boolean;
  /** La solución alternativa que declara el proyectista, si la hay. */
  alternativa?: string;
}

/**
 * La dotación con n trabajadores a la vez. `null` sin el dato: no se supone.
 * Los vestuarios no se cuentan: el convenio (232.1) y la Guía los piden en
 * toda obra, con la alternativa de la obra corta.
 */
export function dotacionHigienica(
  n: number | undefined,
  d?: ServiciosHigienicosDatos,
): DotacionHigienica | null {
  if (n === undefined || !(n > 0)) return null;
  const out: DotacionHigienica = {
    trabajadores: n,
    convenio: {
      lavabos: porFraccion(n, RATIO_LAVABOS),
      duchas: porFraccion(n, RATIO_DUCHAS),
      retretes: porFraccion(n, RATIO_RETRETES),
    },
    localPrimerosAuxilios: n > UMBRAL_LOCAL_PRIMEROS_AUXILIOS,
    admiteAlternativa: d?.cortaDuracion === true,
  };
  if (d?.hombres !== undefined && d.mujeres !== undefined) {
    out.guia = {
      hombres: d.hombres,
      mujeres: d.mujeres,
      retretes:
        porFraccion(d.hombres, RATIO_RETRETES) + porFraccion(d.mujeres, RATIO_RETRETES_MUJERES),
      urinarios: porFraccion(d.hombres, RATIO_URINARIOS),
    };
  }
  if (out.admiteAlternativa && d?.alternativa) out.alternativa = d.alternativa;
  return out;
}

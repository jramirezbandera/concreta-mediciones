// =============================================================================
// Los datos de la obra para el estudio básico (feature-35, paso 1). PURO.
//
// Lectura saneada de lo guardado, las ayudas de la mano de obra (estimación de
// trabajadores, jornadas por periodos) y lo que falta para redactar el estudio.
// El motor del art. 4 (PEC, supuestos, coordinadores, servicios higiénicos) es
// el paso 2, en `art4.ts`.
// =============================================================================

import {
  CLAVES_RIESGO,
  ESTADOS_AMIANTO,
  SERVICIOS_AFECTADOS,
  type Amianto,
  type CentroAsistencial,
  type ClaveRiesgo,
  type Coordinacion,
  type EdicionFicha,
  type EdicionLista,
  type Entorno,
  type EstadoAmianto,
  type EstimacionTrabajadores,
  type EstudioSeguridadSalud,
  type ManoDeObra,
  type MediosObra,
  type PeriodoObra,
  type PresupuestoObra,
  type RiesgoAnadido,
  type SeleccionFichas,
  type ServicioAfectado,
  type ServiciosHigienicosDatos,
} from './tipos';

/** Horas de una jornada: «un día de trabajo equivale a una jornada de 8 horas» (Guía folio 25). */
export const HORAS_JORNADA = 8;

/** Umbral de jornadas del art. 4.1 c): «superior a 500». */
export const UMBRAL_JORNADAS = 500;

// ── Lectura saneada ──────────────────────────────────────────────────────────

type Obj = Record<string, unknown>;

const esObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const texto = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
const noNegativo = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
const positivo = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;
const entero = (v: unknown): number | undefined => {
  const n = positivo(v);
  return n !== undefined && Number.isInteger(n) ? n : undefined;
};
const enteroNoNegativo = (v: unknown): number | undefined => {
  const n = noNegativo(v);
  return n !== undefined && Number.isInteger(n) ? n : undefined;
};
const booleano = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const textos = (v: unknown): string[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const xs = [...new Set(v.map(texto).filter((x): x is string => x !== undefined))];
  return xs.length > 0 ? xs : undefined;
};
const esClave = (v: unknown): v is ClaveRiesgo =>
  typeof v === 'string' && (CLAVES_RIESGO as readonly string[]).includes(v);
const esEstadoAmianto = (v: unknown): v is EstadoAmianto =>
  typeof v === 'string' && (ESTADOS_AMIANTO as readonly string[]).includes(v);
const esServicio = (v: string): v is ServicioAfectado =>
  (SERVICIOS_AFECTADOS as readonly string[]).includes(v);

/** El objeto sin las claves `undefined`, o `undefined` si no queda ninguna. */
function compacto<T extends object>(o: T): T | undefined {
  const limpio = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
  return Object.keys(limpio).length > 0 ? limpio : undefined;
}

function parsePresupuesto(r: unknown): PresupuestoObra | undefined {
  if (!esObj(r)) return undefined;
  return compacto({
    pem: positivo(r.pem),
    gg_pct: noNegativo(r.gg_pct),
    bi_pct: noNegativo(r.bi_pct),
    iva_pct: noNegativo(r.iva_pct),
  });
}

function parseEstimacion(r: unknown): EstimacionTrabajadores | undefined {
  if (!esObj(r)) return undefined;
  const pct = positivo(r.manoObra_pct);
  return compacto({
    manoObra_pct: pct !== undefined && pct <= 100 ? pct : undefined,
    costeHora: positivo(r.costeHora),
  });
}

function parsePeriodo(r: unknown): PeriodoObra | null {
  if (!esObj(r)) return null;
  const trabajadores = entero(r.trabajadores);
  const dias = entero(r.dias);
  if (trabajadores === undefined || dias === undefined) return null;
  const descripcion = texto(r.descripcion);
  return { ...(descripcion ? { descripcion } : {}), trabajadores, dias };
}

function parseManoDeObra(r: unknown): ManoDeObra | undefined {
  if (!esObj(r)) return undefined;
  const periodos = Array.isArray(r.periodos)
    ? r.periodos.map(parsePeriodo).filter((x): x is PeriodoObra => x !== null)
    : [];
  return compacto({
    plazoDias: entero(r.plazoDias),
    maxTrabajadores: entero(r.maxTrabajadores),
    estimacion: parseEstimacion(r.estimacion),
    jornadas: entero(r.jornadas),
    periodos: periodos.length > 0 ? periodos : undefined,
  });
}

function parseAmianto(r: unknown): Amianto | undefined {
  if (!esObj(r) || !esEstadoAmianto(r.estado)) return undefined;
  const a: Amianto = { estado: r.estado };
  const ubicacion = texto(r.ubicacion);
  if (ubicacion) a.ubicacion = ubicacion;
  const friable = booleano(r.friable);
  if (friable !== undefined) a.friable = friable;
  return a;
}

function parseCoordinacion(r: unknown): Coordinacion | undefined {
  if (!esObj(r)) return undefined;
  return compacto({
    variosProyectistas: booleano(r.variosProyectistas),
    variasEmpresas: booleano(r.variasEmpresas),
    cabezaFamilia: booleano(r.cabezaFamilia),
  });
}

function parseCentro(r: unknown): CentroAsistencial | undefined {
  if (!esObj(r)) return undefined;
  const nombre = texto(r.nombre);
  if (!nombre) return undefined;
  return {
    nombre,
    ...compacto({
      direccion: texto(r.direccion),
      distancia_km: positivo(r.distancia_km),
      tiempo_min: positivo(r.tiempo_min),
    }),
  };
}

function parseEntorno(r: unknown): Entorno | undefined {
  if (!esObj(r)) return undefined;
  let servicios: Entorno['servicios'];
  if (esObj(r.servicios)) {
    const s: Partial<Record<ServicioAfectado, boolean>> = {};
    for (const [k, v] of Object.entries(r.servicios))
      if (esServicio(k) && typeof v === 'boolean') s[k] = v;
    servicios = Object.keys(s).length > 0 ? s : undefined;
  }
  return compacto({
    centroAsistencial: parseCentro(r.centroAsistencial),
    edificioEnUso: booleano(r.edificioEnUso),
    viaPublica: booleano(r.viaPublica),
    servicios,
    tensionLineas_kV: positivo(r.tensionLineas_kV),
  });
}

function parseMedios(r: unknown): MediosObra | undefined {
  if (!esObj(r)) return undefined;
  return compacto({ gruaTorre: booleano(r.gruaTorre), gruaMovil: booleano(r.gruaMovil) });
}

function parseServiciosHigienicos(r: unknown): ServiciosHigienicosDatos | undefined {
  if (!esObj(r)) return undefined;
  return compacto({
    cortaDuracion: booleano(r.cortaDuracion),
    alternativa: texto(r.alternativa),
    hombres: enteroNoNegativo(r.hombres),
    mujeres: enteroNoNegativo(r.mujeres),
  });
}

function parseEdicionLista(r: unknown): EdicionLista | undefined {
  if (!esObj(r)) return undefined;
  return compacto({ quitados: textos(r.quitados), anadidos: textos(r.anadidos) });
}

function parseEdicionFicha(r: unknown): EdicionFicha | undefined {
  if (!esObj(r)) return undefined;
  let riesgos: EdicionFicha['riesgos'];
  if (esObj(r.riesgos)) {
    const quitados = Array.isArray(r.riesgos.quitados)
      ? [...new Set(r.riesgos.quitados.filter(esClave))]
      : [];
    const anadidos: RiesgoAnadido[] = Array.isArray(r.riesgos.anadidos)
      ? r.riesgos.anadidos.flatMap((x: unknown) => {
          if (!esObj(x) || !esClave(x.clave)) return [];
          const causa = texto(x.causa);
          return [{ clave: x.clave, ...(causa ? { causa } : {}) }];
        })
      : [];
    riesgos = compacto({
      quitados: quitados.length > 0 ? quitados : undefined,
      anadidos: anadidos.length > 0 ? anadidos : undefined,
    });
  }
  return compacto({
    riesgos,
    medidas: parseEdicionLista(r.medidas),
    protecciones: parseEdicionLista(r.protecciones),
    epi: parseEdicionLista(r.epi),
    revisada: r.revisada === true ? true : undefined,
  });
}

function parseSeleccion(r: unknown): SeleccionFichas | undefined {
  if (!esObj(r)) return undefined;
  let ediciones: SeleccionFichas['ediciones'];
  if (esObj(r.ediciones)) {
    const e: Record<string, EdicionFicha> = {};
    for (const [id, v] of Object.entries(r.ediciones)) {
      const ed = texto(id) ? parseEdicionFicha(v) : undefined;
      if (ed) e[id] = ed;
    }
    ediciones = Object.keys(e).length > 0 ? e : undefined;
  }
  return compacto({ anadidas: textos(r.anadidas), quitadas: textos(r.quitadas), ediciones });
}

/**
 * Lo guardado en `Proyecto.seguridadSalud`, sin lo que no tiene forma. Un dato
 * mal formado se descarta (y sale pendiente), no rompe la pantalla ni el
 * documento. Nunca lanza.
 */
export function parseSeguridadSalud(raw: unknown): EstudioSeguridadSalud | undefined {
  if (!esObj(raw)) return undefined;
  return compacto({
    presupuesto: parsePresupuesto(raw.presupuesto),
    manoDeObra: parseManoDeObra(raw.manoDeObra),
    subterraneas: booleano(raw.subterraneas),
    demolicionPrevia: booleano(raw.demolicionPrevia),
    amianto: parseAmianto(raw.amianto),
    coordinacion: parseCoordinacion(raw.coordinacion),
    entorno: parseEntorno(raw.entorno),
    medios: parseMedios(raw.medios),
    serviciosHigienicos: parseServiciosHigienicos(raw.serviciosHigienicos),
    seleccion: parseSeleccion(raw.seleccion),
    planos: texto(raw.planos),
  });
}

// ── Mano de obra ─────────────────────────────────────────────────────────────

/** Σ Tᵢ × Dᵢ de la tabla de periodos (Guía folio 25). */
export function jornadasDePeriodos(periodos: readonly PeriodoObra[]): number {
  return periodos.reduce((a, p) => a + p.trabajadores * p.dias, 0);
}

/**
 * La cota de las jornadas: plazo × máximo a la vez (K-SYS.2, INTERPRETACIÓN
 * aritmética). `undefined` sin uno de los dos datos.
 */
export function cotaJornadas(m: ManoDeObra | undefined): number | undefined {
  if (m?.plazoDias === undefined || m.maxTrabajadores === undefined) return undefined;
  return m.plazoDias * m.maxTrabajadores;
}

/** Hay que declarar las jornadas: la cota pasa de 500 y el supuesto c) no se descarta solo. */
export function pideJornadas(m: ManoDeObra | undefined): boolean {
  const cota = cotaJornadas(m);
  return cota !== undefined && cota > UMBRAL_JORNADAS;
}

/** Las jornadas que declara el proyectista: la suma de la tabla si la hay, o el número. */
export function jornadasDeclaradas(m: ManoDeObra | undefined): number | undefined {
  if (m?.periodos && m.periodos.length > 0) return jornadasDePeriodos(m.periodos);
  return m?.jornadas;
}

/** Lo que da la ayuda para estimar los trabajadores (decisión 3). */
export interface EstimacionResultado {
  /** Jornadas de 8 h que paga la mano de obra del PEM, redondeadas. */
  jornadas: number;
  /**
   * Trabajadores de media durante el plazo, por exceso. Es una MEDIA: el
   * máximo a la vez, que es el dato del art. 4.1 b), suele ser mayor (ss01
   * usaba la media como punta, analisis §5).
   */
  trabajadoresMedios: number;
}

/**
 * Estimación desde el PEM: jornadas = PEM × % mano de obra / (€/h × 8 h), y la
 * media = jornadas / plazo. `null` sin PEM, porcentaje, coste o plazo. No es
 * dato del proyecto: la ayuda lo propone y el proyectista confirma el suyo.
 */
export function estimarTrabajadores(
  pem: number | undefined,
  est: EstimacionTrabajadores | undefined,
  plazoDias: number | undefined,
): EstimacionResultado | null {
  if (
    pem === undefined ||
    pem <= 0 ||
    !est?.manoObra_pct ||
    !est.costeHora ||
    !plazoDias ||
    plazoDias <= 0
  )
    return null;
  const jornadas = (pem * est.manoObra_pct) / 100 / (est.costeHora * HORAS_JORNADA);
  return {
    jornadas: Math.round(jornadas),
    trabajadoresMedios: Math.max(1, Math.ceil(jornadas / plazoDias)),
  };
}

// ── Lo que pide la obra ──────────────────────────────────────────────────────

/** Un dato que falta para redactar el estudio (va a «Antes de entregar», en ámbar). */
export interface PendienteDato {
  id: string;
  texto: string;
}

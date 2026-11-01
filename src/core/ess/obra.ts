/* ===========================================================================
   core/ess/obra — lo que el estudio de seguridad y salud lee de la obra
   (docs/plan-seguridad-salud.md, §Datos y E1). PURO.

   El estudio guarda poco (`EstudioSsDatos`); el resto ya lo sabe la obra:
     · el PEM del presupuesto (o el de toda la obra que declaró residuos, D3),
       sin el capítulo de seguridad y salud enlazado, y GG, BI e IVA de `rates`;
     · el amianto y el tipo de obra del estudio de residuos, si lo hay (D4);
     · las horas de mano de obra de los descompuestos, para medir las jornadas.
   `estudioDe` lo junta en la forma que leen el art. 4 y el documento.
   =========================================================================== */
import { partidaCantidad, partidaImporte } from '../medicion';
import type { EstudioRcdDatos } from '../rcd/tipos';
import { costesDirectos, pem as pemDe } from '../totales';
import type { Banco, Chapter, Obra, PartidasMap, Rates } from '../types';
import { HORAS_JORNADA, type PendienteDato, pideJornadas, jornadasDeclaradas } from './datos';
import { enCapitulo } from './guardado';
import {
  SERVICIOS_AFECTADOS,
  type Amianto,
  type EstadoAmianto,
  type EstudioSeguridadSalud,
  type EstudioSsDatos,
  type PresupuestoObra,
  type TipoObraEss,
} from './tipos';

export { capituloSsPropuesto, enCapitulo, estudioSsVacio } from './guardado';

/** Lo que lee el estudio de la obra abierta. */
export interface EntradaEss {
  chapters: Chapter[];
  partidas: PartidasMap;
  banco: Banco;
  rates: Rates;
  obra: Obra;
  estudioRcd?: EstudioRcdDatos;
  datos: EstudioSsDatos;
}

// ── Presupuesto (art. 4.1 a) ─────────────────────────────────────────────────

/** Una fracción de `rates` como porcentaje, sin el ruido de coma flotante (0,13 → 13). */
const pct = (f: number): number => Math.round(f * 1e6) / 1e4;

export interface PemEss {
  /** PEM con el que se calcula el PEC (€), o `undefined` si no hay. */
  pem: number | undefined;
  /** De dónde sale: el presupuesto o el que declaró el estudio de residuos. */
  origen: 'presupuesto' | 'residuos' | null;
  /** PEM del capítulo de seguridad y salud enlazado (€), que no cuenta para el art. 4. */
  pemSs: number;
}

/**
 * PEM para el art. 4. El de toda la obra que declaró residuos (proyecto básico
 * que no lo mide entero, D3) manda; si no, el del presupuesto sin el capítulo
 * de seguridad y salud enlazado. INTERPRETACIÓN: el art. 4.1 a) habla del
 * presupuesto «incluido en el proyecto»; el del estudio se calcula sobre él
 * (Guía folio 31), así que no se cuenta dos veces.
 */
export function pemEss(
  e: Pick<EntradaEss, 'chapters' | 'partidas' | 'rates' | 'estudioRcd' | 'datos'>,
): PemEss {
  let ssCents = 0;
  for (const ch of e.chapters)
    for (const p of e.partidas[ch.id] ?? [])
      if (enCapitulo(e.chapters, e.datos.capituloSs, ch.id, p))
        ssCents += pemDe(partidaImporte(p, e.rates.coefK), e.rates);
  const pemSs = ssCents / 100;
  const declarado = e.estudioRcd?.pemObra;
  if (declarado != null && declarado > 0) return { pem: declarado, origen: 'residuos', pemSs };
  const cents = pemDe(costesDirectos(e.partidas, e.rates.coefK), e.rates) - ssCents;
  return cents > 0
    ? { pem: cents / 100, origen: 'presupuesto', pemSs }
    : { pem: undefined, origen: null, pemSs };
}

/** El presupuesto para `calcularPec`: PEM de `pemEss` y los porcentajes de la obra. */
export function presupuestoDeObra(
  e: Pick<EntradaEss, 'chapters' | 'partidas' | 'rates' | 'estudioRcd' | 'datos'>,
): PresupuestoObra {
  const out: PresupuestoObra = {
    gg_pct: pct(e.rates.gg),
    bi_pct: pct(e.rates.bi),
    iva_pct: pct(e.rates.iva),
  };
  const { pem } = pemEss(e);
  if (pem !== undefined) out.pem = pem;
  return out;
}

// ── Jornadas medidas desde la mano de obra (art. 4.1 c) ──────────────────────

export interface JornadasMedidas {
  /** Σ cantidad × rendimiento de la mano de obra en horas. */
  horas: number;
  /** horas ÷ 8 (Guía folio 25), redondeado. */
  jornadas: number;
  /** PEM de las partidas con mano de obra en su descompuesto (€). */
  pemConMo: number;
  /** PEM de todas las partidas (€): si es mayor, la medida se queda corta. */
  pemTotal: number;
}

/**
 * Las jornadas que paga el presupuesto: Σ cantidad × horas de mano de obra del
 * descompuesto ÷ 8. Solo cuenta la mano de obra en horas (`h`). Es una AYUDA:
 * las partidas sin descompuesto no suman, y el técnico confirma las suyas.
 * `null` si ninguna partida tiene mano de obra en horas.
 */
export function jornadasMedidas(
  e: Pick<EntradaEss, 'partidas' | 'banco' | 'rates'>,
): JornadasMedidas | null {
  let horas = 0;
  let conMo = 0;
  let total = 0;
  for (const ps of Object.values(e.partidas))
    for (const p of ps ?? []) {
      const imp = pemDe(partidaImporte(p, e.rates.coefK), e.rates);
      total += imp;
      let h = 0;
      for (const it of p.items) {
        if (it.type !== 'MO') continue;
        const ud = (it.ud ?? e.banco[it.code]?.ud ?? '').trim().toLowerCase();
        if (ud === 'h' || ud === 'hr' || ud === 'hora' || ud === 'horas') h += it.cantidad;
      }
      if (h > 0) {
        horas += h * partidaCantidad(p);
        conMo += imp;
      }
    }
  if (!(horas > 0)) return null;
  return {
    horas: Math.round(horas * 100) / 100,
    jornadas: Math.round(horas / HORAS_JORNADA),
    pemConMo: conMo / 100,
    pemTotal: total / 100,
  };
}

// ── Amianto y tipo de obra (D4) ──────────────────────────────────────────────

const AMIANTO_RCD: Record<NonNullable<EstudioRcdDatos['amianto']>, EstadoAmianto> = {
  no: 'no_identificado',
  posible: 'posible',
  identificado: 'identificado',
};

/** Tipos de obra: los del estudio de residuos si lo hay; si no, los de este estudio. */
export function tiposDe(e: Pick<EntradaEss, 'estudioRcd' | 'datos'>): TipoObraEss[] {
  return e.estudioRcd ? e.estudioRcd.tipos : (e.datos.tipos ?? []);
}

/** Hay edificio existente (reforma o demolición): pide amianto y edificio en uso. */
export function sobreExistente(tipos: readonly TipoObraEss[]): boolean {
  return tipos.includes('reforma') || tipos.includes('demolicion');
}

/**
 * El amianto declarado. Con estudio de residuos, el estado y dónde está salen
 * de él (una sola declaración por obra); la friabilidad, de este estudio.
 */
export function amiantoDe(e: Pick<EntradaEss, 'estudioRcd' | 'datos'>): Amianto | undefined {
  const propio = e.datos.amianto;
  const rcd = e.estudioRcd;
  if (!rcd) return propio;
  if (rcd.amianto == null) return undefined;
  const out: Amianto = { estado: AMIANTO_RCD[rcd.amianto] };
  const ubicacion = rcd.amiantoElementos?.trim() || propio?.ubicacion;
  if (ubicacion) out.ubicacion = ubicacion;
  if (propio?.friable !== undefined) out.friable = propio.friable;
  return out;
}

// ── El estudio para el art. 4 y el documento ─────────────────────────────────

/** El estudio en la forma que leen `art4` y el documento. */
export function estudioDe(e: EntradaEss): EstudioSeguridadSalud {
  const d = e.datos;
  const tipos = tiposDe(e);
  const out: EstudioSeguridadSalud = { presupuesto: presupuestoDeObra(e) };
  if (d.manoDeObra) out.manoDeObra = d.manoDeObra;
  if (d.subterraneas !== undefined) out.subterraneas = d.subterraneas;
  if (tipos.includes('nueva') && tipos.includes('demolicion')) out.demolicionPrevia = true;
  const amianto = amiantoDe(e);
  if (amianto) out.amianto = amianto;
  if (d.coordinacion) out.coordinacion = d.coordinacion;
  if (d.entorno) out.entorno = d.entorno;
  if (d.medios) out.medios = d.medios;
  if (d.serviciosHigienicos) out.serviciosHigienicos = d.serviciosHigienicos;
  if (d.seleccion) out.seleccion = d.seleccion;
  if (d.planos) out.planos = d.planos;
  return out;
}

/**
 * Lo que falta para redactar el estudio (lo que depende de la obra no se
 * supone). El orden es el del documento. La selección de fichas y las fichas
 * sin revisar se cuentan aparte, con el catálogo (`seleccion`).
 */
export function pendientesDatosEss(e: EntradaEss): PendienteDato[] {
  const d = e.datos;
  const out: PendienteDato[] = [];
  const falta = (id: string, texto: string) => out.push({ id, texto });
  const tipos = tiposDe(e);

  if (!tipos.length) falta('tipos', 'Falta el tipo de obra: nueva, reforma o demolición.');
  if (pemEss(e).pem === undefined)
    falta('pem', 'El presupuesto no tiene PEM: el art. 4 no se puede justificar.');
  const m = d.manoDeObra;
  if (m?.plazoDias === undefined) falta('plazo', 'Falta el plazo de ejecución en días laborables.');
  if (m?.maxTrabajadores === undefined)
    falta('trabajadores', 'Falta el número máximo de trabajadores a la vez.');
  if (pideJornadas(m) && jornadasDeclaradas(m) === undefined)
    falta(
      'jornadas',
      'El plazo por el máximo de trabajadores pasa de 500: faltan las jornadas de la obra (art. 4.1 c).',
    );
  if (d.subterraneas === undefined)
    falta(
      'subterraneas',
      'Falta decir si hay túneles, galerías, conducciones subterráneas o presas (art. 4.1 d).',
    );

  const c = d.coordinacion;
  if (c?.variosProyectistas === undefined)
    falta(
      'varios-proyectistas',
      'Falta decir si intervienen varios proyectistas (coordinador en proyecto).',
    );
  if (c?.variasEmpresas === undefined)
    falta(
      'varias-empresas',
      'Falta decir si intervienen varias empresas, o empresa y autónomos (coordinador en ejecución).',
    );

  const en = d.entorno;
  if (!en?.centroAsistencial) falta('centro', 'Falta el centro asistencial más próximo.');
  if (SERVICIOS_AFECTADOS.some((s) => en?.servicios?.[s] === undefined))
    falta('servicios', 'Falta declarar los servicios afectados (existe / no existe).');
  if (en?.servicios?.linea_aerea === true && en.tensionLineas_kV === undefined)
    falta(
      'tension',
      'Falta la tensión de las líneas aéreas próximas, para las distancias del RD 614/2001.',
    );
  if (en?.viaPublica === undefined) falta('via-publica', 'Falta decir si se ocupa la vía pública.');
  if (sobreExistente(tipos) && en?.edificioEnUso === undefined)
    falta('en-uso', 'Falta decir si el edificio o el local sigue en uso durante la obra.');

  if (sobreExistente(tipos) && !amiantoDe(e))
    falta(
      'amianto',
      e.estudioRcd
        ? 'Falta declarar el amianto en el estudio de residuos: obligatorio en obra sobre edificio existente (RD 396/2006, art. 10.2).'
        : 'Falta declarar el amianto: obligatorio en obra sobre edificio existente (RD 396/2006, art. 10.2).',
    );
  if (!d.redactor?.nombre.trim())
    falta('redactor', 'Falta el técnico que redacta y firma el estudio.');
  return out;
}

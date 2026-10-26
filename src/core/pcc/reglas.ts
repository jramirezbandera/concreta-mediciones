/* ===========================================================================
   core/pcc/reglas — propuesta automática del control de una partida.

   Nada se confirma solo (§4 del plan): las reglas dejan `estado: 'propuesta'`
   con su motivo, como en residuos. De la más concreta a la más general:
     · el capítulo de control enlazado: `capituloControl`;
     · exclusiones por código o por el TÍTULO (residuos, seguridad y salud,
       demoliciones, transportes, alquileres, hormigón de limpieza): sin
       control (K-PCC.70). Solo el título: en la descripción casi todas las
       partidas dicen «medios auxiliares» o «mano de obra»;
     · hormigón: la designación (T-R/C/TM/A) en el título o en la descripción
       y el tipo de elemento (fila de la tabla 57.5.4.1). Un HM sin función
       estructural (solera, relleno, pendientes) no tiene control;
     · el resto de familias, por el prefijo de banco (BCCA, Precio Centro)
       o por el título, con la unidad como filtro.
   De la descomposición salen los m³ de hormigón por unidad de un forjado en
   m² y los kg de acero de un hormigón «incluso armadura» (O3).
   =========================================================================== */
import { huellaCambia, huellaDe } from '../huella';
import type { Banco, Item, Partida } from '../types';
import { textoDe } from '../rcd/reglas';
import { unidadPcc } from './unidades';
import { leerDesignacion } from './hormigon';
import familiasJson from './tablas/familias.json';
import type { AceroPartida, ControlPartida, FilaLote, HormigonPartida } from './tipos';

export { textoDe };

interface Reconocer {
  codigo?: string;
  texto?: string;
  ud?: string[];
  no?: string;
}
interface FamiliaDef {
  id: string;
  nombre: string;
  reconocer: Reconocer;
  estructura?: string;
}

/** Texto en minúsculas y sin tildes, como `textoDe`, de una cadena suelta. */
export function normaliza(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

const RE = (s: string | undefined): RegExp | null => (s ? new RegExp(s) : null);

const FAMILIAS = (familiasJson.familias as FamiliaDef[]).map((f) => ({
  ...f,
  codigo: RE(f.reconocer.codigo),
  texto: RE(f.reconocer.texto),
  no: RE(f.reconocer.no),
}));
const EXCLUIR = familiasJson.excluir.map((x) => ({ ...x, codigoRe: RE(x.codigo), textoRe: RE(x.texto) }));

export function familiaDef(id: string): FamiliaDef | undefined {
  return FAMILIAS.find((f) => f.id === id);
}

/* ---- hormigón --------------------------------------------------------------- */

const CIMENTACION = /\b(cimentaci|zapata|encepado|cimiento|riostra|recalce|pozo de cimentacion|losa de cimentacion)/;
const PILARES_MUROS = /\b(pilar|soporte|muro|pantalla)/;
const FLEXION = /\b(forjado|viga|jacena|losa|zuncho|escalera|rampa|solera|voladizo|brochal|zanca|meseta|dintel)/;
/** HM con función estructural: cimientos, recalces, muros y pilares de hormigón en masa. */
const HM_ESTRUCTURAL = /\b(cimentaci|zapata|cimiento|recalce|muro|pilar|encepado)/;
/** Hormigón sin función estructural, aunque el texto nombre un elemento. */
const SIN_FUNCION = /\b(limpieza|relleno|nivelacion|pendientes?|recrecido|solera)\b/;

/** Tipo de elemento por el texto, de lo más concreto (cimentación) a lo más general. */
export function filaDe(t: string): FilaLote | undefined {
  if (CIMENTACION.test(t)) return 'cim_superficial';
  if (PILARES_MUROS.test(t)) return 'pilares_muros';
  if (FLEXION.test(t)) return 'flexion';
  return undefined;
}

/** Diámetros en mm del texto: «Ø8», «Ø 10 y 12 mm», «D=6 mm», «diám. 16». */
export function diametrosDe(texto: string): number[] {
  const out = new Set<number>();
  const re = /(?:ø|Ø|diam\.?|diametros?|\bd\s*=)\s*((?:\d{1,2}(?:\s*(?:,|y|-|\/)\s*)?)+)(?:\s*mm)?/gi;
  for (const m of texto.matchAll(re))
    for (const n of m[1]!.split(/\s*(?:,|y|-|\/)\s*/)) {
      const d = Number(n);
      if (d >= 4 && d <= 50) out.add(d);
    }
  return [...out].sort((a, b) => a - b);
}

interface Recurso {
  type: string;
  desc: string;
  ud: string;
  cantidad: number;
}
function recursos(items: Item[] | undefined, banco: Banco | undefined): Recurso[] {
  return (items ?? []).map((it) => {
    const r = banco?.[it.code];
    return { type: it.type, desc: it.desc ?? r?.desc ?? '', ud: it.ud ?? r?.ud ?? '', cantidad: it.cantidad };
  });
}

/** m³ de hormigón y kg de acero por unidad, de la descomposición (O3). */
export function desdeDescomposicion(items: Item[] | undefined, banco?: Banco): { m3PorUd: number | null; kgPorUd: number | null } {
  let m3: number | null = null;
  let kg: number | null = null;
  for (const r of recursos(items, banco)) {
    if (r.type !== 'MAT' || !(r.cantidad > 0)) continue;
    const t = normaliza(r.desc);
    const u = unidadPcc(r.ud);
    if (u === 'm3' && (leerDesignacion(r.desc) || /\bhormigon\b/.test(t))) m3 = (m3 ?? 0) + r.cantidad;
    else if ((u === 'kg' || u === 't') && /\b(acero|b ?[45]00 ?s|corrugad|malla|ferralla)/.test(t))
      kg = (kg ?? 0) + r.cantidad * (u === 't' ? 1000 : 1);
  }
  return { m3PorUd: m3, kgPorUd: kg };
}

/* ---- propuesta -------------------------------------------------------------- */

export type PartidaRegla = Pick<Partida, 'code' | 'title' | 'desc' | 'ud'> & { items?: Item[] };

export interface ContextoRegla {
  banco?: Banco;
  /** La partida está en el capítulo de control enlazado. */
  enCapituloControl?: boolean;
}

const propuesta = (ref: string, motivo: string, extra: Partial<ControlPartida> = {}): ControlPartida => ({
  estado: 'propuesta',
  origen: { tipo: 'regla', ref, motivo },
  ...extra,
});

/**
 * Propuesta para una partida, o `null` si ninguna regla la reconoce. Una
 * propuesta sin `familia` es «sin control» al confirmarla.
 */
export function proponerControl(p: PartidaRegla, ctx: ContextoRegla = {}): ControlPartida | null {
  if (ctx.enCapituloControl)
    return { estado: 'capituloControl', origen: { tipo: 'regla', ref: 'capitulo', motivo: 'Partida del capítulo de control de calidad' } };
  const code = p.code.toUpperCase();
  const titulo = normaliza(p.title);
  const todo = textoDe(p);
  const u = unidadPcc(p.ud);

  for (const x of EXCLUIR)
    if (x.codigoRe?.test(code) || x.textoRe?.test(titulo)) return propuesta(x.id, x.motivo);

  // Cimentaciones profundas antes que el hormigón: su hormigón no se lotifica por la tabla
  // 57.5.4.1 (el Código Estructural, art. 26, las deja fuera).
  const profunda = buscarFamilia(code, titulo, u, (f) => PROFUNDAS.has(f.id));
  if (profunda) return profunda;

  // Hormigón: la designación manda sobre el resto de familias (forjados aparte).
  // En la descripción solo cuenta si el título dice qué elemento es: una arqueta o un pozo de
  // registro traen «HA-25» en su texto y no son estructura.
  const lectura =
    leerDesignacion(p.title) ?? (filaDe(titulo) || /^(03H|05H|E04|E05H)/.test(code) ? leerDesignacion(p.desc ?? '') : null);
  if (lectura) {
    const d = lectura.designacion;
    if (d.tipo === 'HM' && !HM_ESTRUCTURAL.test(titulo))
      return propuesta('hm-no-estructural', `${d.texto} sin función estructural (solera, relleno, pendientes): sin control (K-PCC.70)`);
    const forjado = FAMILIAS.find((f) => f.id === 'forjado-viguetas')!;
    const familia = forjado.codigo?.test(code) || forjado.texto?.test(titulo) ? 'forjado-viguetas' : 'hormigon-estructural';
    const fila = filaDe(titulo) ?? (/^(03H|E04)/.test(code) ? 'cim_superficial' : filaDe(todo));
    const desc = desdeDescomposicion(p.items, ctx.banco);
    const hormigon: HormigonPartida = { designacion: d, ...(fila ? { fila } : {}) };
    if (u !== 'm3') hormigon.m3PorUd = desc.m3PorUd;
    const cuantia = /\bcuantia (aproximada )?(de )?(\d+(?:[.,]\d+)?) ?kg\/m/.exec(todo);
    const kgPorUd = desc.kgPorUd ?? (cuantia && u === 'm3' ? Number(cuantia[3]!.replace(',', '.')) : null);
    const extra: Partial<ControlPartida> = { familia, hormigon };
    if (kgPorUd != null) extra.acero = { tipo: 'barras', kgPorUd };
    const origen = desc.m3PorUd != null && u !== 'm3' ? 'descomposicion' : 'regla';
    const c = propuesta(
      familia,
      `${d.texto}${fila ? ` · ${etiquetaFila(fila)}` : ''}${u !== 'm3' && desc.m3PorUd != null ? ` · ${desc.m3PorUd} m³/${p.ud} de la descomposición` : ''}`,
      extra,
    );
    c.origen.tipo = origen;
    return c;
  }

  // Hormigón de la estructura sin designación legible («HX-2O», «HA» a secas): se propone sin
  // datos de hormigón, para que no se pierda en silencio; no cuenta en los lotes hasta que se
  // escriba la designación (Q2). Los forjados siguen su familia.
  const forjado = FAMILIAS.find((f) => f.id === 'forjado-viguetas')!;
  const hormigon = FAMILIAS.find((f) => f.id === 'hormigon-estructural')!;
  if (
    !forjado.codigo?.test(code) &&
    !forjado.texto?.test(titulo) &&
    (hormigon.codigo?.test(code) || (/^hormigon\b/.test(titulo) && !!filaDe(titulo))) &&
    !SIN_FUNCION.test(titulo)
  )
    return propuesta('hormigon-estructural', 'Hormigón de la estructura sin designación legible: escríbela (HA-25/B/20/XC2) para contarlo en los lotes', {
      familia: 'hormigon-estructural',
    });

  return buscarFamilia(code, titulo, u, (f) => f.id !== 'hormigon-estructural', todo, p.code);
}

const PROFUNDAS = new Set(['micropilotes', 'pilotes', 'pantallas']);

/** Primero por el prefijo de banco (más preciso); si ninguno casa, por el título. */
function buscarFamilia(
  code: string,
  titulo: string,
  u: string,
  admite: (f: (typeof FAMILIAS)[number]) => boolean,
  todo = titulo,
  codigoOriginal = code,
): ControlPartida | null {
  const candidatas = FAMILIAS.filter((f) => admite(f) && (!f.reconocer.ud || f.reconocer.ud.includes(u)) && !f.no?.test(titulo));
  const porCodigo = candidatas.find((f) => f.codigo?.test(code));
  const f = porCodigo ?? candidatas.find((x) => x.texto?.test(titulo));
  if (!f) return null;
  const extra: Partial<ControlPartida> = { familia: f.id };
  if (f.id === 'acero-armar' || f.id === 'mallas') extra.acero = aceroDe(f.id, todo);
  return propuesta(f.id, `${f.nombre} (${porCodigo ? `código ${codigoOriginal}` : 'por el título'})`, extra);
}

function aceroDe(familia: string, t: string): AceroPartida {
  const tipo: AceroPartida['tipo'] = familia === 'mallas' ? 'mallas' : /\b(ferralla|armadura elaborada)/.test(t) ? 'ferralla' : 'barras';
  const diametros = diametrosDe(t);
  return { tipo, ...(diametros.length ? { diametros } : {}) };
}

function etiquetaFila(f: FilaLote): string {
  return {
    cim_superficial: 'cimentación',
    cim_mayor_200: 'cimentación de más de 200 m³',
    flexion: 'elemento a flexión',
    pilares_muros: 'pilares y muros',
    otros_compresion: 'otros a compresión',
  }[f];
}

/** Estado al confirmar una propuesta: «sinControl» cuando no trae familia. */
export function estadoTrasConfirmar(c: ControlPartida): ControlPartida['estado'] {
  return c.familia || c.hormigon || c.acero ? 'confirmada' : 'sinControl';
}

/** Huella de la partida al confirmar (O6). */
export { huellaDe };

/** ¿La partida ha cambiado desde que se confirmó? Sin huella, no hay con qué comparar. */
export function necesitaRevision(c: ControlPartida, p: Pick<Partida, 'code' | 'title' | 'desc' | 'ud'>): boolean {
  return c.estado === 'confirmada' && huellaCambia(c.huella, p);
}

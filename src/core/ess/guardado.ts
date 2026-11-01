/* ===========================================================================
   core/ess/guardado — forma de lo que se guarda del estudio de seguridad y
   salud (esquema v11): el estudio vacío, el capítulo propuesto y la
   comprobación al cargar. Ligero: lo importan el store y el esquema (chunk
   principal); el catálogo, las reglas y el documento van con la vista.

   Como residuos y calidad, un `seguridadSalud` mal formado NUNCA manda la obra
   a recuperación: se aparta a `_ilegible` con su valor crudo y la obra se
   abre sin él. Lo que se lee se sanea con `parseSeguridadSalud` (de
   concreta-instalaciones): un dato sin forma se descarta y sale pendiente.
   =========================================================================== */
import { findNode, subtreeIds } from '../tree';
import type { Chapter, Ilegible, Partida } from '../types';
import { parseSeguridadSalud } from './datos';
import type { EstudioSsDatos, RedactorEss, TipoObraEss } from './tipos';

/** Estudio recién empezado: nada supuesto (lo que falta sale pendiente). */
export function estudioSsVacio(over: Partial<EstudioSsDatos> = {}): EstudioSsDatos {
  return { version: 1, fecha: null, redactor: null, ...over };
}

const RE_CAPITULO_SS = /seguridad y salud|seguridad e higiene/i;

/** Capítulo de seguridad y salud que se propone al empezar: el que se llame así. */
export function capituloSsPropuesto(chapters: Chapter[]): string | null {
  for (const ch of chapters) {
    if (RE_CAPITULO_SS.test(ch.title)) return ch.id;
    const stack = [...(ch.children ?? [])];
    while (stack.length) {
      const sub = stack.shift()!;
      if (RE_CAPITULO_SS.test(sub.title)) return sub.id;
      stack.push(...(sub.children ?? []));
    }
  }
  return null;
}

/** ¿La partida está en el capítulo (o subcapítulo) enlazado `id`? */
export function enCapitulo(
  chapters: Chapter[],
  id: string | null | undefined,
  chapterId: string,
  p: Pick<Partida, 'sub'>,
): boolean {
  if (!id) return false;
  const f = findNode(chapters, id);
  if (!f || f.chapter.id !== chapterId) return false;
  if (f.depth === 0) return true;
  return subtreeIds(f.node as Parameters<typeof subtreeIds>[0]).has(p.sub ?? chapterId);
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const TIPOS = new Set<TipoObraEss>(['nueva', 'reforma', 'demolicion']);

function redactorDe(x: unknown): RedactorEss | null {
  if (!isRecord(x)) return null;
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  return { nombre: s(x.nombre), titulacion: s(x.titulacion), colegiado: s(x.colegiado) };
}

/**
 * Lo guardado, saneado: `null` si no es un estudio (versión desconocida o no
 * es un objeto); si lo es, lo que no tiene forma se descarta sin lanzar.
 */
export function leerEstudioSs(x: unknown): EstudioSsDatos | null {
  if (!isRecord(x) || x.version !== 1) return null;
  const base = parseSeguridadSalud(x) ?? {};
  delete base.presupuesto;
  delete base.demolicionPrevia;
  const out: EstudioSsDatos = {
    ...base,
    version: 1,
    fecha: typeof x.fecha === 'string' && x.fecha ? x.fecha : null,
    redactor: redactorDe(x.redactor),
  };
  if (Array.isArray(x.tipos))
    out.tipos = x.tipos.filter((t): t is TipoObraEss => TIPOS.has(t as TipoObraEss));
  if (typeof x.forzarCompleto === 'boolean') out.forzarCompleto = x.forzarCompleto;
  if (typeof x.capituloSs === 'string') out.capituloSs = x.capituloSs;
  return out;
}

/** Aparta a `_ilegible` un `seguridadSalud` que no se puede leer, y sanea el que sí.
 *  Devuelve el mismo objeto si no hay estudio. */
export function apartarEssIlegible<T extends { seguridadSalud?: unknown; _ilegible?: Ilegible[] }>(
  d: T,
): T {
  if (d.seguridadSalud === undefined) return d;
  const leido = leerEstudioSs(d.seguridadSalud);
  if (leido) return { ...d, seguridadSalud: leido };
  console.warn(
    'Concreta: el estudio de seguridad y salud no se puede leer; se aparta.',
    d.seguridadSalud,
  );
  return {
    ...d,
    seguridadSalud: undefined,
    _ilegible: [...(d._ilegible ?? []), { donde: 'seguridadSalud', valor: d.seguridadSalud }],
  };
}

/* ===========================================================================
   core/pcc/datos — forma de lo que se guarda del plan de control (v8): el
   plan vacío, el capítulo de control propuesto y la comprobación al cargar.

   Como en residuos (`core/rcd/datos`), un `pcc` o un `planCalidad` mal
   formado NUNCA manda la obra a recuperación: se aparta a `_ilegible` con su
   valor crudo y su ruta, y la obra se abre sin él. Ligero: lo importan el
   store y el esquema (chunk principal, P1 del plan).
   =========================================================================== */
import { findNode, subtreeIds } from '../tree';
import type { Chapter, Ilegible, Partida, PartidasMap } from '../types';
import type { ControlPartida, PlanCalidadDatos } from './tipos';

const ESTADOS = new Set(['propuesta', 'confirmada', 'sinControl', 'capituloControl']);
const ORIGENES = new Set(['regla', 'banco', 'descomposicion', 'manual']);

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const opcional = (x: unknown, ok: (v: unknown) => boolean): boolean => x === undefined || ok(x);

/** Lo mínimo para que la vista y el cálculo no rompan. */
export function controlLegible(x: unknown): x is ControlPartida {
  if (!isRecord(x) || typeof x.estado !== 'string' || !ESTADOS.has(x.estado)) return false;
  if (!isRecord(x.origen) || typeof x.origen.tipo !== 'string' || !ORIGENES.has(x.origen.tipo)) return false;
  if (!opcional(x.familia, (v) => typeof v === 'string')) return false;
  if (!opcional(x.huella, (v) => isRecord(v) && typeof v.code === 'string' && typeof v.title === 'string' && typeof v.ud === 'string'))
    return false;
  if (
    !opcional(
      x.hormigon,
      (v) => isRecord(v) && isRecord(v.designacion) && typeof v.designacion.texto === 'string' && Array.isArray(v.designacion.clases),
    )
  )
    return false;
  return opcional(x.acero, (v) => isRecord(v) && typeof v.tipo === 'string');
}

export function planLegible(x: unknown): x is PlanCalidadDatos {
  if (!isRecord(x) || x.version !== 1) return false;
  const mapas = ['familias', 'marcados', 'aCargo', 'precios', 'preciosManuales', 'grupos', 'dosificaciones'] as const;
  if (!opcional(x.emitido, (v) => v === null || (isRecord(v) && Array.isArray(v.filas) && typeof v.total === 'number'))) return false;
  return mapas.every((k) => opcional(x[k], isRecord));
}

/** Plan recién empezado: nada supuesto (lo que falta sale pendiente). */
export function planVacio(over: Partial<PlanCalidadDatos> = {}): PlanCalidadDatos {
  return { version: 1, capituloControl: null, ...over };
}

const RE_CAPITULO = /control de calidad|\bensayos\b|\bcalidad\b/i;

/** Capítulo de control que se propone al empezar: el que se llame así (§9). */
export function capituloControlPropuesto(chapters: Chapter[]): string | null {
  for (const ch of chapters) {
    if (RE_CAPITULO.test(ch.title)) return ch.id;
    const stack = [...(ch.children ?? [])];
    while (stack.length) {
      const sub = stack.shift()!;
      if (RE_CAPITULO.test(sub.title)) return sub.id;
      stack.push(...(sub.children ?? []));
    }
  }
  return null;
}

/** ¿La partida está en el capítulo (o subcapítulo) de control enlazado? */
export function enCapituloControl(chapters: Chapter[], id: string | null | undefined, chapterId: string, p: Pick<Partida, 'sub'>): boolean {
  if (!id) return false;
  const f = findNode(chapters, id);
  if (!f || f.chapter.id !== chapterId) return false;
  if (f.depth === 0) return true;
  return subtreeIds(f.node as Parameters<typeof subtreeIds>[0]).has(p.sub ?? chapterId);
}

/** Aparta a `_ilegible` los `pcc` y el `planCalidad` que no se pueden leer.
 *  Devuelve el mismo objeto si no hay nada que apartar. */
export function apartarPccIlegibles<T extends { partidas: PartidasMap; planCalidad?: unknown; _ilegible?: Ilegible[] }>(d: T): T {
  const fuera: Ilegible[] = [];
  for (const [chId, ps] of Object.entries(d.partidas))
    for (const p of ps ?? []) if (p.pcc !== undefined && !controlLegible(p.pcc)) fuera.push({ donde: `partidas/${chId}/${p.id}/pcc`, valor: p.pcc });
  let partidas = d.partidas;
  if (fuera.length) {
    const malas = new Set(fuera.map((f) => f.donde));
    partidas = Object.fromEntries(
      Object.entries(d.partidas).map(([chId, ps]) => [
        chId,
        (ps ?? []).map((p) => {
          if (!malas.has(`partidas/${chId}/${p.id}/pcc`)) return p;
          const q = { ...p };
          delete q.pcc;
          return q;
        }),
      ]),
    );
  }
  let planCalidad = d.planCalidad;
  if (planCalidad !== undefined && !planLegible(planCalidad)) {
    fuera.push({ donde: 'planCalidad', valor: planCalidad });
    planCalidad = undefined;
  }
  if (!fuera.length) return d;
  console.warn(`Concreta: ${fuera.length} datos del plan de control de calidad no se pueden leer; se apartan.`, fuera);
  return { ...d, partidas, planCalidad, _ilegible: [...(d._ilegible ?? []), ...fuera] };
}

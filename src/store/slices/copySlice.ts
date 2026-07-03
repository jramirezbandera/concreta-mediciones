/* ===========================================================================
   store/slices/copySlice — copia de partidas de Referencia (F-04).
   ---------------------------------------------------------------------------
   Extraído de `obraStore` (F-04): destino de copia (`copyTargetOf`), integración
   de la copia en el draft (`applyCopy` + bifurcación de recursos en colisión) y
   las acciones de copia con preflight de colisión. Lógica idéntica al store
   monolítico; solo cambia de fichero. Los tipos `CopyTarget`/`PendingCopy`
   viven aquí (dominio de copia) y `obraStore` los re-exporta.
   =========================================================================== */
import type { Banco, Chapter } from '../../core/types';
import { findNode } from '../../core/tree';
import { nextPos } from '../../core/numbering';
import {
  REF_DESC,
  detectCollisions,
  type Collision,
  type RefCopyItem,
  type Resolution,
} from '../../core/refdata';
import { ALL, nextPartidaId, subIn } from '../base';
import type { ObraSlice, ObraState } from '../obraStore';

/** Destino de copia (F5): capítulo/sub seleccionado, o el primer capítulo si la
 *  selección es "Toda la obra"/vacía. `label` para la barra "Copiar a …". */
export interface CopyTarget {
  chId: string;
  subId: string | null;
  label: string;
}

/** Copia en espera de resolver colisiones de recurso (T-1, decisión D2). */
export interface PendingCopy {
  items: RefCopyItem[];
  target: { chId: string; subId: string | null } | null;
  contra: boolean;
  collisions: Collision[];
  /** Procedencia para que la copia, tras resolver colisiones, respete BASE vs limpia. */
  provenance: 'base' | 'clip';
}

export function copyTargetOf(chapters: Chapter[], active: string): CopyTarget {
  if (active !== ALL) {
    // Resolución a CUALQUIER profundidad (jerarquía N niveles): un sub-sub
    // activo también es un destino válido de copia.
    const hit = findNode(chapters, active);
    if (hit) {
      const { chapter, node } = hit;
      return node === chapter
        ? { chId: chapter.id, subId: null, label: `${chapter.code} · ${chapter.title}` }
        : { chId: chapter.id, subId: node.id, label: `${node.code} · ${node.title}` };
    }
  }
  const c = chapters[0];
  return c ? { chId: c.id, subId: null, label: `${c.code} · ${c.title}` } : { chId: '', subId: null, label: '' };
}

/** Siguiente código derivado libre para BIFURCAR un recurso en colisión (`code~2`,
 *  `code~3`…). Despoja un sufijo `~N` previo para no encadenar `code~2~2` al
 *  re-copiar entre tres o más obras un recurso ya bifurcado. */
function forkCode(recursos: Banco, code: string): string {
  const base = code.replace(/~\d+$/, '');
  let i = 2;
  let c = `${base}~${i}`;
  while (recursos[c]) c = `${base}~${++i}`;
  return c;
}

/**
 * Ejecuta la copia de partidas de referencia sobre el draft `s` (lo comparten la
 * copia directa y la resuelta tras colisión). `resolution[code] === 'fork'` crea
 * el recurso entrante bajo un código derivado y reescribe los items que lo usan;
 * el resto integra SIN pisar homónimos (fusionar = comportamiento histórico).
 */
function applyCopy(
  s: ObraState,
  items: RefCopyItem[],
  target: { chId: string; subId: string | null } | null,
  contra: boolean,
  resolution?: Resolution,
  provenance: 'base' | 'clip' = 'base',
): void {
  if (!items.length) return;
  const t = target ?? copyTargetOf(s.chapters, s.active);
  const ch = s.chapters.find((c) => c.id === t.chId);
  if (!ch) return;
  const subId = t.subId;
  // Destino a cualquier profundidad; un subId inexistente se RECHAZA (no-op).
  const sub = subId ? subIn(ch, subId) : undefined;
  if (subId && !sub) return;
  const base = sub ? sub.code : ch.code;
  const list = (s.partidas[t.chId] ??= []);

  // 0) Bifurcaciones: por cada código resuelto a 'fork' que choca, crea el recurso
  //    ENTRANTE bajo un código derivado (una vez por código de origen).
  const forkMap: Record<string, string> = {};
  for (const it of items)
    for (const r of it.partida.items) {
      if (r.type === '%CI') continue;
      if (resolution?.[r.code] === 'fork' && s.recursos[r.code] && !forkMap[r.code]) {
        const fc = forkCode(s.recursos, r.code);
        forkMap[r.code] = fc;
        s.recursos[fc] = { type: r.type, desc: r.desc ?? '', ud: r.ud ?? '', precio: r.precio ?? 0 };
      }
    }

  // 1) Recursos no bifurcados al banco SIN pisar homónimos (coherencia §0 / fusionar).
  for (const it of items)
    for (const r of it.partida.items) {
      if (r.type === '%CI') continue;
      const code = forkMap[r.code] ?? r.code;
      if (!s.recursos[code])
        s.recursos[code] = { type: r.type, desc: r.desc ?? '', ud: r.ud ?? '', precio: r.precio ?? 0 };
    }

  // 2) Partidas nuevas (pos correlativa dentro del sub destino; precio de la base
  //    es autoridad, sin recomputar). Los items 'fork' apuntan al código derivado.
  let sameSub = list.filter((p) => (subId ? p.sub === subId : !p.sub)).length;
  for (const it of items) {
    const p = it.partida;
    sameSub += 1;
    const newItems = p.items.map((r) =>
      r.type === '%CI'
        ? // Conserva código y descripción del %CI (el ~K «Costes indirectos» y los
          // «%» del banco son líneas distintas; perder la desc las confunde).
          { code: r.code, type: '%CI' as const, cantidad: r.cantidad, desc: r.desc }
        : { code: forkMap[r.code] ?? r.code, type: r.type, cantidad: r.cantidad },
    );
    list.push({
      id: nextPartidaId(),
      sub: subId || undefined,
      pos: nextPos(base, sameSub),
      code: p.code,
      title: p.title,
      ud: p.ud,
      precio: p.precio,
      // Autoridad del precio de la fuente (.bc3 CYPE): sin esto, editar un recurso
      // colisionante resincroniza la partida y el precio importado deriva.
      precioManual: p.precioManual || undefined,
      // CI de la fuente como badge visible (no se pliega en el precio).
      ciPct: p.ciPct,
      mainType: p.mainType,
      // La desc propia de la partida (obras como fuente) manda sobre la canónica
      // por código (bases); coincide con lo que previsualiza el panel (RefPartidaRow).
      desc: p.desc ?? REF_DESC[p.code] ?? '',
      med: [],
      items: newItems,
      // Procedencia 'clip' (portapapeles) = trabajo tuyo → partida limpia, sin
      // chip BASE ni baseSource. 'base' (panel Referencia) mantiene el chip.
      fromBase: provenance === 'clip' ? undefined : !contra,
      contradictorio: contra || undefined,
      baseSource: provenance === 'clip' ? undefined : it.sourceName,
    });
  }
  s.expanded[t.chId] = true;
}

type CopySlice = Pick<
  ObraState,
  'copyRefPartidas' | 'requestCopyRefPartidas' | 'resolveCopyRefPartidas' | 'cancelCopyRefPartidas'
>;

export const createCopySlice: ObraSlice<CopySlice> = (set) => ({
  copyRefPartidas: (items, target, contra, resolution, provenance = 'base') =>
    set((s) => {
      applyCopy(s, items, target, contra, resolution, provenance);
    }),

  requestCopyRefPartidas: (items, target, contra, provenance = 'base') =>
    set((s) => {
      if (!items.length) return;
      const collisions = detectCollisions(items, s.recursos);
      if (collisions.length === 0) {
        applyCopy(s, items, target, contra, undefined, provenance); // sin colisión: copia directa
      } else {
        // Guarda la procedencia: tras resolver la colisión, la copia debe
        // seguir respetando BASE (Referencia) vs limpia (portapapeles).
        s.pendingCopy = { items, target, contra, collisions, provenance };
      }
    }),

  resolveCopyRefPartidas: (resolution) =>
    set((s) => {
      const pc = s.pendingCopy;
      if (!pc) return;
      applyCopy(s, pc.items, pc.target, pc.contra, resolution, pc.provenance);
      s.pendingCopy = null;
    }),

  cancelCopyRefPartidas: () =>
    set((s) => {
      s.pendingCopy = null;
    }),
});

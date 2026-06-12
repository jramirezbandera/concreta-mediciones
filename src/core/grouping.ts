/* ===========================================================================
   core/grouping — agrupación de partidas por contenedor (puro, sin React).
   Compartido por la vista Presupuesto (F2), Certificaciones (F4) y los
   exportadores (vía listado): misma estructura de grupos en todos.

   Jerarquía de N niveles: los grupos salen APLANADOS en PRE-ORDEN del árbol
   de contenedores, con `depth` (1 = sub de primer nivel). Las vistas pintan
   la misma lista plana de siempre y sangran la cabecera por profundidad; el
   subtotal acumulado de cada cabecera lo da `rollupByDepth` (core/tree).
   =========================================================================== */
import type { Chapter, Partida, SubChapter } from './types';
import { flattenContainers, partidasByContainer, subtreeIds } from './tree';

export interface Group {
  /** `null` = directas (o huérfanas) del capítulo, sin subcabecera. */
  sub: SubChapter | null;
  /** 0 para el grupo sin sub; 1 = sub de primer nivel; 2 = sub-sub… */
  depth: number;
  items: Partida[];
}

/**
 * Agrupa las partidas de un capítulo por contenedor, en PRE-ORDEN del árbol;
 * las huérfanas (sin sub o con un sub inexistente) van a un grupo inicial sin
 * subcabecera. Los contenedores sin partidas directas también salen (igual que
 * antes: una subcabecera vacía permite añadirle la primera partida).
 */
export function groupBySub(chapter: Chapter, partidas: Partida[]): Group[] {
  const flat = flattenContainers(chapter);
  if (!flat.length) return [{ sub: null, depth: 0, items: partidas }];
  const by = partidasByContainer(chapter, partidas);
  const out: Group[] = [];
  const orphan = by.get(null) ?? [];
  if (orphan.length) out.push({ sub: null, depth: 0, items: orphan });
  for (const f of flat) out.push({ sub: f.sub, depth: f.depth, items: by.get(f.sub.id) ?? [] });
  return out;
}

/**
 * Grupos del capítulo AISLADOS al subárbol de `focusId` (el propio sub y sus
 * descendientes), re-basados para que el sub aislado sea nivel 1 (la sangría
 * de las vistas arranca limpia). Navegación de obras grandes: seleccionar un
 * subcapítulo en el árbol muestra SOLO ese subárbol, no el capítulo entero.
 * Un `focusId` nulo, igual al capítulo o inexistente ⇒ el capítulo completo.
 */
export function groupsForFocus(
  chapter: Chapter,
  partidas: Partida[],
  focusId?: string | null,
): Group[] {
  const all = groupBySub(chapter, partidas);
  if (!focusId || focusId === chapter.id) return all;
  const f = flattenContainers(chapter).find((x) => x.sub.id === focusId);
  if (!f) return all;
  const ids = subtreeIds(f.sub);
  const shift = f.depth - 1;
  return all
    .filter((g) => g.sub !== null && ids.has(g.sub.id))
    .map((g) => ({ ...g, depth: g.depth - shift }));
}

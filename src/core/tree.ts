/* ===========================================================================
   core/tree — utilidades del ÁRBOL de contenedores (jerarquía de N niveles).
   ---------------------------------------------------------------------------
   La estructura es un árbol (Chapter → SubChapter → SubChapter…); el contenido
   son partidas PLANAS por capítulo etiquetadas por su contenedor inmediato
   (`Partida.sub`). Este módulo es el ÚNICO punto de recursión sobre esa
   estructura: grouping/numbering/listado/vistas/export la consumen de aquí.

   ACOTADO a view-model (eng-review 2026-06-12, outside voice): da estructura,
   orden y totales acumulados; NO sabe de serialización FIEBDC (dedupe de
   códigos, ~D/~M, orden de recursos) — eso vive en bc3export, que usa este
   árbol solo para el ORDEN de recorrido.

   Rendimiento: todas las funciones indexan las partidas UNA vez (O(n)) y
   recorren el árbol una vez. Nunca `filter()` por nodo (sería cuadrático:
   el banco real de 70k partidas congelaría la UI).

   Robustez: los recorridos llevan guard de VISITADOS — un árbol con una
   referencia cíclica (dato corrupto) degrada a ignorar la repetición, nunca a
   reventar la pila.
   =========================================================================== */
import type { Chapter, Partida, SubChapter } from './types';
import { sumCents, type Cents } from './money';
import { partidaImporte } from './medicion';

/** Contenedor aplanado en PRE-ORDEN con su profundidad (1 = sub de 1er nivel). */
export interface FlatContainer {
  sub: SubChapter;
  depth: number;
  /** Id del contenedor padre (el capítulo para depth 1). */
  parentId: string;
}

/** Aplana el árbol de contenedores de un capítulo en pre-orden. */
export function flattenContainers(chapter: Chapter): FlatContainer[] {
  const out: FlatContainer[] = [];
  const seen = new Set<SubChapter>();
  const walk = (children: SubChapter[] | undefined, depth: number, parentId: string): void => {
    for (const sub of children ?? []) {
      if (seen.has(sub)) continue; // ciclo (dato corrupto): ignora la repetición
      seen.add(sub);
      out.push({ sub, depth, parentId });
      walk(sub.children, depth + 1, sub.id);
    }
  };
  walk(chapter.children, 1, chapter.id);
  return out;
}

/**
 * Ids del subárbol de un contenedor (él mismo + TODOS sus descendientes).
 * Lo usan la edición a profundidad (T-17): `moveSubtree` mueve las partidas
 * cuyo `sub` cae dentro del conjunto, y el menú "Mover a" excluye el propio
 * subárbol como destino (un nodo no puede colgar de sí mismo).
 */
export function subtreeIds(node: SubChapter): Set<string> {
  const ids = new Set<string>();
  const walk = (n: SubChapter): void => {
    if (ids.has(n.id)) return; // ciclo (dato corrupto): corta la repetición
    ids.add(n.id);
    for (const c of n.children ?? []) walk(c);
  };
  walk(node);
  return ids;
}

/** Resultado de buscar un contenedor (capítulo o sub a cualquier nivel). */
export interface FoundNode {
  chapter: Chapter;
  /** El propio capítulo (depth 0) o el sub encontrado. */
  node: Chapter | SubChapter;
  depth: number;
}

/** Busca un id de contenedor en TODOS los capítulos, a cualquier profundidad. */
export function findNode(chapters: Chapter[], id: string): FoundNode | null {
  for (const ch of chapters) {
    if (ch.id === id) return { chapter: ch, node: ch, depth: 0 };
    for (const f of flattenContainers(ch)) {
      if (f.sub.id === id) return { chapter: ch, node: f.sub, depth: f.depth };
    }
  }
  return null;
}

/** Capítulo dueño de un contenedor (o `null` si el id no existe). */
export function findChapterIdForContainer(chapters: Chapter[], id: string): string | null {
  return findNode(chapters, id)?.chapter.id ?? null;
}

/**
 * Cadena de ancestros de un contenedor: `[chapterId, …ancestros, containerId]`,
 * o `[]` si el id no existe. El capítulo es SIEMPRE el primer elemento. La usan
 * `revealPartida` (store) para expandir el árbol hasta dejar la partida a la
 * vista, y `Sidebar.onAddSub` (que repetía este walk en una closure). Guard de
 * visitados: un árbol cíclico (dato corrupto) corta en vez de colgar.
 */
export function ancestorIds(chapters: Chapter[], containerId: string): string[] {
  const hit = findNode(chapters, containerId);
  if (!hit) return [];
  if (hit.depth === 0) return [hit.chapter.id]; // es el propio capítulo
  const parentOf = new Map(flattenContainers(hit.chapter).map((f) => [f.sub.id, f.parentId]));
  const chain: string[] = [];
  const seen = new Set<string>();
  for (
    let cur: string | undefined = containerId;
    cur && cur !== hit.chapter.id && !seen.has(cur);
    cur = parentOf.get(cur)
  ) {
    seen.add(cur);
    chain.push(cur);
  }
  chain.push(hit.chapter.id);
  return chain.reverse();
}

/**
 * Índice partidas-por-contenedor en UNA pasada. Las directas del capítulo y
 * las HUÉRFANAS (con `sub` que no existe en el capítulo) van bajo `null`,
 * como el grupo sin subcabecera de `groupBySub`.
 */
export function partidasByContainer(
  chapter: Chapter,
  partidas: Partida[],
): Map<string | null, Partida[]> {
  const known = new Set(flattenContainers(chapter).map((f) => f.sub.id));
  const by = new Map<string | null, Partida[]>();
  for (const p of partidas) {
    const key = p.sub && known.has(p.sub) ? p.sub : null;
    const list = by.get(key);
    if (list) list.push(p);
    else by.set(key, [p]);
  }
  return by;
}

/**
 * Ids de los contenedores cuyo SUBÁRBOL entero no tiene ninguna partida.
 * En bancos tipo BCCA la taxonomía maestra se replica en las tres secciones
 * y solo se rellenan las ramas pertinentes: cientos de contenedores son
 * esqueleto de clasificación. El sidebar los atenúa para distinguir de un
 * vistazo los nodos con contenido de los huecos de la taxonomía.
 */
export function emptyContainers(chapter: Chapter, partidas: Partida[]): Set<string> {
  const flat = flattenContainers(chapter);
  const out = new Set<string>();
  if (!flat.length) return out;
  const by = partidasByContainer(chapter, partidas);
  const counts = rollupByDepth(
    flat.map((f) => ({ sub: f.sub, depth: f.depth })),
    flat.map((f) => by.get(f.sub.id)?.length ?? 0),
  );
  flat.forEach((f, i) => {
    if (!counts[i]) out.add(f.sub.id);
  });
  return out;
}

/* ---- árbol con totales (view-model) ---------------------------------------- */

export interface TreeNode {
  /** `null` en la raíz (el capítulo); el sub en los demás niveles. */
  sub: SubChapter | null;
  depth: number;
  /** Partidas DIRECTAS del contenedor. */
  partidas: Partida[];
  children: TreeNode[];
  /** Importe acumulado del subárbol (directas + descendientes), CON coefK. */
  total: Cents;
  /** Nº de partidas del subárbol. */
  count: number;
}

/**
 * Árbol del capítulo con partidas directas colgadas y totales acumulados.
 * La raíz agrega también las huérfanas (van como directas del capítulo).
 */
export function buildChapterTree(chapter: Chapter, partidas: Partida[], coefK = 1): TreeNode {
  const by = partidasByContainer(chapter, partidas);
  const seen = new Set<SubChapter>();
  const build = (sub: SubChapter | null, depth: number, children?: SubChapter[]): TreeNode => {
    const direct = by.get(sub ? sub.id : null) ?? [];
    const kids: TreeNode[] = [];
    for (const c of children ?? []) {
      if (seen.has(c)) continue; // ciclo (dato corrupto)
      seen.add(c);
      kids.push(build(c, depth + 1, c.children));
    }
    const total = sumCents([
      ...direct.map((p) => partidaImporte(p, coefK)),
      ...kids.map((k) => k.total),
    ]);
    const count = direct.length + kids.reduce((a, k) => a + k.count, 0);
    return { sub, depth, partidas: direct, children: kids, total, count };
  };
  return build(null, 0, chapter.children);
}

/* ---- rollups sobre grupos en pre-orden -------------------------------------
   `groupBySub` entrega los grupos APLANADOS en pre-orden con `depth`; para
   mostrar el subtotal ACUMULADO de cada subcabecera (directas + descendientes)
   sin reconstruir el árbol, basta una pasada con pila de ancestros abiertos.
   El grupo sin sub (directas/huérfanas del capítulo) es HOJA: nunca ancestro.

     grupos (pre-orden):  [∅ d0]  [1.1 d1]  [1.1.1 d2]  [1.1.2 d2]  [1.2 d1]
     rollup(1.1) = direct(1.1) + direct(1.1.1) + direct(1.1.2)
   --------------------------------------------------------------------------- */
export function rollupByDepth(
  groups: { sub: SubChapter | null; depth: number }[],
  direct: number[],
): number[] {
  const out = direct.slice();
  const stack: number[] = []; // índices de grupos-ancestro abiertos
  groups.forEach((g, i) => {
    while (stack.length) {
      const top = groups[stack[stack.length - 1]!]!;
      if (top.depth >= g.depth) stack.pop();
      else break;
    }
    for (const a of stack) out[a] = out[a]! + (direct[i] ?? 0);
    if (g.sub) stack.push(i);
  });
  return out;
}

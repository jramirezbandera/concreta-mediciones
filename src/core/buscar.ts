/* ===========================================================================
   core/buscar — índice de búsqueda de partidas dentro de la obra ACTIVA.
   ---------------------------------------------------------------------------
   Aplana todas las partidas (que viven planas por capítulo en `PartidasMap`)
   con su ubicación resuelta (miga capítulo → … → subcapítulo inmediato) para
   poder buscarlas por código/título y SALTAR a editarlas. Espeja el criterio
   de búsqueda del panel Referencia, pero el destino es el presupuesto propio.

   Rendimiento: el índice se construye en O(n + m) (n partidas, m contenedores),
   resolviendo la ubicación con un mapa estructural de subcapítulos —NUNCA
   `findNode` por partida (sería O(n·m): un banco de 70k partidas congelaría la
   UI; ver el aviso de `core/tree.ts`). El filtrado es lineal sobre un `haystack`
   precomputado y corta al alcanzar el tope.
   =========================================================================== */
import type { Chapter, Partida, PartidasMap } from './types';
import { flattenContainers } from './tree';

/** Mínimo de caracteres para que la búsqueda dispare (evita ruido con 1 letra). */
export const MIN_QUERY = 2;
/** Tope de resultados por defecto (no pintar miles de filas). */
export const DEFAULT_CAP = 50;

/** Partida indexada con su ubicación resuelta para mostrar y navegar. */
export interface HitPartida {
  p: Partida;
  chapterId: string;
  chCode: string;
  chTitle: string;
  /** Contenedor inmediato (id) si `p.sub` existe en ESTE capítulo; `null` = directa. */
  subId: string | null;
  /** Cadena capítulo → … → sub inmediato (miga completa para la ubicación). */
  path: { id: string; code: string; title: string }[];
  /** `${pos} ${code} ${title}`.toLowerCase() — precomputado para filtrar rápido. */
  haystack: string;
}

/** Resultado de búsqueda: aciertos (hasta `cap`) y si se truncó (hay más). */
export interface SearchResult {
  hits: HitPartida[];
  truncated: boolean;
}

interface SubInfo {
  parentId: string;
  code: string;
  title: string;
}

/**
 * Construye el índice de TODAS las partidas de la obra con su ubicación.
 * Null-safe: obra sin capítulos/partidas → `[]`.
 */
export function buildSearchIndex(chapters: Chapter[], partidas: PartidasMap): HitPartida[] {
  // Mapa estructural de subcapítulos (una pasada por el árbol, barato).
  const subInfo = new Map<string, SubInfo>();
  for (const ch of chapters) {
    for (const f of flattenContainers(ch)) {
      subInfo.set(f.sub.id, { parentId: f.parentId, code: f.sub.code, title: f.sub.title });
    }
  }

  const out: HitPartida[] = [];
  for (const ch of chapters) {
    const list = partidas[ch.id];
    if (!list) continue;
    for (const p of list) {
      // Sub inmediato válido sólo si existe en ESTE capítulo (huérfano → directa).
      const subId = p.sub && subInfo.has(p.sub) ? p.sub : null;
      // Miga: subir de sub en sub hasta el capítulo (guard de ciclos).
      const path: { id: string; code: string; title: string }[] = [];
      const seen = new Set<string>();
      for (let cur: string | null = subId; cur && subInfo.has(cur) && !seen.has(cur); ) {
        seen.add(cur);
        const info = subInfo.get(cur)!;
        path.unshift({ id: cur, code: info.code, title: info.title });
        cur = info.parentId === ch.id ? null : info.parentId;
      }
      path.unshift({ id: ch.id, code: ch.code, title: ch.title });
      out.push({
        p,
        chapterId: ch.id,
        chCode: ch.code,
        chTitle: ch.title,
        subId,
        path,
        haystack: `${p.pos} ${p.code} ${p.title}`.toLowerCase(),
      });
    }
  }
  return out;
}

/**
 * Filtra el índice por `query` (mismo criterio que Referencia: `includes`
 * case-insensitive sobre código/título/posición). Menos de `MIN_QUERY`
 * caracteres → vacío. Para al alcanzar `cap` resultados y marca `truncated`
 * si había al menos uno más.
 */
export function searchPartidas(
  index: HitPartida[],
  query: string,
  cap = DEFAULT_CAP,
): SearchResult {
  const q = query.trim().toLowerCase();
  if (q.length < MIN_QUERY) return { hits: [], truncated: false };
  const hits: HitPartida[] = [];
  for (const h of index) {
    if (!h.haystack.includes(q)) continue;
    if (hits.length >= cap) return { hits, truncated: true };
    hits.push(h);
  }
  return { hits, truncated: false };
}

/* ===========================================================================
   core/grouping — agrupación de partidas por subcapítulo (puro, sin React).
   Compartido por la vista Presupuesto (F2) y Certificaciones (F4): misma
   estructura de grupos en ambas. Movido aquí desde features/presupuesto en F4
   para no acoplar las features entre sí (DRY, eng-review F4).
   =========================================================================== */
import type { Chapter, Partida, SubChapter } from './types';

export interface Group {
  sub: SubChapter | null;
  items: Partida[];
}

/**
 * Agrupa las partidas de un capítulo por subcapítulo; las huérfanas (sin sub o
 * con un sub inexistente) van a un grupo inicial sin subcabecera.
 */
export function groupBySub(chapter: Chapter, partidas: Partida[]): Group[] {
  const children = chapter.children ?? [];
  if (!children.length) return [{ sub: null, items: partidas }];
  const used: Group[] = children.map((sub) => ({
    sub,
    items: partidas.filter((p) => p.sub === sub.id),
  }));
  const orphan = partidas.filter((p) => !p.sub || !children.some((s) => s.id === p.sub));
  if (orphan.length) used.unshift({ sub: null, items: orphan });
  return used.filter((g) => g.items.length > 0 || g.sub);
}

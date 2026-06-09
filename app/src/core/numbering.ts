/* ===========================================================================
   core/numbering — renumeración de posiciones de partidas (port de app.jsx).
   La posición `pos` de cada partida es `<código base>.<n>`, donde la base es el
   código del subcapítulo si la partida tiene `sub`, o el del capítulo si no, y
   `n` es el orden dentro de ese grupo.
   =========================================================================== */
import type { Chapter, Partida } from './types';

/** Reasigna `pos` a todas las partidas de un capítulo según su orden y `sub`. */
export function renumberChapter(ch: Chapter | undefined, list: Partida[]): Partida[] {
  const counts: Record<string, number> = {};
  return list.map((p) => {
    const key = p.sub || '_';
    counts[key] = (counts[key] ?? 0) + 1;
    const sub = ch?.children && p.sub ? ch.children.find((s) => s.id === p.sub) : undefined;
    const base = sub ? sub.code : ch ? ch.code : '';
    return { ...p, pos: `${base}.${counts[key]}` };
  });
}

/* ===========================================================================
   core/numbering — renumeración de posiciones de partidas (port de app.jsx).
   La posición `pos` de cada partida es `<código base>.<n>`, donde la base es el
   código de su contenedor inmediato (sub a CUALQUIER profundidad: el código del
   sub ya es la ruta, p.ej. "1.2.3"), o el del capítulo si no tiene, y `n` es el
   orden dentro de ese grupo.
   =========================================================================== */
import type { Chapter, Partida } from './types';
import { flattenContainers } from './tree';

/** Posición de una partida: `<código base>.<n>`. LA regla de numeración, en un
 *  solo sitio (F-03): antes estaba escrita a mano en applyCopy/addPartida/
 *  bc3import además de aquí — cambiar la política obligaba a tocar los cuatro
 *  (y a que ninguno se quedara atrás en silencio). */
export function nextPos(baseCode: string, n: number): string {
  return `${baseCode}.${n}`;
}

/** Reasigna `pos` a todas las partidas de un capítulo según su orden y `sub`. */
export function renumberChapter(ch: Chapter | undefined, list: Partida[]): Partida[] {
  const codeById = new Map<string, string>();
  if (ch) for (const f of flattenContainers(ch)) codeById.set(f.sub.id, f.sub.code);
  const counts: Record<string, number> = {};
  return list.map((p) => {
    const key = p.sub || '_';
    counts[key] = (counts[key] ?? 0) + 1;
    const base = (p.sub ? codeById.get(p.sub) : undefined) ?? (ch ? ch.code : '');
    return { ...p, pos: nextPos(base, counts[key]!) };
  });
}

import type { Cents } from '../../core/money';
import type { Chapter, Partida } from '../../core/types';
import { PartidasCards } from './PartidasCards';
import { PartidasTable } from './PartidasTable';

/** Conmuta tabla (desktop) ↔ tarjetas (compacto, <780). */
export function Partidas({
  compact,
  chapter,
  partidas,
  chapterTotal,
  sticky,
}: {
  compact: boolean;
  chapter: Chapter;
  partidas: Partida[];
  chapterTotal: Cents;
  sticky?: boolean;
}) {
  return compact ? (
    <PartidasCards chapter={chapter} partidas={partidas} chapterTotal={chapterTotal} />
  ) : (
    <PartidasTable chapter={chapter} partidas={partidas} chapterTotal={chapterTotal} sticky={sticky} />
  );
}

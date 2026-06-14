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
  focus,
  sticky,
}: {
  compact: boolean;
  chapter: Chapter;
  partidas: Partida[];
  chapterTotal: Cents;
  /** Id de sub activo: aísla su subárbol (navegación de obras grandes). */
  focus?: string | null;
  sticky?: boolean;
}) {
  return compact ? (
    <PartidasCards chapter={chapter} partidas={partidas} focus={focus} />
  ) : (
    <PartidasTable
      chapter={chapter}
      partidas={partidas}
      chapterTotal={chapterTotal}
      focus={focus}
      sticky={sticky}
    />
  );
}

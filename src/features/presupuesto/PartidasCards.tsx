import { Fragment, useMemo } from 'react';
import { Icon } from '../../components';
import { partidaImporte } from '../../core/medicion';
import { fmtNum, sumCents, toEur, type Cents } from '../../core/money';
import type { Chapter, Partida } from '../../core/types';
import { groupsForFocus } from '../../core/grouping';
import { rollupByDepth } from '../../core/tree';
import { usePartidaClipboard } from '../../hooks/usePartidaClipboard';
import { useObraStore } from '../../store';
import { PartidaCard } from './PartidaCard';
import styles from './Presupuesto.module.css';

/** Lista de partidas en tarjetas (modo compacto, <780). Mismos grupos que la tabla. */
export function PartidasCards({
  chapter,
  partidas,
  chapterTotal,
  focus,
}: {
  chapter: Chapter;
  partidas: Partida[];
  chapterTotal: Cents;
  /** Id de sub activo: aísla su subárbol (navegación de obras grandes). */
  focus?: string | null;
}) {
  const coefK = useObraStore((s) => s.rates.coefK);
  const addPartida = useObraStore((s) => s.addPartida);
  const { hasClip, paste } = usePartidaClipboard();
  const groups = useMemo(
    () => groupsForFocus(chapter, partidas, focus),
    [chapter, partidas, focus],
  );
  // Subtotal ACUMULADO por cabecera (directas + descendientes), como la tabla.
  const rollups = rollupByDepth(
    groups,
    groups.map((g) => sumCents(g.items.map((p) => partidaImporte(p, coefK)))),
  );

  return (
    <div className={styles.cards}>
      {groups.map((g, gi) => (
        <Fragment key={g.sub?.id ?? `orphan-${gi}`}>
          {g.sub && (
            <div
              className={`${styles.cardsSubHead} ${gi === 0 ? styles.first : ''}`}
              style={{ paddingLeft: 2 + (g.depth - 1) * 14 }}
            >
              <span className={`mono ${styles.cardsSubCode}`}>{g.sub.code}</span>
              <span className={`caps ${styles.cardsSubTitle}`}>{g.sub.title}</span>
              <span className={`mono ${styles.cardsSubImporte}`}>{fmtNum(toEur(rollups[gi] ?? 0))}</span>
            </div>
          )}
          {g.items.map((p) => (
            <PartidaCard key={p.id} p={p} chapterId={chapter.id} chapterTotal={chapterTotal} />
          ))}
          <div className={styles.cardsBtns}>
            <button
              type="button"
              className={`tcol ${styles.cardsAdd}`}
              onClick={() => addPartida(chapter.id, g.sub?.id ?? null)}
            >
              <Icon name="plus" size={15} /> Añadir partida{g.sub ? ` a ${g.sub.code}` : ''}
            </button>
            {hasClip && (
              <button
                type="button"
                title="Pegar la partida copiada aquí"
                className={`tcol tap-target ${styles.cardsPaste}`}
                onClick={() => paste({ chId: chapter.id, subId: g.sub?.id ?? null })}
              >
                <Icon name="paste" size={15} /> Pegar
              </button>
            )}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

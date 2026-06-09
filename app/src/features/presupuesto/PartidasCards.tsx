import { Fragment, useMemo } from 'react';
import { Icon } from '../../components';
import { partidaImporte } from '../../core/medicion';
import { fmtNum, sumCents, toEur, type Cents } from '../../core/money';
import type { Chapter, Partida } from '../../core/types';
import { useObraStore } from '../../store';
import { groupBySub } from './grouping';
import { PartidaCard } from './PartidaCard';
import styles from './Presupuesto.module.css';

/** Lista de partidas en tarjetas (modo compacto, <780). Mismos grupos que la tabla. */
export function PartidasCards({
  chapter,
  partidas,
  chapterTotal,
}: {
  chapter: Chapter;
  partidas: Partida[];
  chapterTotal: Cents;
}) {
  const coefK = useObraStore((s) => s.rates.coefK);
  const addPartida = useObraStore((s) => s.addPartida);
  const groups = useMemo(() => groupBySub(chapter, partidas), [chapter, partidas]);
  const subTotal = (items: Partida[]): Cents => sumCents(items.map((p) => partidaImporte(p, coefK)));

  return (
    <div className={styles.cards}>
      {groups.map((g, gi) => (
        <Fragment key={g.sub?.id ?? `orphan-${gi}`}>
          {g.sub && (
            <div className={`${styles.cardsSubHead} ${gi === 0 ? styles.first : ''}`}>
              <span className={`mono ${styles.cardsSubCode}`}>{g.sub.code}</span>
              <span className={`caps ${styles.cardsSubTitle}`}>{g.sub.title}</span>
              <span className={`mono ${styles.cardsSubImporte}`}>{fmtNum(toEur(subTotal(g.items)))}</span>
            </div>
          )}
          {g.items.map((p) => (
            <PartidaCard key={p.id} p={p} chapterId={chapter.id} chapterTotal={chapterTotal} />
          ))}
          <button
            type="button"
            className={`tcol ${styles.cardsAdd}`}
            onClick={() => addPartida(chapter.id, g.sub?.id ?? null)}
          >
            <Icon name="plus" size={15} /> Añadir partida{g.sub ? ` a ${g.sub.code}` : ''}
          </button>
        </Fragment>
      ))}
    </div>
  );
}

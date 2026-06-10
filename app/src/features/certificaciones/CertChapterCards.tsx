import { Fragment, useMemo } from 'react';
import { Icon } from '../../components';
import { certCalc, extrasCantidad } from '../../core/certificacion';
import { groupBySub } from '../../core/grouping';
import { fmtNum, sumCents, toEur, type Cents } from '../../core/money';
import type { CertExtra, Chapter, Partida } from '../../core/types';
import { useObraStore, type CertMode } from '../../store';
import { CertCard, CertExtraCard } from './CertCard';
import styles from './Certificaciones.module.css';

type Data = Record<string, number>;

/** Lista de partidas certificables en tarjetas (compacto, <780). Mismos grupos
 *  que la tabla, con los contradictorios y el alta al final del capítulo. */
export function CertChapterCards({
  chapter,
  partidas,
  curData,
  prevData,
  mode,
  coefK,
  extras,
  prevExtras,
}: {
  chapter: Chapter;
  partidas: Partida[];
  curData: Data;
  prevData: Data;
  mode: CertMode;
  coefK: number;
  extras: CertExtra[];
  prevExtras: CertExtra[];
}) {
  const addContradictorio = useObraStore((s) => s.addContradictorio);
  const groups = useMemo(
    () => groupBySub(chapter, partidas).filter((g) => g.items.length > 0),
    [chapter, partidas],
  );
  const chapExtras = extras.filter((e) => e.chapterId === chapter.id);
  const prevCant = extrasCantidad(prevExtras);
  const subTotal = (items: Partida[]): Cents =>
    sumCents(
      items.map((p) => {
        const k = certCalc(p, curData, prevData, coefK);
        return mode === 'origen' ? k.aOrigen : k.estaCert;
      }),
    );

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
            <CertCard
              key={p.id}
              p={p}
              curData={curData}
              prevData={prevData}
              mode={mode}
              coefK={coefK}
            />
          ))}
        </Fragment>
      ))}
      {chapExtras.map((e) => (
        <CertExtraCard key={e.id} e={e} prevCantidad={prevCant[e.id] ?? 0} mode={mode} />
      ))}
      <button
        type="button"
        className={`tcol ${styles.cardsAdd}`}
        onClick={() => addContradictorio(chapter.id)}
      >
        <Icon name="plus" size={15} /> Añadir precio contradictorio
      </button>
    </div>
  );
}

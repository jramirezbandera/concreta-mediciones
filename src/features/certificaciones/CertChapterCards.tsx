import { Fragment, useMemo } from 'react';
import { Icon } from '../../components';
import { certCalc, extrasCantidad, type CertSnapshot } from '../../core/certificacion';
import { groupBySub } from '../../core/grouping';
import { rollupByDepth } from '../../core/tree';
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
  snap,
  extras,
  prevExtras,
}: {
  chapter: Chapter;
  partidas: Partida[];
  curData: Data;
  prevData: Data;
  mode: CertMode;
  coefK: number;
  snap?: CertSnapshot;
  extras: CertExtra[];
  prevExtras: CertExtra[];
}) {
  const addContradictorio = useObraStore((s) => s.addContradictorio);
  // Grupos en pre-orden (N niveles) con subtotal ACUMULADO por cabecera; los
  // contenedores intermedios con descendientes certificables se conservan.
  const groups = useMemo(() => {
    const gs = groupBySub(chapter, partidas);
    const certImporte = (p: Partida): Cents => {
      const k = certCalc(p, curData, prevData, coefK, snap);
      return mode === 'origen' ? k.aOrigen : k.estaCert;
    };
    const rollups = rollupByDepth(
      gs,
      gs.map((g) => sumCents(g.items.map(certImporte))),
    );
    const counts = rollupByDepth(
      gs,
      gs.map((g) => g.items.length),
    );
    return gs
      .map((g, i) => ({ ...g, rollup: rollups[i] ?? 0, n: counts[i] ?? 0 }))
      .filter((g) => g.n > 0);
  }, [chapter, partidas, curData, prevData, coefK, snap, mode]);
  const chapExtras = extras.filter((e) => e.chapterId === chapter.id);
  const prevCant = extrasCantidad(prevExtras);

  return (
    <div className={styles.cards}>
      {groups.map((g, gi) => (
        <Fragment key={g.sub?.id ?? `orphan-${gi}`}>
          {g.sub && (
            <div
              className={`${styles.cardsSubHead} ${gi === 0 ? styles.first : ''}`}
              style={{ paddingLeft: (g.depth - 1) * 14 }}
            >
              <span className={`mono ${styles.cardsSubCode}`}>{g.sub.code}</span>
              <span className={`caps ${styles.cardsSubTitle}`}>{g.sub.title}</span>
              <span className={`mono ${styles.cardsSubImporte}`}>{fmtNum(toEur(g.rollup))}</span>
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
              snap={snap}
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

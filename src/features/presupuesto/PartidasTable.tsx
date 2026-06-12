import { Fragment, useMemo } from 'react';
import { Icon } from '../../components';
import { partidaImporte } from '../../core/medicion';
import { fmtNum, sumCents, toEur, type Cents } from '../../core/money';
import type { Chapter, Partida, SubChapter } from '../../core/types';
import { groupBySub } from '../../core/grouping';
import { rollupByDepth } from '../../core/tree';
import { useGridNav } from '../../hooks/useGridNav';
import { useObraStore } from '../../store';
import { PartidaRow } from './PartidaRow';
import styles from './Presupuesto.module.css';

/** Fila separadora de subcapítulo: sangrada por profundidad, con el subtotal
 *  ACUMULADO de su subárbol (directas + descendientes). */
function SubHeaderRow({ sub, depth, importe }: { sub: SubChapter; depth: number; importe: Cents }) {
  return (
    <tr className={styles.subRow}>
      <td colSpan={5}>
        <div className={styles.subLabel} style={{ paddingLeft: (depth - 1) * 16 }}>
          <span className={`mono ${styles.subCode}`}>{sub.code}</span>
          <span className={`caps ${styles.subTitle}`}>{sub.title}</span>
        </div>
      </td>
      <td className={`mono ${styles.subImporte}`}>{fmtNum(toEur(importe))}</td>
      <td className={styles.cMenu} />
    </tr>
  );
}

/**
 * Tabla de partidas de un capítulo (F2.1, lectura): cabecera + grupos por
 * contenedor en PRE-ORDEN del árbol (N niveles, sangrados por profundidad).
 * La cantidad/importe de cada fila los calcula `usePartidaRow`.
 */
export function PartidasTable({
  chapter,
  partidas,
  chapterTotal,
  sticky = true,
}: {
  chapter: Chapter;
  partidas: Partida[];
  chapterTotal: Cents;
  sticky?: boolean;
}) {
  const coefK = useObraStore((s) => s.rates.coefK);
  const addPartida = useObraStore((s) => s.addPartida);
  const gridNav = useGridNav();
  const groups = useMemo(() => groupBySub(chapter, partidas), [chapter, partidas]);
  const rollups = useMemo(
    () =>
      rollupByDepth(
        groups,
        groups.map((g) => sumCents(g.items.map((p) => partidaImporte(p, coefK)))),
      ),
    [groups, coefK],
  );

  return (
    <div className={styles.tableWrap} onKeyDown={gridNav}>
      <table className={`ctable ${styles.table}`}>
        <thead className={sticky ? styles.sticky : undefined}>
          <tr>
            <th className={styles.thNum}>Nº · Código</th>
            <th className={styles.thDesc}>Descripción</th>
            <th className={styles.thUd}>Ud.</th>
            <th className={styles.thQty}>Cantidad</th>
            <th className={styles.thPrice}>Precio</th>
            <th className={styles.thImporte}>Importe</th>
            <th className={styles.thMenu} />
          </tr>
        </thead>
        <tbody>
          {groups.map((g, gi) => (
            <Fragment key={g.sub?.id ?? `orphan-${gi}`}>
              {g.sub && <SubHeaderRow sub={g.sub} depth={g.depth} importe={rollups[gi] ?? 0} />}
              {g.items.map((p) => (
                <PartidaRow key={p.id} p={p} chapterId={chapter.id} chapterTotal={chapterTotal} />
              ))}
              <tr className={styles.addRow}>
                <td colSpan={7}>
                  <button
                    type="button"
                    className={`tcol add-partida ${styles.addBtn}`}
                    onClick={() => addPartida(chapter.id, g.sub?.id ?? null)}
                  >
                    <Icon name="plus" size={13} /> Añadir partida{g.sub ? ` a ${g.sub.code}` : ''}
                  </button>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

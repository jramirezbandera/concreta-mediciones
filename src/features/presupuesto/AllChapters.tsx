import { EditableText, Icon } from '../../components';
import { fmtCents, fmtNum, type Cents } from '../../core/money';
import { selectChapterTotals, selectPem, selectTotalConIva, useObraStore } from '../../store';
import { Partidas } from './Partidas';
import styles from './Presupuesto.module.css';

/**
 * Vista "Toda la obra" (F2.1, lectura): cabecera con PEM y total c/IVA + una
 * banda y su tabla por cada capítulo. Importes en céntimos desde los selectores.
 */
export function AllChapters({ compact }: { compact: boolean }) {
  const chapters = useObraStore((s) => s.chapters);
  const partidas = useObraStore((s) => s.partidas);
  const denominacion = useObraStore((s) => s.obra.denominacion);
  const chapterTotals = useObraStore(selectChapterTotals);
  const pem = useObraStore(selectPem);
  const total = useObraStore(selectTotalConIva);
  const addPartida = useObraStore((s) => s.addPartida);
  const editChapterTitle = useObraStore((s) => s.editChapterTitle);

  return (
    <>
      <div className={styles.allHeader}>
        <div style={{ minWidth: 0 }}>
          <div className={styles.chMeta}>
            <span className={`mono caps ${styles.allChip}`}>Obra completa</span>
            <span className={styles.chCount}>{chapters.length} capítulos</span>
          </div>
          <h1 className={styles.chTitle}>{denominacion}</h1>
        </div>
        <div className={styles.chRight}>
          <div className={`caps ${styles.chImpLabel}`}>
            {compact ? 'Total c/ IVA' : 'PEM · Total c/ IVA'}
          </div>
          {!compact && <div className={`mono ${styles.allPemSmall}`}>{fmtCents(pem)}</div>}
          <div className={`mono ${styles.chImporte}`}>{fmtCents(total)}</div>
        </div>
      </div>

      {chapters.map((ch) => {
        const ps = partidas[ch.id] ?? [];
        const imp: Cents = chapterTotals[ch.id] ?? 0;
        const pct = pem ? (imp / pem) * 100 : 0;
        return (
          <section key={ch.id}>
            <div className={styles.chapterBand}>
              <span className={`mono ${styles.bandCode}`}>{ch.code}</span>
              <EditableText
                value={ch.title}
                ariaLabel={`Título del capítulo ${ch.code}`}
                placeholder="Título del capítulo…"
                className={styles.bandTitle}
                style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}
                onCommit={(t) => editChapterTitle(ch.id, t)}
              />
              {!compact && (
                <span className={styles.bandCount}>
                  {ps.length} {ps.length === 1 ? 'partida' : 'partidas'}
                </span>
              )}
              <div className={styles.bandRight}>
                {!compact && <span className={`mono ${styles.bandPct}`}>{fmtNum(pct, 1)}% PEM</span>}
                <span className={`mono ${styles.bandImporte}`}>{fmtCents(imp)}</span>
              </div>
            </div>
            {ps.length > 0 ? (
              <Partidas compact={compact} chapter={ch} partidas={ps} chapterTotal={imp} sticky={false} />
            ) : (
              <div className={styles.bandEmpty}>
                <button
                  type="button"
                  className={`tcol add-partida ${styles.addBtn}`}
                  onClick={() => addPartida(ch.id, null)}
                >
                  <Icon name="plus" size={13} /> Añadir primera partida
                </button>
              </div>
            )}
          </section>
        );
      })}
      <div className={styles.tailPad} />
    </>
  );
}

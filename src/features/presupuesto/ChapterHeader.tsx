import { Fragment } from 'react';
import { fmtCents, fmtNum, type Cents } from '../../core/money';
import styles from './Presupuesto.module.css';

/** Cabecera del contenedor activo (capítulo o sub AISLADO, jerarquía N
 *  niveles): código, nº de partidas, % del PEM e importe acumulado. Al aislar un
 *  sub recibe la miga (`path`) capítulo → … → sub para hacer legible que la
 *  vista se ha estrechado y ofrecer la vuelta (clic en un ancestro). */
export function ChapterHeader({
  chapter,
  importe,
  count,
  pem,
  path,
  onNavigate,
}: {
  chapter: { code: string; title: string };
  importe: Cents;
  count: number;
  pem: Cents;
  /** Miga capítulo → … → sub (el último es el contenedor actual). Sólo al aislar. */
  path?: { id: string; code: string; title: string }[];
  onNavigate?: (id: string) => void;
}) {
  const pct = pem ? (importe / pem) * 100 : 0;
  const crumbs = path && path.length > 1 ? path : null;
  return (
    <div className={styles.chHeader}>
      {crumbs && (
        <nav className={styles.chCrumb} aria-label="Ubicación">
          {crumbs.map((n, i) => {
            const last = i === crumbs.length - 1;
            return (
              <Fragment key={n.id}>
                {i > 0 && <span className={styles.chCrumbSep}>›</span>}
                {last ? (
                  <span className={styles.chCrumbCur}>
                    <span className="mono">{n.code}</span> {n.title}
                  </span>
                ) : (
                  <button
                    type="button"
                    className={`tcol ${styles.chCrumbLink}`}
                    onClick={() => onNavigate?.(n.id)}
                  >
                    <span className="mono">{n.code}</span> {n.title}
                  </button>
                )}
              </Fragment>
            );
          })}
        </nav>
      )}
      <div className={styles.chHeadRow}>
        <div style={{ minWidth: 0 }}>
          <div className={styles.chMeta}>
            <span className={`mono ${styles.chCodeChip}`}>{chapter.code}</span>
            <span className={styles.chCount}>
              {count} {count === 1 ? 'partida' : 'partidas'}
            </span>
            <span className={styles.chDot}>·</span>
            <span className={`mono ${styles.chPct}`}>{fmtNum(pct, 1)}% del PEM</span>
          </div>
          <h1 className={styles.chTitle}>{chapter.title}</h1>
        </div>
        <div className={styles.chRight}>
          <div className={`caps ${styles.chImpLabel}`}>Importe</div>
          <div className={`mono ${styles.chImporte}`}>{fmtCents(importe)}</div>
        </div>
      </div>
    </div>
  );
}

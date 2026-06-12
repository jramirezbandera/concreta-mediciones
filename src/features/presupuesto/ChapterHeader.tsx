import { fmtCents, fmtNum, type Cents } from '../../core/money';
import styles from './Presupuesto.module.css';

/** Cabecera del contenedor activo (capítulo o sub AISLADO, jerarquía N
 *  niveles): código, nº de partidas, % del PEM e importe acumulado. */
export function ChapterHeader({
  chapter,
  importe,
  count,
  pem,
}: {
  chapter: { code: string; title: string };
  importe: Cents;
  count: number;
  pem: Cents;
}) {
  const pct = pem ? (importe / pem) * 100 : 0;
  return (
    <div className={styles.chHeader}>
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

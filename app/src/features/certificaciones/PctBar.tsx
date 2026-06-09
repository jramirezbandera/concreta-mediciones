import { fmtNum } from '../../core/money';
import styles from './Certificaciones.module.css';

/** Barra de % de avance de una partida (verde al 100%). */
export function PctBar({ pct }: { pct: number }) {
  const full = pct >= 99.5;
  return (
    <div className={styles.pctBar}>
      <div className={styles.pctTrack}>
        <div
          className={`${styles.pctFill} ${full ? styles.full : ''}`}
          style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
      <span className={`mono ${styles.pctNum} ${full ? styles.full : ''}`}>{fmtNum(pct, 1)}%</span>
    </div>
  );
}

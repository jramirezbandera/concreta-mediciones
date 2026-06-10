import { EditableNum } from '../../components';
import { fmtNum, round2 } from '../../core/money';
import styles from './Certificaciones.module.css';

/**
 * Barra de % de avance de una partida (verde al 100%). Si recibe `onCommitPct`,
 * el número es editable (dogfood #1: teclear "50%" rellena la cantidad ejecutada,
 * bidireccional % ↔ cantidad). El `%` que se muestra corresponde a la cantidad
 * del MODO en curso (a origen / esta cert).
 */
export function PctBar({ pct, onCommitPct }: { pct: number; onCommitPct?: (pct: number) => void }) {
  const full = pct >= 99.5;
  return (
    <div className={styles.pctBar}>
      <div className={styles.pctTrack}>
        <div
          className={`${styles.pctFill} ${full ? styles.full : ''}`}
          style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
      {onCommitPct ? (
        <span className={styles.pctEditWrap}>
          <span className={styles.pctEditBox}>
            <EditableNum value={round2(pct)} dec={1} ariaLabel="% de ejecución" onCommit={onCommitPct} />
          </span>
          <span className={`mono ${styles.pctPct}`}>%</span>
        </span>
      ) : (
        <span className={`mono ${styles.pctNum} ${full ? styles.full : ''}`}>{fmtNum(pct, 1)}%</span>
      )}
    </div>
  );
}

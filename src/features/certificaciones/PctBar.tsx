import { EditableNum } from '../../components';
import { fmtNum, round2 } from '../../core/money';
import { certPctState } from './certPctState';
import styles from './Certificaciones.module.css';

/**
 * Barra de % de avance de una partida (verde al 100%). Si recibe `onCommitPct`,
 * el número es editable (dogfood #1: teclear "50%" rellena la cantidad ejecutada,
 * bidireccional % ↔ cantidad). El `%` que se muestra corresponde a la cantidad
 * del MODO en curso (a origen / esta cert).
 */
export function PctBar({ pct, onCommitPct }: { pct: number; onCommitPct?: (pct: number) => void }) {
  const state = certPctState(pct);
  const stCls = state === 'over' ? styles.over : state === 'full' ? styles.full : '';
  const overTitle = state === 'over' ? 'Sobre-certificado: supera el 100 % del presupuesto' : undefined;
  return (
    <div className={styles.pctBar} title={overTitle}>
      <div className={styles.pctTrack}>
        <div
          className={`${styles.pctFill} ${stCls}`}
          style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
      {onCommitPct ? (
        <span className={styles.pctEditWrap}>
          <span className={styles.pctEditBox}>
            <EditableNum value={round2(pct)} dec={1} ariaLabel="% de ejecución" onCommit={onCommitPct} />
          </span>
          <span className={`mono ${styles.pctPct} ${stCls}`}>%</span>
        </span>
      ) : (
        <span className={`mono ${styles.pctNum} ${stCls}`}>{fmtNum(pct, 1)}%</span>
      )}
    </div>
  );
}

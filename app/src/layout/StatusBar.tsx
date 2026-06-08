import { fmtEur } from '../core/money';
import styles from './StatusBar.module.css';

export interface Counts {
  chapters: number;
  partidas: number;
  lineas: number;
}

export interface StatusBarProps {
  counts: Counts;
  pem: number;
  pec: number;
  /** Acceso al sandbox de primitivas (dev). */
  onSandbox?: () => void;
}

/** Barra de estado inferior (24px, mono): conteos + PEM/PEC. */
export function StatusBar({ counts, pem, pec, onSandbox }: StatusBarProps) {
  return (
    <footer className={`mono no-print ${styles.bar}`}>
      <div className={styles.group}>
        <span>
          <span className={styles.strong}>{counts.chapters}</span> capítulos
        </span>
        <span className={styles.dim}>·</span>
        <span>
          <span className={styles.strong}>{counts.partidas}</span> partidas
        </span>
        <span className={styles.dim}>·</span>
        <span>
          <span className={styles.strong}>{counts.lineas}</span> líneas de medición
        </span>
      </div>
      <div className={`${styles.group} ${styles.dim}`}>
        {onSandbox && (
          <>
            <button type="button" className={styles.devLink} onClick={onSandbox}>
              Sandbox
            </button>
            <span>·</span>
          </>
        )}
        <span>
          <span className={styles.label}>PEM</span> {fmtEur(pem)}
        </span>
        <span>·</span>
        <span>
          <span className={styles.label}>PEC</span> {fmtEur(pec)}
        </span>
      </div>
    </footer>
  );
}

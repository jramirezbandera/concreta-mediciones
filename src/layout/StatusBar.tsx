import { Icon } from '../components';
import { fmtCents, type Cents } from '../core/money';
import { useClipboardStore } from '../store';
import styles from './StatusBar.module.css';

export interface Counts {
  chapters: number;
  partidas: number;
  lineas: number;
}

export interface StatusBarProps {
  counts: Counts;
  /** PEM y PEC en céntimos enteros (mismos valores que los selectores). */
  pem: Cents;
  pec: Cents;
  /** Abre el Centro de Ayuda (Primeros pasos · Funcionalidades · Atajos). */
  onHelp?: () => void;
}

/** Barra de estado inferior (24px, mono): conteos + portapapeles + PEM/PEC. */
export function StatusBar({ counts, pem, pec, onHelp }: StatusBarProps) {
  const clip = useClipboardStore((s) => s.items);
  const clearClip = useClipboardStore((s) => s.clear);
  const clipHead = clip?.[0]?.partida;
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
        {clipHead && (
          <span className={styles.clip} title={`En el portapapeles: ${clipHead.code} · ${clipHead.title}`}>
            <Icon name="copy" size={12} />
            <span className={styles.clipName}>
              {clipHead.code} {clipHead.title}
            </span>
            {clip && clip.length > 1 && <span className={styles.clipMore}>+{clip.length - 1}</span>}
            <button
              type="button"
              className={styles.clipClear}
              onClick={clearClip}
              aria-label="Vaciar el portapapeles"
              title="Vaciar el portapapeles"
            >
              <Icon name="x" size={12} />
            </button>
          </span>
        )}
        {onHelp && (
          <>
            <button
              type="button"
              className={styles.devLink}
              onClick={onHelp}
              title="Ayuda y atajos (?)"
              aria-label="Ayuda"
            >
              <Icon name="help" size={12} /> Ayuda
            </button>
            <span>·</span>
          </>
        )}
        <span>
          <span className={styles.label}>PEM</span> {fmtCents(pem)}
        </span>
        <span>·</span>
        <span>
          <span className={styles.label}>PEC</span> {fmtCents(pec)}
        </span>
      </div>
    </footer>
  );
}

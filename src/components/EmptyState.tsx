import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './EmptyState.module.css';

/**
 * Estado vacío con calidez ("Estados de UI de M1" §1, F8.3): dot-grid + tarjeta
 * con icono, título, texto y CTAs. Nada de "0 elementos" a secas: cada vacío
 * dice cuál es el siguiente paso.
 */
export function EmptyState({
  icon,
  title,
  text,
  children,
}: {
  icon: IconName;
  title: string;
  text: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={`dot-grid ${styles.wrap}`}>
      <div className={`fadeUp ${styles.card}`}>
        <div className={styles.icon}>
          <Icon name={icon} size={24} />
        </div>
        <div className={styles.title}>{title}</div>
        <p className={styles.text}>{text}</p>
        {children && <div className={styles.actions}>{children}</div>}
      </div>
    </div>
  );
}

/** CTA del estado vacío: primaria (accent, el wedge de entrada) o ghost. */
export function EmptyAction({
  primary = false,
  onClick,
  children,
}: {
  primary?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className={primary ? styles.primary : styles.ghost} onClick={onClick}>
      {children}
    </button>
  );
}

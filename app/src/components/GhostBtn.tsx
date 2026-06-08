import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './GhostBtn.module.css';

export interface GhostBtnProps {
  icon?: IconName;
  children?: ReactNode;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}

/** Botón fantasma de la barra superior (texto + icono opcional). */
export function GhostBtn({ icon, children, onClick, active = false, title }: GhostBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`tcol ${styles.btn} ${active ? styles.active : ''}`}
    >
      {icon && <Icon name={icon} size={15} />}
      {children}
    </button>
  );
}

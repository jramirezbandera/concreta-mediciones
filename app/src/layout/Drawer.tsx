import { useEffect, type ReactNode } from 'react';
import styles from './Drawer.module.css';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Drawer móvil/tablet: overlay + panel deslizante a la izquierda. Cierra con
 * Esc o clic en el overlay. Las animaciones viven en tokens.css (gated en
 * prefers-reduced-motion).
 */
export function Drawer({ open, onClose, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className={`no-print drawer-overlay ${styles.overlay}`} onClick={onClose} />
      <div className={`drawer-panel ${styles.panel}`}>{children}</div>
    </>
  );
}

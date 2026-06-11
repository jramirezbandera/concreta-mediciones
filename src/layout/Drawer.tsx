import { useEffect, useState, type ReactNode } from 'react';
import styles from './Drawer.module.css';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** ¿El usuario pide menos movimiento? (sin matchMedia —jsdom— se asume que sí). */
function reducedMotion(): boolean {
  return typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Drawer móvil/tablet: overlay + panel deslizante a la izquierda. Cierra con
 * Esc o clic en el overlay. Las animaciones viven en tokens.css (gated en
 * prefers-reduced-motion). El CIERRE es animado (F8.1): al pasar `open` a
 * false el panel queda montado con la clase `closing` hasta que su animación
 * de salida termina (con timeout de seguridad); con reduced-motion se
 * desmonta al instante.
 */
export function Drawer({ open, onClose, children }: DrawerProps) {
  const [render, setRender] = useState(open);

  useEffect(() => {
    if (open) {
      setRender(true);
      return;
    }
    if (reducedMotion()) {
      setRender(false);
      return;
    }
    // Salida animada: `closing` dispara la animación; animationend desmonta,
    // y este timeout cubre el caso de que no llegue a dispararse.
    const t = setTimeout(() => setRender(false), 320);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!render) return null;

  const closing = !open;
  return (
    <>
      <div
        className={`no-print drawer-overlay ${closing ? 'closing' : ''} ${styles.overlay}`}
        onClick={closing ? undefined : onClose}
      />
      <div
        className={`drawer-panel ${closing ? 'closing' : ''} ${styles.panel}`}
        onAnimationEnd={closing ? () => setRender(false) : undefined}
      >
        {children}
      </div>
    </>
  );
}

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './Modal.module.css';

/** Elementos enfocables para el trap de Tab (T-7, primer modal real, F6.2). */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Icono de la cabecera (chip con fondo de acento). */
  icon?: IconName;
  /** Slot del pie (botones). Si falta, no se pinta el pie. */
  footer?: ReactNode;
  /** En compacto el modal entra como hoja inferior (bottom-sheet). */
  compact?: boolean;
  children: ReactNode;
}

/**
 * Modal reutilizable con focus-trap (cierra T-7). Diseño portado del prototipo
 * (`app.jsx` ObraModal): overlay + panel surface, cabecera con icono/título/cierre,
 * cuerpo con scroll y pie opcional. Accesible (AA): `role="dialog"`/`aria-modal`,
 * Tab cicla DENTRO del panel, Esc cierra, clic en el overlay cierra, y el foco se
 * RESTAURA al elemento previo al cerrar. El trap usa captura para no chocar con
 * otros handlers de teclado (p.ej. el Drawer).
 */
export function Modal({ open, onClose, title, subtitle, icon, footer, compact, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subId = useId();

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    // Enfoca el primer control del panel (o el panel mismo si no hay ninguno).
    (focusables()[0] ?? panelRef.current)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const els = focusables();
      const panel = panelRef.current;
      if (!panel) return;
      if (els.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = els[0]!;
      const last = els[els.length - 1]!;
      const active = document.activeElement;
      const inside = panel.contains(active);
      if (e.shiftKey) {
        if (active === first || !inside) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !inside) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={`no-print ${styles.overlay} ${compact ? styles.sheet : ''}`} onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subId : undefined}
        tabIndex={-1}
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          {icon && (
            <span className={styles.iconChip}>
              <Icon name={icon} size={17} />
            </span>
          )}
          <div className={styles.heFill}>
            <div id={titleId} className={styles.title}>
              {title}
            </div>
            {subtitle && (
              <div id={subId} className={styles.subtitle}>
                {subtitle}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="tcol icon-btn">
            <Icon name="x" size={17} />
          </button>
        </div>
        <div className={`scroll-thin ${styles.body}`}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}

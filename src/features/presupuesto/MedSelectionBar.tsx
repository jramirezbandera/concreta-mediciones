import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '../../components';
import { lineParcial } from '../../core/medicion';
import { fmtNum, round2 } from '../../core/money';
import type { Partida } from '../../core/types';
import { copyLines, deleteLines, duplicateLines, moveLinesBy } from '../../store/medLineOps';
import { useMedUiStore } from '../../store/medUiStore';
import styles from './Presupuesto.module.css';

const EMPTY: string[] = [];

/** Botón de la barra. En compacto es solo icono (con `aria-label`, 44 px). El
 *  foco se lleva al botón en `pointerdown`: en macOS un click no enfoca, y
 *  Subir/Bajar deben dejarlo ahí para repetir. */
function BarBtn({
  icon,
  label,
  title,
  onClick,
  disabled = false,
  danger = false,
  iconOnly = false,
}: {
  icon: IconName;
  label: string;
  title?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <button
      type="button"
      className={`tcol ${styles.medBarBtn} ${danger ? styles.medBarDanger : ''} ${iconOnly ? styles.medBarIcon : ''}`}
      title={title ?? label}
      aria-label={iconOnly ? label : undefined}
      disabled={disabled}
      onPointerDown={(e) => e.currentTarget.focus()}
      onClick={onClick}
    >
      <Icon name={icon} size={14} />
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}

/** Menú «Más» de la barra en compacto (Duplicar, Subir, Bajar · Eliminar). */
function MoreMenu({ children }: { children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div ref={wrap} className={styles.medBarMore}>
      <button
        ref={trigger}
        type="button"
        className={`tcol ${styles.medBarBtn} ${styles.medBarIcon}`}
        aria-label="Más acciones de las líneas"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="dots" size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className={styles.medBarMenu}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              close();
            }
          }}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`${styles.medBarMenuItem} ${danger ? styles.medBarDanger : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={14} /> {label}
    </button>
  );
}

/**
 * Barra de la selección de líneas: franja PROPIA y pegajosa (`sticky; bottom:
 * 0` en el contenedor con scroll), fuera de `.medWrap` (que recorta) y encima
 * del pie, que nunca sustituye: «Añadir línea», «Pegar» y la cantidad siguen a
 * la vista. «N líneas · Σ parciales» + Copiar · Duplicar · Subir · Bajar ·
 * Eliminar + quitar selección. En compacto: Copiar + «Más» + quitar.
 */
export function MedSelectionBar({ p, compact }: { p: Partida; compact: boolean }) {
  const selected = useMedUiStore((s) => (s.partidaId === p.id ? s.selected : EMPTY));
  const clearSelection = useMedUiStore((s) => s.clearSelection);
  const ordered = p.med.filter((l) => selected.includes(l.id));
  if (!ordered.length) return null;

  const ids = ordered.map((l) => l.id);
  const n = ids.length;
  const sum = round2(ordered.reduce((a, l) => a + lineParcial(l), 0));
  const canUp = p.med[0]?.id !== undefined && !selected.includes(p.med[0].id);
  const canDown = p.med.at(-1)?.id !== undefined && !selected.includes(p.med.at(-1)!.id);
  const copy = () => copyLines(p.id, ids);
  const dup = () => duplicateLines(p.id, ids);
  const up = () => moveLinesBy(p.id, ids, -1);
  const down = () => moveLinesBy(p.id, ids, 1);
  const del = () => deleteLines(p.id, ids, { toast: true, col: 0 });

  return (
    <div
      className={`no-print ${styles.medBar} ${compact ? styles.medBarCompact : ''}`}
      role="toolbar"
      aria-label="Líneas seleccionadas"
      data-medbar=""
    >
      <span className={styles.medBarCount}>
        <span className={styles.medBarN}>
          {n} {n === 1 ? 'línea' : 'líneas'}
        </span>
        <span className={`mono ${styles.medBarSum}`} title="Suma de los parciales seleccionados">
          Σ {fmtNum(sum)} {p.ud}
        </span>
      </span>
      <div className={styles.medBarActions}>
        {compact ? (
          <>
            <BarBtn icon="copy" label="Copiar" onClick={copy} iconOnly />
            <MoreMenu>
              {(close) => {
                const then = (fn: () => void) => () => {
                  close();
                  fn();
                };
                return (
                  <>
                    <MenuItem icon="duplicate" label="Duplicar" onClick={then(dup)} />
                    <MenuItem icon="arrowUp" label="Subir" disabled={!canUp} onClick={then(up)} />
                    <MenuItem icon="arrowDown" label="Bajar" disabled={!canDown} onClick={then(down)} />
                    <div className={styles.medBarMenuSep} role="separator" />
                    <MenuItem icon="trash" label="Eliminar" danger onClick={then(del)} />
                  </>
                );
              }}
            </MoreMenu>
          </>
        ) : (
          <>
            <BarBtn icon="copy" label="Copiar" title="Copiar las líneas (Ctrl/⌘+C)" onClick={copy} />
            <BarBtn icon="duplicate" label="Duplicar" title="Duplicar las líneas (Ctrl/⌘+D)" onClick={dup} />
            <BarBtn icon="arrowUp" label="Subir" title="Subir una posición (Alt+↑)" onClick={up} disabled={!canUp} />
            <BarBtn icon="arrowDown" label="Bajar" title="Bajar una posición (Alt+↓)" onClick={down} disabled={!canDown} />
            <BarBtn icon="trash" label="Eliminar" title="Eliminar las líneas" onClick={del} danger />
          </>
        )}
        <BarBtn icon="x" label="Quitar la selección" title="Quitar la selección (Esc)" onClick={clearSelection} iconOnly />
      </div>
    </div>
  );
}

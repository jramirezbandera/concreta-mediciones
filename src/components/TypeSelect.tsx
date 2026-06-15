import { useEffect, useRef, useState } from 'react';
import { Badge } from './Badge';
import { Icon } from './Icon';
import type { ResourceType } from '../core/types';
import styles from './TypeSelect.module.css';

/** Tipos editables del descompuesto. `%CI` se excluye a propósito: cambiar una
 *  línea a/desde costes indirectos altera el cálculo y queda fuera de alcance. */
const TYPES: [ResourceType, string][] = [
  ['MO', 'Mano de obra'],
  ['MQ', 'Maquinaria'],
  ['MAT', 'Materiales'],
];

export interface TypeSelectProps {
  value: ResourceType;
  onCommit: (value: ResourceType) => void;
  ariaLabel?: string;
}

/**
 * Selector de tipo de recurso (MO/MQ/MAT). Espeja el patrón de `UdSelect`:
 * desplegable con posición FIJA calculada desde el trigger (vive dentro de la
 * tabla de justificación, con overflow que recortaría un popover absoluto; se
 * cierra al hacer scroll). El trigger es el propio Badge de color.
 */
export function TypeSelect({ value, onCommit, ariaLabel }: TypeSelectProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onScroll() {
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      const r = ref.current?.getBoundingClientRect();
      if (r) {
        const alto = 150;
        const top = r.bottom + alto > window.innerHeight ? Math.max(8, r.top - alto) : r.bottom + 4;
        setPos({ top, left: Math.min(r.left, window.innerWidth - 176 - 8) });
      }
    }
    setOpen((o) => !o);
  }

  function pick(t: ResourceType) {
    if (t !== value) onCommit(t);
    setOpen(false);
  }

  return (
    <span ref={ref} className={styles.wrap}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-editcell=""
        className={`tcol ${styles.trigger}`}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      >
        <Badge type={value} />
        <Icon name="chevronDown" size={11} style={{ color: 'var(--text-disabled)', flexShrink: 0 }} />
      </button>
      {open && pos && (
        <div
          role="listbox"
          className={styles.popover}
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
        >
          {TYPES.map(([t, label]) => {
            const on = t === value;
            return (
              <button
                key={t}
                type="button"
                role="option"
                aria-selected={on}
                className={`tcol ${styles.option} ${on ? styles.on : ''}`}
                onClick={() => pick(t)}
              >
                <Badge type={t} />
                <span className={styles.optLabel}>{label}</span>
                {on && <Icon name="check" size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}

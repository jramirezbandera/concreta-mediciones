import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import styles from './UdSelect.module.css';

/** Unidades habituales de medición en obra (petición de dogfood, post-F8). */
const UNITS: [string, string][] = [
  ['ud', 'unidad'],
  ['m', 'metro lineal'],
  ['m²', 'superficie'],
  ['m³', 'volumen'],
  ['kg', 'kilogramo'],
  ['t', 'tonelada'],
  ['l', 'litro'],
  ['h', 'hora'],
  ['pa', 'partida alzada'],
  ['mes', 'mes'],
];

export interface UdSelectProps {
  value: string;
  onCommit: (value: string) => void;
  ariaLabel?: string;
}

/**
 * Selector de unidad de medida: desplegable con las unidades comunes + entrada
 * libre para las raras («Otra…»). Sustituye al texto libre de F8.0 — teclear
 * "m2"/"M2"/"m^2" a mano fragmentaba las unidades. El popover va en posición
 * FIJA calculada desde el trigger: vive dentro de tablas con overflow
 * hidden/auto que recortarían uno absoluto (se cierra al hacer scroll).
 */
export function UdSelect({ value, onCommit, ariaLabel }: UdSelectProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [custom, setCustom] = useState('');
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
        // Pegado al trigger, sin salirse del viewport por abajo ni la derecha.
        const alto = 330;
        const top = r.bottom + alto > window.innerHeight ? Math.max(8, r.top - alto) : r.bottom + 4;
        setPos({ top, left: Math.min(r.left, window.innerWidth - 196 - 8) });
      }
      setCustom('');
    }
    setOpen((o) => !o);
  }

  function pick(u: string) {
    const v = u.trim();
    if (v && v !== value) onCommit(v);
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
        className={`mono tcol ${styles.trigger}`}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      >
        {value || <span className={styles.placeholder}>ud</span>}
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
          {UNITS.map(([u, label]) => {
            const on = u === value;
            return (
              <button
                key={u}
                type="button"
                role="option"
                aria-selected={on}
                className={`tcol ${styles.option} ${on ? styles.on : ''}`}
                onClick={() => pick(u)}
              >
                <span className={`mono ${styles.optUd}`}>{u}</span>
                <span className={styles.optLabel}>{label}</span>
                {on && <Icon name="check" size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
              </button>
            );
          })}
          <div className={styles.customRow}>
            <input
              value={custom}
              placeholder="Otra unidad…"
              aria-label="Otra unidad"
              size={1}
              className={styles.customInput}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') pick(custom);
                if (e.key === 'Escape') setOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </span>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import styles from './IvaSelect.module.css';

const OPTS: [number, string][] = [
  [0.1, 'Reforma de vivienda'],
  [0.21, 'Obra nueva'],
];

export interface IvaSelectProps {
  rate: number;
  onChange: (rate: number) => void;
  align?: 'left' | 'right';
}

/** Selector de tipo de IVA (10% reforma / 21% obra nueva). */
export function IvaSelect({ rate, onChange, align = 'left' }: IvaSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <span ref={ref} className={styles.wrap}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`tcol ${styles.trigger}`}
        title="Cambiar tipo de IVA"
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ background: open ? 'var(--bg-surface)' : 'transparent' }}
      >
        IVA {Math.round(rate * 100)}%
        <Icon name="chevronDown" size={12} style={{ color: 'var(--text-disabled)' }} />
      </button>
      {open && (
        <div
          role="listbox"
          onClick={(e) => e.stopPropagation()}
          className={styles.popover}
          style={{ [align]: 0 }}
        >
          {OPTS.map(([r, label]) => {
            const on = Math.abs(r - rate) < 0.001;
            return (
              <button
                key={r}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => {
                  onChange(r);
                  setOpen(false);
                }}
                className={`tcol ${styles.option} ${on ? styles.on : ''}`}
              >
                <span className={`mono ${styles.optPct}`}>{Math.round(r * 100)}%</span>
                <span className={styles.optLabel}>{label}</span>
                {on && (
                  <Icon name="check" size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}

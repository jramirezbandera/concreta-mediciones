import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components';
import { MED_FORMAS, formaDeUd, medFormaDef } from '../../core/medForma';
import type { MedForma } from '../../core/types';
import styles from './MedFormaSelect.module.css';

const ANCHO = 264;
const ALTO = 420;

/**
 * Selector de la forma de medir de una partida: qué columnas tiene su tabla de
 * medición (Uds · Superficie, Uds · Longitud · Anchura…). «Según la unidad»
 * deja que decida la ud (m → Longitud, m² → Superficie…); elegir una forma la
 * fija. Popover en posición FIJA, como `UdSelect`: vive dentro de la tabla de
 * partidas, cuyos contenedores recortarían uno absoluto.
 */
export function MedFormaSelect({
  forma,
  ud,
  onChange,
}: {
  /** Forma elegida a mano; undefined = la de la unidad. */
  forma: MedForma | undefined;
  ud: string;
  onChange: (forma: MedForma | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const auto = medFormaDef(formaDeUd(ud));
  const actual = forma ? medFormaDef(forma) : auto;

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
        // Alineado a la derecha del trigger, sin salirse del viewport.
        const top = r.bottom + ALTO > window.innerHeight ? Math.max(8, r.top - ALTO) : r.bottom + 4;
        const left = Math.max(8, Math.min(r.right - ANCHO, window.innerWidth - ANCHO - 8));
        setPos({ top, left });
      }
    }
    setOpen((o) => !o);
  }

  function pick(f: MedForma | undefined) {
    if (f !== forma) onChange(f);
    setOpen(false);
  }

  return (
    <span ref={ref} className={styles.wrap}>
      <button
        type="button"
        aria-label={`Forma de medir: ${actual.nombre}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Qué columnas tiene la medición de esta partida"
        className={`tcol ${styles.trigger}`}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      >
        <span className={`caps ${styles.label}`}>Medir por</span>
        <span className={styles.value}>{actual.nombre}</span>
        <Icon name="chevronDown" size={12} style={{ color: 'var(--text-disabled)', flexShrink: 0 }} />
      </button>
      {open && pos && (
        <div
          role="listbox"
          aria-label="Forma de medir"
          className={styles.popover}
          style={{ top: pos.top, left: pos.left, width: ANCHO }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
        >
          <Opcion
            on={forma === undefined}
            nombre="Según la unidad"
            detalle={`${ud || 'sin ud'} → ${auto.nombre}`}
            onPick={() => pick(undefined)}
          />
          <div className={styles.sep} />
          {MED_FORMAS.map((f) => (
            <Opcion
              key={f.id}
              on={forma === f.id}
              nombre={f.nombre}
              detalle={f.cols.join(' × ')}
              onPick={() => pick(f.id)}
            />
          ))}
        </div>
      )}
    </span>
  );
}

function Opcion({
  on,
  nombre,
  detalle,
  onPick,
}: {
  on: boolean;
  nombre: string;
  detalle: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={on}
      className={`tcol ${styles.option} ${on ? styles.on : ''}`}
      onClick={onPick}
    >
      <span className={styles.optText}>
        <span className={styles.optNombre}>{nombre}</span>
        <span className={`mono ${styles.optDetalle}`}>{detalle}</span>
      </span>
      {on && <Icon name="check" size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
    </button>
  );
}

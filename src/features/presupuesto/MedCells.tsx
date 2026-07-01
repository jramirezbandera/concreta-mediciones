import { useEffect, useRef, useState } from 'react';
import { fmtNum, parseEsNumber, toDecimalComma } from '../../core/money';
import { consumeArmNextEdit } from '../../hooks/editGridNav';
import styles from './Presupuesto.module.css';

type Align = 'left' | 'center' | 'right';

/**
 * Celda numérica de medición. Admite VACÍO (= factor 1, se pinta "·"), a
 * diferencia de `EditableNum`. Enter confirma, Esc cancela. El valor vacío se
 * propaga como `''` (la dimensión no anula la línea).
 *
 * Tab/Enter encadenan edición (hoja de cálculo) vía `useMedGridTab` colgado del
 * contenedor: al recibir el foco con la apertura ARMADA, la celda en reposo
 * entra en edición sola (`onFocus` → `consumeArmNextEdit`). El input hace
 * `focus()+select()` (sin el `focus()` el Tab dejaba el input sin foco). Esc
 * cancela y DEVUELVE el foco a la celda en reposo (no se pierde la posición).
 */
export function MedNum({
  value,
  dec = 2,
  align = 'right',
  onCommit,
  ariaLabel,
}: {
  value: number | '';
  dec?: number;
  align?: Align;
  onCommit: (value: number | '') => void;
  ariaLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const displayRef = useRef<HTMLButtonElement>(null);
  const wantRefocus = useRef(false);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    } else if (wantRefocus.current) {
      wantRefocus.current = false;
      displayRef.current?.focus();
    }
  }, [editing]);

  const isBlank = value === '' || value == null || Number.isNaN(Number(value));

  function start() {
    setDraft(isBlank ? '' : fmtNum(Number(value), dec).replace(/\./g, ''));
    setEditing(true);
  }
  function commit() {
    setEditing(false);
    const s = draft.trim();
    if (s === '') {
      onCommit('');
      return;
    }
    const n = parseEsNumber(s);
    if (n !== null) onCommit(n);
  }
  function cancel() {
    wantRefocus.current = true; // Esc: vuelve el foco a la celda en reposo
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        inputMode="decimal"
        aria-label={ariaLabel}
        size={1} // sin esto el ancho intrínseco (~20ch) revienta la columna al editar
        className={`mono ${styles.medCellInput}`}
        style={{ textAlign: align }}
        onChange={(e) => setDraft(toDecimalComma(e.target.value))} // punto del numpad → coma
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') cancel();
        }}
      />
    );
  }
  return (
    <button
      ref={displayRef}
      type="button"
      aria-label={ariaLabel}
      data-editcell=""
      className={`mono tcol ${styles.medCellBtn} ${isBlank ? styles.blank : ''}`}
      style={{ textAlign: align }}
      onClick={start}
      onFocus={(e) => {
        if (consumeArmNextEdit(e.currentTarget)) start();
      }}
    >
      {isBlank ? '·' : fmtNum(Number(value), dec)}
    </button>
  );
}

/** Comentario de una línea de medición (texto libre, placeholder en cursiva). */
export function MedComment({
  value,
  onCommit,
  ariaLabel,
}: {
  value: string;
  onCommit: (value: string) => void;
  ariaLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const displayRef = useRef<HTMLSpanElement>(null);
  const wantRefocus = useRef(false);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    } else if (wantRefocus.current) {
      wantRefocus.current = false;
      displayRef.current?.focus();
    }
  }, [editing]);

  function start() {
    setDraft(value || '');
    setEditing(true);
  }
  function commit() {
    setEditing(false);
    onCommit(draft);
  }
  function cancel() {
    wantRefocus.current = true;
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        placeholder="Comentario…"
        aria-label={ariaLabel}
        size={1} // ancho gobernado por la columna, no por el intrínseco del input
        className={styles.medCommentInput}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') cancel();
        }}
      />
    );
  }
  return (
    <span
      ref={displayRef}
      role="textbox"
      tabIndex={0}
      aria-label={ariaLabel}
      data-editcell=""
      className={`tcol ${styles.medComment} ${value ? '' : styles.empty}`}
      onClick={start}
      onFocus={(e) => {
        if (consumeArmNextEdit(e.currentTarget)) start();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          start();
        }
      }}
    >
      {value || 'Comentario…'}
    </span>
  );
}

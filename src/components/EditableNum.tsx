import { useEffect, useRef, useState } from 'react';
import { fmtNum, parseEsNumber } from '../core/money';
import styles from './EditableNum.module.css';

export interface EditableNumProps {
  value: number;
  dec?: number;
  onCommit: (value: number) => void;
  bold?: boolean;
  accent?: boolean;
  /** Etiqueta accesible para la celda editable. */
  ariaLabel?: string;
}

/**
 * Celda numérica editable inline. Click → input con anillo accent; Enter
 * confirma, Esc cancela. Formato español (miles punto, decimales coma) vía
 * `core/money`. `role="textbox"` + foco gestionado (§6 a11y).
 */
export function EditableNum({
  value,
  dec = 2,
  onCommit,
  bold = false,
  accent = false,
  ariaLabel,
}: EditableNumProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function start() {
    // Edita sin separadores de miles: "1.234,50" → "1234,50".
    setDraft(fmtNum(value, dec).replace(/\./g, ''));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const n = parseEsNumber(draft);
    if (n !== null) onCommit(n);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        inputMode="decimal"
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className={`mono ${styles.input}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      aria-label={ariaLabel}
      data-editcell=""
      className={`mono tcol ${styles.display}`}
      style={{
        fontWeight: bold ? 600 : 400,
        color: accent
          ? 'var(--accent)'
          : bold
            ? 'var(--text-primary)'
            : 'var(--text-secondary)',
      }}
    >
      {fmtNum(value, dec)}
    </button>
  );
}

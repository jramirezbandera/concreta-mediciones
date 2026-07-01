import { useEffect, useRef, useState } from 'react';
import { fmtNum, parseEsNumber, toDecimalComma } from '../core/money';
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
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function start() {
    // Edita sin separadores de miles: "1.234,50" → "1234,50".
    setDraft(fmtNum(value, dec).replace(/\./g, ''));
    setInvalid(false);
    setEditing(true);
  }

  function close() {
    setEditing(false);
    setInvalid(false);
  }

  // Confirmación explícita (Enter): si la entrada NO es un número válido no se
  // cierra ni se descarta en silencio —en una herramienta de dinero perder un
  // número tecleado sin avisar erosiona la confianza—: se marca el campo en
  // aviso y se mantiene abierto, con el texto seleccionado, para corregir.
  function confirm() {
    const n = parseEsNumber(draft);
    if (n === null) {
      setInvalid(true);
      inputRef.current?.select();
      return;
    }
    onCommit(n);
    close();
  }

  // Salir del campo (blur/Tab): el usuario se va; no se le atrapa el foco. Si el
  // borrador es válido se confirma; si no, se cancela revirtiendo (sin commit).
  function leave() {
    const n = parseEsNumber(draft);
    if (n !== null) onCommit(n);
    close();
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        inputMode="decimal"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        size={1} // sin esto el ancho intrínseco (~20ch) deforma la columna al editar
        onChange={(e) => {
          setDraft(toDecimalComma(e.target.value)); // punto del numpad → coma decimal
          if (invalid) setInvalid(false); // está corrigiendo: quita el aviso
        }}
        onBlur={leave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') confirm();
          if (e.key === 'Escape') close();
        }}
        className={`mono ${styles.input} ${invalid ? styles.invalid : ''}`}
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

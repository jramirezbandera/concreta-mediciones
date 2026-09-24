import { useState } from 'react';
import { fmtNum, parseEsNumber, toDecimalComma } from '../core/money';
import { useInlineEdit } from '../hooks/useInlineEdit';
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
  const [invalid, setInvalid] = useState(false);
  const {
    editing,
    draft,
    setDraft,
    inputRef,
    displayRef,
    begin,
    cancel: cancelEdit,
    finish,
    armOpenOnFocus,
    leaveUnlessWindowBlur,
  } = useInlineEdit<HTMLButtonElement>();

  function start() {
    setInvalid(false);
    // Edita sin separadores de miles: "1.234,50" → "1234,50".
    begin(fmtNum(value, dec).replace(/\./g, ''));
  }

  function close() {
    finish();
    setInvalid(false);
  }

  // Esc: cierra sin confirmar y DEVUELVE el foco a la celda en reposo (para no
  // perder la posición al navegar el grid con teclado).
  function cancel() {
    setInvalid(false);
    cancelEdit();
  }

  // Confirmación explícita (Enter): si la entrada NO es un número válido no se
  // cierra ni se descarta en silencio —en una herramienta de dinero perder un
  // número tecleado sin avisar erosiona la confianza—: se marca el campo en
  // aviso y se mantiene abierto, con el texto seleccionado, para corregir.
  // Devuelve `true` si confirmó/cerró, `false` si sigue abierto por inválido —
  // el caller usa el booleano para decidir si deja navegar el grid (stopPropagation).
  function confirm(): boolean {
    const n = parseEsNumber(draft);
    if (n === null) {
      setInvalid(true);
      inputRef.current?.select();
      return false;
    }
    onCommit(n);
    close();
    return true;
  }

  // Salir del campo (blur/Tab): el usuario se va; no se le atrapa el foco. Si el
  // borrador es válido se confirma; si no, se cancela revirtiendo (sin commit).
  // Cambiar de ventana no cuenta como salir (`leaveUnlessWindowBlur`).
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
        onBlur={leaveUnlessWindowBlur(leave)}
        onKeyDown={(e) => {
          // Enter válido → burbujea a useMedGridTab (baja una fila). Enter inválido
          // → la celda se queda abierta con el aviso y NO se propaga (el grid no mueve).
          if (e.key === 'Enter' && !confirm()) e.stopPropagation();
          if (e.key === 'Escape') cancel();
        }}
        className={`mono ${styles.input} ${invalid ? styles.invalid : ''}`}
      />
    );
  }

  return (
    <button
      ref={displayRef}
      type="button"
      onClick={start}
      // Tab/Enter arman la apertura de esta celda (useMedGridTab): al recibir el
      // foco armado, entra en edición sola. Fuera de un grid nadie arma → no-op.
      onFocus={armOpenOnFocus(start)}
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

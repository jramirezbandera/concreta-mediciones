import { fmtNum, parseEsNumber, toDecimalComma } from '../../core/money';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import styles from './Presupuesto.module.css';

type Align = 'left' | 'center' | 'right';

/**
 * Celda numérica de medición. Admite VACÍO (= factor 1, se pinta "·"), a
 * diferencia de `EditableNum`. Enter confirma, Esc cancela. El valor vacío se
 * propaga como `''` (la dimensión no anula la línea).
 *
 * El ciclo de vida (foco+select al editar, refoco en Esc, apertura ARMADA por
 * Tab/Enter del grid vía `useMedGridTab`) vive en `useInlineEdit`; aquí solo el
 * parse/formato específico de medición (admite vacío, sin aviso de inválido).
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
  const { editing, draft, setDraft, inputRef, displayRef, begin, cancel, finish, armOpenOnFocus } =
    useInlineEdit<HTMLButtonElement>();

  const isBlank = value === '' || value == null || Number.isNaN(Number(value));

  function start() {
    begin(isBlank ? '' : fmtNum(Number(value), dec).replace(/\./g, ''));
  }
  function commit() {
    finish();
    const s = draft.trim();
    if (s === '') {
      onCommit(''); // vaciar propaga "" (la dimensión no anula la línea)
      return;
    }
    const n = parseEsNumber(s);
    if (n !== null) onCommit(n);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
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
      onFocus={armOpenOnFocus(start)}
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
  const { editing, draft, setDraft, inputRef, displayRef, begin, cancel, finish, armOpenOnFocus } =
    useInlineEdit<HTMLSpanElement>();

  function start() {
    begin(value || '');
  }
  function commit() {
    finish();
    onCommit(draft);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
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
      onFocus={armOpenOnFocus(start)}
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

import { useInlineEdit } from '../hooks/useInlineEdit';
import styles from './EditableText.module.css';

function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

export interface EditableTextProps {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  ariaLabel?: string;
}

/**
 * Texto editable inline (descripciones, títulos). Click → textarea autoajustada
 * con anillo accent; Enter confirma, Shift+Enter salto de línea, Esc cancela.
 *
 * El ciclo de vida (estado, arm-open por Tab/Enter del grid, refoco en Esc) vive
 * en `useInlineEdit`; el editor es un `<textarea>` que al abrirse pone el caret
 * al final y se autoajusta (no selecciona todo, a diferencia de las numéricas).
 */
export function EditableText({
  value,
  onCommit,
  className = '',
  style,
  placeholder = '—',
  ariaLabel,
}: EditableTextProps) {
  const { editing, draft, setDraft, inputRef, displayRef, begin, cancel, finish, armOpenOnFocus } =
    useInlineEdit<HTMLSpanElement, HTMLTextAreaElement>((el) => {
      el.focus();
      el.selectionStart = el.selectionEnd = el.value.length; // caret al final
      autosize(el);
    });

  function start() {
    begin(value || '');
  }
  function commit() {
    finish();
    // Permite vaciar el campo (v === ''): solo se omite cuando no hay cambio.
    // Esc cancela sin pasar por aquí, así que blur/Enter con vacío = borrar.
    const v = draft.replace(/\s+$/, '');
    if (v !== value) onCommit(v);
  }

  if (editing) {
    return (
      <textarea
        ref={inputRef}
        value={draft}
        rows={1}
        aria-label={ariaLabel}
        onChange={(e) => {
          setDraft(e.target.value);
          autosize(e.target);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Escape') cancel();
        }}
        // El `style` del display también se aplica al editor para que tamaño/
        // color de fuente coincidan (p. ej. el título grande de un capítulo).
        style={style}
        className={styles.input}
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
      className={`tcol ${styles.display} ${className}`}
      style={style}
      onClick={start}
      onFocus={armOpenOnFocus(start)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          start();
        }
      }}
    >
      {value || <span className={styles.placeholder}>{placeholder}</span>}
    </span>
  );
}

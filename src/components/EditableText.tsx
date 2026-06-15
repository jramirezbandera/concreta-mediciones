import { useEffect, useRef, useState } from 'react';
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
 */
export function EditableText({
  value,
  onCommit,
  className = '',
  style,
  placeholder = '—',
  ariaLabel,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && ref.current) {
      const el = ref.current;
      el.focus();
      el.selectionStart = el.selectionEnd = el.value.length;
      autosize(el);
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    // Permite vaciar el campo (v === ''): solo se omite cuando no hay cambio.
    // Esc cancela sin pasar por aquí, así que blur/Enter con vacío = borrar.
    const v = draft.replace(/\s+$/, '');
    if (v !== value) onCommit(v);
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
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
          if (e.key === 'Escape') setEditing(false);
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
      role="textbox"
      tabIndex={0}
      aria-label={ariaLabel}
      data-editcell=""
      className={`tcol ${styles.display} ${className}`}
      style={style}
      onClick={() => {
        setDraft(value || '');
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setDraft(value || '');
          setEditing(true);
        }
      }}
    >
      {value || <span className={styles.placeholder}>{placeholder}</span>}
    </span>
  );
}

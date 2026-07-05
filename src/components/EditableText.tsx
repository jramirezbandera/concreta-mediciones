import { useInlineEdit } from '../hooks/useInlineEdit';
import styles from './EditableText.module.css';

/** Ancestro scrollable más cercano (null si sólo scrollea el documento). */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

/**
 * Ajusta la altura del textarea al contenido y NEUTRALIZA el salto de scroll:
 * con el editor dentro de una cabecera `sticky`, al teclear el navegador hace
 * scroll-into-view del caret DESPUÉS del evento de input y, respetando el
 * `scroll-padding-top` del contenedor, empuja la lista hacia arriba en cada tecla.
 * Restaurar el `scrollTop` de forma síncrona no basta (el navegador re-scrollea
 * tras el handler); hay que restaurarlo en el siguiente frame, ya pasado ese
 * scroll. Fuera de un contenedor sticky el scrollTop no cambia → no-op.
 */
function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  const scroller = scrollParent(el);
  const top = scroller?.scrollTop;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
  if (scroller && top != null) {
    requestAnimationFrame(() => {
      if (scroller.scrollTop !== top) scroller.scrollTop = top;
    });
  }
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

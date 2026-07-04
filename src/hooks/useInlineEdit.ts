import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { consumeArmNextEdit } from './editGridNav';

/**
 * Ciclo de vida compartido de una celda editable inline de UNA línea
 * (display ↔ input). Reúne lo que `EditableNum`, `MedNum` y `MedComment`
 * copiaban idéntico:
 *  - estado `editing` / `draft`,
 *  - `focus()+select()` al entrar en edición (sin el `focus()`, un Tab/Enter que
 *    ARMA la celda dejaría el input sin foco),
 *  - refoco de la celda en reposo al cancelar con Esc (no se pierde la posición),
 *  - apertura ARMADA al recibir el foco (Tab/Enter del grid → `consumeArmNextEdit`).
 *
 * Cada celda aporta su propio parse/formato/estilo y su `start()` (borrador
 * inicial + cualquier reset propio).
 *
 * `D` es el tipo del elemento display (button de las numéricas, span de texto).
 * `I` es el tipo del editor: `<input>` por defecto (numéricas, comentario) o
 * `<textarea>` (`EditableText`). `onEnterEdit` sustituye el `focus()+select()`
 * por defecto cuando el editor necesita otra cosa (p. ej. el textarea pone el
 * caret al final + autosize en vez de seleccionar todo).
 */
export function useInlineEdit<
  D extends HTMLElement,
  I extends HTMLInputElement | HTMLTextAreaElement = HTMLInputElement,
>(onEnterEdit?: (el: I) => void) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<I>(null);
  const displayRef = useRef<D>(null);
  const wantRefocus = useRef(false);

  useEffect(() => {
    if (editing) {
      const el = inputRef.current;
      if (!el) return;
      if (onEnterEdit) onEnterEdit(el);
      else {
        el.focus();
        el.select();
      }
    } else if (wantRefocus.current) {
      wantRefocus.current = false;
      displayRef.current?.focus();
    }
  }, [editing]);

  /** Entra en edición con el borrador inicial dado. */
  function begin(initialDraft: string) {
    setDraft(initialDraft);
    setEditing(true);
  }
  /** Cierra sin confirmar y DEVUELVE el foco a la celda en reposo (Esc). */
  function cancel() {
    wantRefocus.current = true;
    setEditing(false);
  }
  /** Cierra la edición; el commit del valor lo decide el caller. */
  function finish() {
    setEditing(false);
  }
  /** `onFocus` de la celda display: abre `open()` SOLO si el foco viene ARMADO
   *  (un Tab/Enter del grid). Fuera de un grid nadie arma → no-op. */
  function armOpenOnFocus(open: () => void) {
    return (e: FocusEvent<D>) => {
      if (consumeArmNextEdit(e.currentTarget)) open();
    };
  }

  return { editing, draft, setDraft, inputRef, displayRef, begin, cancel, finish, armOpenOnFocus };
}

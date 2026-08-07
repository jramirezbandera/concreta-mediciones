import { useEffect, useRef, useState } from 'react';
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
  /**
   * ¿Salir del campo (blur/Tab) confirma y cierra? Por defecto sí: es el gesto
   * del grid (encadenar celdas sin pulsar Enter en cada una).
   *
   * `false` = CONFIRMACIÓN EXPLÍCITA: pinchar fuera no cierra el editor ni
   * descarta lo tecleado; sólo Enter confirma y sólo Esc cancela. Para campos
   * sueltos y de mucho peso, donde el usuario teclea, mira otra cosa y vuelve
   * (el coeficiente K reescala TODO el presupuesto) — feedback de obra.
   */
  commitOnBlur?: boolean;
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
  commitOnBlur = true,
}: EditableNumProps) {
  const [invalid, setInvalid] = useState(false);
  const { editing, draft, setDraft, inputRef, displayRef, begin, cancel: cancelEdit, finish, armOpenOnFocus } =
    useInlineEdit<HTMLButtonElement>();

  // ¿El editor quedó abierto SIN foco (modo confirmación explícita)? El usuario
  // se fue a otra cosa con lo tecleado a medias.
  const parked = useRef(false);

  // Si mientras está aparcado el valor cambia por otra vía (el modal «Ajusta»
  // escribe el K), el borrador se resincroniza: al volver, Enter no debe
  // reescribir el dato nuevo con uno viejo.
  useEffect(() => {
    if (commitOnBlur || !editing || !parked.current) return;
    setDraft(fmtNum(value, dec).replace(/\./g, ''));
  }, [value, dec, commitOnBlur, editing, setDraft]);

  function start() {
    setInvalid(false);
    parked.current = false;
    // Edita sin separadores de miles: "1.234,50" → "1234,50".
    begin(fmtNum(value, dec).replace(/\./g, ''));
  }

  function close() {
    finish();
    setInvalid(false);
    parked.current = false;
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
  // En modo confirmación explícita NO se hace nada: el editor queda abierto con
  // lo tecleado, esperando Enter (o Esc). No se roba el foco de vuelta —el resto
  // de la app sigue usable— y al volver a pinchar se sigue donde se dejó.
  function leave() {
    if (!commitOnBlur) {
      parked.current = true;
      return;
    }
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
        title={commitOnBlur ? undefined : 'Enter para aplicar · Esc para cancelar'}
        size={1} // sin esto el ancho intrínseco (~20ch) deforma la columna al editar
        onChange={(e) => {
          setDraft(toDecimalComma(e.target.value)); // punto del numpad → coma decimal
          if (invalid) setInvalid(false); // está corrigiendo: quita el aviso
        }}
        onBlur={leave}
        onFocus={() => {
          parked.current = false; // vuelve a tenerlo delante: deja de estar aparcado
        }}
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

import { useRef, useState } from 'react';
import { leerCelda } from '../../core/expresion';
import { nombrePerfil } from '../../core/perfiles';
import { fmtNum, toDecimalComma } from '../../core/money';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import styles from './Presupuesto.module.css';

type Align = 'left' | 'center' | 'right';

/**
 * Celda numérica de medición. Admite VACÍO (= factor 1, se pinta "·"), a
 * diferencia de `EditableNum`, y OPERACIONES ("5,57+3", "2×4,5", "(12-0,3)/2",
 * `core/expresion`) y PERFILES ("IPE 300", "Ø12" → su kg/m, `core/perfiles`):
 * se guarda el resultado y, aparte, lo tecleado (`expr`), que es lo que se
 * vuelve a ver al editar. En reposo, un perfil enseña su nombre junto al peso
 * y una operación la marca «ƒ»; el title da el detalle. Enter confirma, Esc
 * cancela. El valor vacío se
 * propaga como `''` (la dimensión no anula la línea).
 *
 * Como `EditableNum`: Enter con algo que no se puede leer NO cierra ni descarta
 * en silencio (aviso + sigue abierta); salir del campo (blur/Tab) revierte. Si
 * el borrador no cambió no se confirma nada: recorrer la fila con Tab no debe
 * redondear a 2 decimales un 316,3978 pegado de CAD ni quitar el chip BASE.
 *
 * El ciclo de vida (foco+select al editar, refoco en Esc, apertura ARMADA por
 * Tab/Enter del grid vía `useMedGridTab`) vive en `useInlineEdit`.
 */
export function MedNum({
  value,
  expr,
  dec = 2,
  align = 'right',
  onCommit,
  ariaLabel,
}: {
  value: number | '';
  /** Operación de la que sale `value`, si se tecleó una. */
  expr?: string;
  dec?: number;
  align?: Align;
  onCommit: (value: number | '', expr?: string) => void;
  ariaLabel?: string;
}) {
  const { editing, draft, setDraft, inputRef, displayRef, begin, cancel, finish, armOpenOnFocus } =
    useInlineEdit<HTMLButtonElement>();
  const [invalid, setInvalid] = useState(false);
  const inicial = useRef('');

  const isBlank = value === '' || value == null || Number.isNaN(Number(value));
  const perfil = expr ? nombrePerfil(expr) : null;

  function start() {
    setInvalid(false);
    inicial.current = expr ?? (isBlank ? '' : fmtNum(Number(value), dec).replace(/\./g, ''));
    begin(inicial.current);
  }
  function close() {
    finish();
    setInvalid(false);
  }
  /** Lee el borrador: `undefined` si no hay nada que confirmar, `null` si no
   *  se puede leer. */
  function leer(): { value: number | ''; expr?: string } | null | undefined {
    const s = draft.trim();
    if (s === inicial.current.trim()) return undefined;
    if (s === '') return { value: '' }; // vaciar propaga "" (la dimensión no anula la línea)
    return leerCelda(s);
  }
  function emit(r: { value: number | ''; expr?: string }) {
    if (r.expr) onCommit(r.value, r.expr);
    else onCommit(r.value);
  }
  // Enter: devuelve false si sigue abierta por inválida (el caller corta la
  // propagación para que el grid no baje de fila).
  function confirm(): boolean {
    const r = leer();
    if (r === null) {
      setInvalid(true);
      inputRef.current?.select();
      return false;
    }
    if (r) emit(r);
    close();
    return true;
  }
  function leave() {
    const r = leer();
    if (r) emit(r);
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
        title={
          invalid
            ? 'No se puede calcular. Usa números, + − × / ( ) o un perfil del catálogo (IPE 300, HEB 200, UPN 120, Ø12…)'
            : undefined
        }
        size={1} // sin esto el ancho intrínseco (~20ch) revienta la columna al editar
        className={`mono ${styles.medCellInput} ${invalid ? styles.invalid : ''}`}
        style={{ textAlign: align }}
        onChange={(e) => {
          setDraft(toDecimalComma(e.target.value)); // punto del numpad → coma
          if (invalid) setInvalid(false); // está corrigiendo: quita el aviso
        }}
        onBlur={leave}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !confirm()) e.stopPropagation();
          if (e.key === 'Escape') {
            setInvalid(false);
            cancel();
          }
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
      title={expr && !isBlank ? `${expr} = ${fmtNum(Number(value), dec)}` : undefined}
      className={`mono tcol ${styles.medCellBtn} ${isBlank ? styles.blank : ''}`}
      style={{ textAlign: align }}
      onClick={start}
      onFocus={armOpenOnFocus(start)}
    >
      {perfil && !isBlank ? (
        <span className={styles.medPerfil}>{perfil}</span>
      ) : (
        expr &&
        !isBlank && (
          <span className={styles.medExprMark} aria-hidden="true">
            ƒ
          </span>
        )
      )}
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

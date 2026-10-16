import { useState } from 'react';
import { parseEsNumber, toDecimalComma } from '../../core/money';
import { numTexto } from './formato';
import styles from './Residuos.module.css';

/**
 * Campo numérico que admite «falta» (vacío = `null`): se confirma al salir o con
 * Enter (un paso de Deshacer por edición, no por tecla); Esc vuelve al valor.
 * Un texto que no es número no se guarda.
 */
export function CampoNum({
  value,
  onCommit,
  unidad,
  ariaLabel,
  dec = 4,
  min,
  max,
  placeholder = 'falta',
  className,
}: {
  value: number | null | undefined;
  onCommit: (v: number | null) => void;
  unidad?: string;
  ariaLabel: string;
  dec?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const commit = () => {
    if (draft == null) return;
    const t = draft.trim();
    if (t === '') {
      setDraft(null);
      setError(false);
      if (value != null) onCommit(null);
      return;
    }
    const n = parseEsNumber(t);
    if (n == null || (min != null && n < min) || (max != null && n > max)) {
      setError(true);
      return;
    }
    setDraft(null);
    setError(false);
    if (n !== value) onCommit(n);
  };
  // En naranja solo el dato que falta; un campo opcional vacío («—», «0») no avisa.
  const falta = value == null && placeholder === 'falta';
  return (
    <span className={styles.numWrap}>
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        aria-invalid={error || undefined}
        className={`${styles.input} ${styles.num} ${falta ? styles.falta : ''} ${error ? styles.inputErr : ''} ${className ?? ''}`}
        value={draft ?? numTexto(value, dec)}
        placeholder={placeholder}
        onChange={(e) => setDraft(toDecimalComma(e.target.value))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            setDraft(null);
            setError(false);
          }
        }}
      />
      {unidad && <span className={styles.unidad}>{unidad}</span>}
    </span>
  );
}

/** Campo de texto que se confirma al salir o con Enter. */
export function CampoTexto({
  value,
  onCommit,
  ariaLabel,
  placeholder,
  className,
}: {
  value: string | null | undefined;
  onCommit: (v: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft == null) return;
    setDraft(null);
    if (draft !== (value ?? '')) onCommit(draft);
  };
  return (
    <input
      type="text"
      aria-label={ariaLabel}
      className={`${styles.input} ${className ?? ''}`}
      value={draft ?? value ?? ''}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') setDraft(null);
      }}
    />
  );
}

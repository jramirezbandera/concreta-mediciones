import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import styles from './InlineCreate.module.css';

export interface InlineCreateProps {
  placeholder?: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

/** Creador inline (capítulo / subcapítulo): input + confirmar / cancelar. */
export function InlineCreate({ placeholder, onCommit, onCancel }: InlineCreateProps) {
  const [val, setVal] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function commit() {
    const v = val.trim();
    if (v) onCommit(v);
    else onCancel();
  }

  return (
    <div className={styles.wrap}>
      <input
        ref={ref}
        value={val}
        placeholder={placeholder}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') onCancel();
        }}
        className={styles.input}
      />
      <button
        type="button"
        aria-label="Confirmar"
        onMouseDown={(e) => {
          e.preventDefault();
          commit();
        }}
        className={styles.confirm}
      >
        <Icon name="check" size={15} />
      </button>
      <button
        type="button"
        aria-label="Cancelar"
        onMouseDown={(e) => {
          e.preventDefault();
          onCancel();
        }}
        className={`tcol ${styles.cancel}`}
      >
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}

/* ---------- selector de fuente ------------------------------------------- */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../components';
import styles from '../Referencia.module.css';

/** Descriptor ligero de fuente para el selector (sin cargar la obra entera). */
export interface SourceDesc {
  id: string;
  kind: 'base' | 'presupuesto';
  name: string;
  org: string;
  /** Obra de solo-referencia (importada): se puede quitar desde el selector. */
  removable?: boolean;
}

export function SourceSelect({
  sources,
  curId,
  onSelect,
  onImport,
  onDelete,
}: {
  sources: SourceDesc[];
  curId: string;
  onSelect: (id: string) => void;
  onImport: () => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  // Sin fuentes (arranque limpio: ni bases precargadas ni otras obras): la lista
  // puede estar vacía, así que `cur` puede ser undefined → placeholder, sin crash.
  const cur = sources.find((s) => s.id === curId) ?? sources[0];
  return (
    <div ref={ref} className={styles.srcWrap}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={`tcol ${styles.srcBtn}`}>
        <span className={styles.srcIcon}>
          <Icon name={cur?.kind === 'presupuesto' ? 'doc' : 'layers'} size={15} />
        </span>
        <span className={styles.srcText}>
          <span className={styles.srcName}>{cur ? cur.name : 'Sin fuentes de referencia'}</span>
          <span className={styles.srcOrg}>{cur ? cur.org : 'Añade una base o crea otra obra'}</span>
        </span>
        <Icon name="chevronDown" size={15} style={{ color: 'var(--text-disabled)', flexShrink: 0 }} />
      </button>
      {open && (
        <div className={styles.srcMenu}>
          {sources.map((s) => {
            const on = s.id === curId;
            return (
              <div key={s.id} className={styles.srcRow}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(s.id);
                    setOpen(false);
                  }}
                  className={`tcol ${styles.srcOpt} ${on ? styles.on : ''}`}
                >
                  <span className={`${styles.srcOptIcon} ${on ? styles.on : ''}`}>
                    <Icon name={s.kind === 'base' ? 'layers' : 'doc'} size={14} />
                  </span>
                  <span className={styles.srcText}>
                    <span className={`${styles.srcName} ${on ? styles.on : ''}`}>{s.name}</span>
                    <span className={styles.srcOrg}>
                      {s.org} · {s.kind === 'base' ? 'Base de precios' : 'Presupuesto'}
                    </span>
                  </span>
                </button>
                {s.removable && (
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(s.id);
                      setOpen(false);
                    }}
                    title={`Quitar ${s.name} de las referencias`}
                    aria-label={`Quitar ${s.name} de las referencias`}
                    className={`tcol ${styles.srcDel}`}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                )}
              </div>
            );
          })}
          {sources.length > 0 && <div className={styles.srcDivider} />}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onImport();
            }}
            className={`tcol ${styles.srcOpt} ${styles.srcImport}`}
          >
            <span className={styles.srcOptIcon} style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <Icon name="upload" size={15} />
            </span>
            <span className={styles.srcText}>
              <span className={styles.srcName} style={{ color: 'var(--accent)' }}>
                Añadir base de referencia…
              </span>
              <span className={styles.srcOrg}>Archivo .bc3 (FIEBDC-3) · CYPE, Presto, ITeC…</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

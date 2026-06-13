/* ===========================================================================
   ObraSwitcher — selector de obra (multi-obra T-10, PR2). Dropdown junto al
   nombre de obra: lista las obras guardadas, conmuta entre ellas, crea una nueva
   y borra (con confirmación; nunca la última). Decisión eng-review D6: un control
   DEDICADO, separado de las pestañas de VISTA (un eje "qué obra", otro "qué
   vista"). Sirve igual en móvil y escritorio (dropdown, no fila de pestañas).
   Conectado: lee `useSessionStore` y llama a la orquestación de `persist/sync`.
   =========================================================================== */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { deleteObraById, newObra, switchObra, useSessionStore } from '../persist';
import { useObraStore } from '../store';
import styles from './ObraSwitcher.module.css';

export function ObraSwitcher() {
  const obras = useSessionStore((s) => s.obras);
  const activeId = useSessionStore((s) => s.activeId);
  const switching = useSessionStore((s) => s.switching);
  // Nombre vivo de la obra en pantalla (cubre la demo nueva aún sin registrar).
  const liveName = useObraStore((s) => s.obra.denominacion);

  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmId(null);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const activeName = obras.find((o) => o.id === activeId)?.name || liveName;

  const close = () => {
    setOpen(false);
    setConfirmId(null);
  };

  return (
    <div ref={ref} className={styles.wrap}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={switching}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Cambiar de obra"
        className={`tcol ${styles.trigger}`}
      >
        <Icon name="folder" size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
        <span className={styles.triggerName}>{activeName}</span>
        <Icon name="chevronDown" size={14} style={{ color: 'var(--text-disabled)', flexShrink: 0 }} />
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          {obras.length > 0 ? (
            obras.map((o) => {
              const on = o.id === activeId;
              const confirming = confirmId === o.id;
              return (
                <div key={o.id} className={`${styles.row} ${on ? styles.on : ''}`}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={on}
                    onClick={() => {
                      if (!on) void switchObra(o.id);
                      close();
                    }}
                    className={`tcol ${styles.rowMain}`}
                  >
                    <span className={styles.rowCheck}>{on && <Icon name="check" size={13} />}</span>
                    <span className={styles.rowName}>{o.name}</span>
                  </button>
                  {confirming ? (
                    <span className={styles.confirm}>
                      <button
                        type="button"
                        onClick={() => {
                          void deleteObraById(o.id);
                          close();
                        }}
                        className={`tcol ${styles.confirmYes}`}
                      >
                        Borrar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className={`tcol ${styles.confirmNo}`}
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(o.id)}
                      title={`Borrar ${o.name}`}
                      aria-label={`Borrar ${o.name}`}
                      className={`tcol ${styles.del}`}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div className={styles.empty}>Aún no hay obras guardadas</div>
          )}
          <div className={styles.divider} />
          <button
            type="button"
            onClick={() => {
              void newObra();
              close();
            }}
            className={`tcol ${styles.new}`}
          >
            <span className={styles.newIcon}>
              <Icon name="plus" size={14} />
            </span>
            Nueva obra
          </button>
        </div>
      )}
    </div>
  );
}

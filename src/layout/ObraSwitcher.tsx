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
import { Modal } from '../components/Modal';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { deleteObraById, newObra, switchObra, useSessionStore } from '../persist';
import {
  abrirCarpeta,
  abrirObraDeCarpeta,
  dejarLaCarpeta,
  hayCarpetas,
  pasarACarpeta,
  useCarpetaStore,
  type Directorio,
  type ResultadoCarpeta,
} from '../persist/carpeta';
import { CarpetaChip } from '../features/carpeta/CarpetaChip';
import { TrabajarConClaude } from '../features/carpeta/TrabajarConClaude';
import { useObraStore, useToastStore } from '../store';
import styles from './ObraSwitcher.module.css';

/** El resultado de pasar, abrir o dejar una carpeta, en un aviso (nada si se canceló). */
const avisar = (r: ResultadoCarpeta): void => {
  if (r.mensaje) useToastStore.getState().show(r.mensaje, undefined, { tone: r.ok ? 'ok' : 'warn' });
};

/** Un fallo de persistencia (cuota llena, IndexedDB caído) al crear/conmutar/
 *  borrar rechazaba ANTES de tocar el chip de guardado: el clic simplemente no
 *  hacía nada, sin rastro (auditoría E-04/A-05). Ahora al menos avisa. */
const opFailed = (err: unknown): void => {
  console.error('Operación de obra falló:', err);
  useToastStore.getState().show('No se pudo completar la operación. Comprueba el espacio del navegador y reintenta.');
};

export function ObraSwitcher() {
  const obras = useSessionStore((s) => s.obras);
  const activeId = useSessionStore((s) => s.activeId);
  const switching = useSessionStore((s) => s.switching);
  // Nombre vivo de la obra en pantalla (cubre la demo nueva aún sin registrar).
  const liveName = useObraStore((s) => s.obra.denominacion);

  const bp = useBreakpoint();
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // Prompt de nombre al crear una obra nueva: en vez de crearla en silencio con
  // "Obra nueva", pregunta el nombre antes (el usuario suele quererlo nombrado ya).
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState('');
  const carpetas = useCarpetaStore((s) => s.carpetas);
  const enCarpeta = !!(activeId && carpetas[activeId]);
  const [conClaude, setConClaude] = useState(false);
  /** «Abrir carpeta» con varias obras dentro: cuál. */
  const [eligiendo, setEligiendo] = useState<{ dir: Directorio; ficheros: string[] } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

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

  // Enfoca el input del prompt. Este efecto (del padre) corre DESPUÉS del que el
  // Modal usa para enfocar su botón de cierre, así que gana y deja el cursor listo.
  useEffect(() => {
    if (naming) nameInputRef.current?.focus();
  }, [naming]);

  const activeName = obras.find((o) => o.id === activeId)?.name || liveName;
  // El selector lista solo obras de TRABAJO; las de solo-referencia (importadas
  // para copiar) viven en el panel de Referencia, no aquí.
  const workObras = obras.filter((o) => o.kind !== 'reference');

  const close = () => {
    setOpen(false);
    setConfirmId(null);
  };

  const startNaming = () => {
    close();
    setNewName('');
    setNaming(true);
  };

  const confirmNaming = () => {
    newObra(newName.trim() || undefined).catch(opFailed); // vacío → nombre por defecto
    setNaming(false);
  };

  const onAbrirCarpeta = () => {
    close();
    abrirCarpeta()
      .then((r) => {
        if ('varias' in r) setEligiendo({ dir: r.dir, ficheros: r.ficheros });
        else avisar(r);
      })
      .catch(opFailed);
  };
  const onPasarACarpeta = () => {
    close();
    pasarACarpeta().then(avisar).catch(opFailed);
  };
  const onDejarCarpeta = () => {
    close();
    dejarLaCarpeta()
      .then(() =>
        useToastStore.getState().show('La obra ya no usa su carpeta: sigue en el navegador, y el fichero, en la carpeta.'),
      )
      .catch(opFailed);
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
        className={`tcol tap-target ${styles.trigger}`}
      >
        <Icon name="folder" size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
        <span className={styles.triggerName}>{activeName}</span>
        <Icon name="chevronDown" size={14} style={{ color: 'var(--text-disabled)', flexShrink: 0 }} />
      </button>
      <CarpetaChip />

      {open && (
        <div className={styles.menu} role="menu">
          {workObras.length > 0 ? (
            workObras.map((o) => {
              const on = o.id === activeId;
              const confirming = confirmId === o.id;
              return (
                <div key={o.id} className={`${styles.row} ${on ? styles.on : ''}`}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={on}
                    onClick={() => {
                      if (!on) switchObra(o.id).catch(opFailed);
                      close();
                    }}
                    className={`tcol ${styles.rowMain}`}
                  >
                    <span className={styles.rowCheck}>{on && <Icon name="check" size={13} />}</span>
                    <span className={styles.rowName}>{o.name}</span>
                    {carpetas[o.id] && (
                      <span className={styles.rowCarpeta} title={`En la carpeta ${carpetas[o.id]!.carpeta}`}>
                        <Icon name="folder" size={12} />
                      </span>
                    )}
                  </button>
                  {confirming ? (
                    <span className={styles.confirm}>
                      <button
                        type="button"
                        onClick={() => {
                          deleteObraById(o.id).catch(opFailed);
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
                      className={`tcol tap-target ${styles.del}`}
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
          <button type="button" onClick={startNaming} className={`tcol ${styles.new}`}>
            <span className={styles.newIcon}>
              <Icon name="plus" size={14} />
            </span>
            Nueva obra
          </button>
          {hayCarpetas() && (
            <>
              <button type="button" onClick={onAbrirCarpeta} className={`tcol ${styles.new} ${styles.accion}`}>
                <span className={styles.newIcon}>
                  <Icon name="folder" size={14} />
                </span>
                Abrir carpeta…
              </button>
              {enCarpeta ? (
                <button type="button" onClick={onDejarCarpeta} className={`tcol ${styles.new} ${styles.accion}`}>
                  <span className={styles.newIcon}>
                    <Icon name="x" size={14} />
                  </span>
                  Dejar de usar la carpeta
                </button>
              ) : (
                <button type="button" onClick={onPasarACarpeta} className={`tcol ${styles.new} ${styles.accion}`}>
                  <span className={styles.newIcon}>
                    <Icon name="upload" size={14} />
                  </span>
                  Pasar a una carpeta…
                </button>
              )}
            </>
          )}
          <div className={styles.divider} />
          <button
            type="button"
            onClick={() => {
              close();
              setConClaude(true);
            }}
            className={`tcol ${styles.new}`}
          >
            <span className={styles.newIcon}>
              <Icon name="assistant" size={14} />
            </span>
            Trabajar con Claude…
          </button>
        </div>
      )}

      {conClaude && <TrabajarConClaude compact={bp.isMobile} onClose={() => setConClaude(false)} />}

      {eligiendo && (
        <Modal
          open
          onClose={() => setEligiendo(null)}
          compact={bp.isMobile}
          icon="folder"
          title="¿Qué obra abres?"
          subtitle={`La carpeta ${eligiendo.dir.name} tiene ${eligiendo.ficheros.length} obras`}
        >
          <div className={styles.elegir}>
            {eligiendo.ficheros.map((f) => (
              <button
                key={f}
                type="button"
                className={`tcol ${styles.new}`}
                onClick={() => {
                  const { dir } = eligiendo;
                  setEligiendo(null);
                  abrirObraDeCarpeta(dir, f).then(avisar).catch(opFailed);
                }}
              >
                <span className={styles.newIcon}>
                  <Icon name="doc" size={14} />
                </span>
                {f}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {naming && (
        <Modal
          open
          onClose={() => setNaming(false)}
          closeOnOverlay={false}
          compact={bp.isMobile}
          icon="folder"
          title="Nueva obra"
          subtitle="Ponle un nombre para identificarla en el selector"
          footer={
            <>
              <button
                type="button"
                onClick={() => setNaming(false)}
                className={`tcol ${styles.nameCancel}`}
              >
                Cancelar
              </button>
              <button type="button" onClick={confirmNaming} className={styles.nameCreate}>
                Crear obra
              </button>
            </>
          }
        >
          <label className={styles.nameField}>
            <span className={`caps ${styles.nameLabel}`}>Nombre de la obra</span>
            <input
              ref={nameInputRef}
              className={styles.nameInput}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmNaming();
              }}
              placeholder="Obra nueva"
            />
          </label>
        </Modal>
      )}
    </div>
  );
}

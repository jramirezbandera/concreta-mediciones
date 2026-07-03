/* ===========================================================================
   PersistUI — feedback de persistencia (F6.1): chip de estado de guardado y
   banner de recuperación ante datos corruptos. "El fallo se ve, no se traga".
   =========================================================================== */
import { useEffect, useState } from 'react';
import { Icon } from '../components';
import { OBRA_KEY, loadRaw } from './persist';
import { discardRecovery } from './sync';
import { lockSupported } from './tabLock';
import { usePersistStore } from './persistStore';
import { useSessionStore } from './sessionStore';
import styles from './PersistUI.module.css';

/** Descarga el blob crudo guardado como .json (copia de seguridad de recuperación). */
async function exportRaw(key: string): Promise<void> {
  const raw = await loadRaw(key);
  const blob = new Blob([JSON.stringify(raw, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'concreta-copia-datos.json';
  a.click();
  URL.revokeObjectURL(url);
}

function SaveChip() {
  const status = usePersistStore((s) => s.status);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (status === 'saving' || status === 'error') {
      setShow(true);
      return;
    }
    if (status === 'saved') {
      setShow(true);
      const id = window.setTimeout(() => setShow(false), 1800);
      return () => window.clearTimeout(id);
    }
    setShow(false);
  }, [status]);

  if (!show || status === 'idle') return null;
  const label =
    status === 'saving' ? 'Guardando…' : status === 'saved' ? 'Guardado' : 'Sin guardar';
  return (
    <div className={`${styles.chip} ${styles[status]} no-print`} role="status" aria-live="polite">
      <Icon
        name={status === 'saving' ? 'loader' : status === 'saved' ? 'check' : 'alert'}
        size={13}
        className={status === 'saving' ? styles.spin : ''}
      />
      {label}
    </div>
  );
}

function RecoveryBanner() {
  const recovery = usePersistStore((s) => s.recovery);
  const recoveryKey = usePersistStore((s) => s.recoveryKey);
  if (recovery == null) return null;
  const key = recoveryKey ?? OBRA_KEY;
  return (
    <div className={`${styles.banner} no-print`} role="alert">
      <Icon name="alert" size={16} />
      <span className={styles.bannerText}>
        No se pudieron leer los datos guardados (versión antigua o dañados). Tu trabajo guardado no
        se ha sobrescrito.
      </span>
      <button type="button" className={styles.bannerBtn} onClick={() => void exportRaw(key)}>
        Exportar copia
      </button>
      <button
        type="button"
        className={`${styles.bannerBtn} ${styles.danger}`}
        onClick={() => {
          // discardRecovery es dueño del banner: borra la obra dañada del registro,
          // activa otra (o una en blanco) y reabre el banner si quedan más corruptas.
          // Si la propia persistencia rechaza (E-04), al menos que se vea el estado.
          discardRecovery(key).catch(() => usePersistStore.getState().setStatus('error'));
        }}
      >
        Descartar y empezar
      </button>
    </div>
  );
}

/** Banner de SOLO-LECTURA (T-19): la obra activa está abierta en otra pestaña,
 *  que es la dueña del autosave. Aquí no se guardan los cambios; desaparece solo
 *  cuando esta pestaña toma el control (la otra se cierra o cambia de obra). */
function ReadonlyBanner() {
  const readonly = useSessionStore((s) => s.readonly);
  if (!readonly) return null;
  return (
    <div className={`${styles.banner} no-print`} role="alert">
      <Icon name="layers" size={16} />
      <span className={styles.bannerText}>
        Esta obra está abierta en otra pestaña. Aquí no se guardan los cambios; cierra la otra
        pestaña para editar en esta.
      </span>
    </div>
  );
}

/** Aviso de candado multi-pestaña APAGADO (auditoría A-07): sin Web Locks
 *  (Safari viejo, o contexto NO seguro — la API solo existe bajo HTTPS, así que
 *  servir la app por http:// en una LAN desactiva T-19 incluso en Chrome), dos
 *  pestañas con la misma obra se pisan por last-writer-wins SIN banner. No se
 *  puede proteger, pero sí avisar. Solo si ya hay obras guardadas. */
function NoLockWarning() {
  const obras = useSessionStore((s) => s.obras);
  if (lockSupported() || obras.length === 0) return null;
  return (
    <div className={`${styles.banner} no-print`} role="alert">
      <Icon name="alert" size={16} />
      <span className={styles.bannerText}>
        Este navegador o conexión (no HTTPS) no protege la obra frente a ediciones desde otra
        pestaña: evita abrir la misma obra en dos pestañas a la vez.
      </span>
    </div>
  );
}

/** Monta el feedback de persistencia (banners + chip). Se renderiza siempre. */
export function PersistUI() {
  return (
    <>
      <RecoveryBanner />
      <ReadonlyBanner />
      <NoLockWarning />
      <SaveChip />
    </>
  );
}

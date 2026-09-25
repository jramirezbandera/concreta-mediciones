import { useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import {
  ImportError,
  descargarCopia,
  importarSobreActiva,
  parseObraJson,
  readFileText,
  usePersistStore,
  volverAObraGuardada,
  type ImportarResult,
} from '../../persist';
import { useEstadoCopia } from './recordatorioCopia';
import styles from './ProjectBackup.module.css';

const ERROR_MSG: Record<string, string> = {
  malformado: 'El archivo no es un proyecto Concreta válido (JSON dañado o con otra estructura).',
  'version-desconocida':
    'El archivo viene de una versión más nueva de Concreta y aún no se puede abrir aquí.',
};

/** Por qué la importación no terminó bien (todo menos `ok`). */
const IMPORT_MSG: Record<Exclude<ImportarResult['kind'], 'ok'>, string> = {
  'solo-lectura': 'Esta pestaña está en solo lectura: aquí no se puede importar.',
  'sin-guardar-actual':
    'No se pudo guardar la obra actual y no se ha importado nada, para no perder sus cambios. Libera espacio y reinténtalo.',
  'sin-guardar':
    'La obra importada está en pantalla pero NO se ha podido guardar: si recargas, se pierde. La copia de la obra anterior está en tus descargas.',
};

/** ¿Puede el navegador borrar las obras por su cuenta? (`persist/durability`).
 *  Mientras no se sepa (`unknown`), no dice nada. */
function DurabilityNote() {
  const durability = usePersistStore((s) => s.durability);
  if (durability === 'unknown') return null;
  if (durability === 'persisted')
    return (
      <div className={`${styles.note} ${styles.noteOk}`}>
        <Icon name="check" size={14} />
        Este navegador no borrará tus obras por su cuenta. La copia .json te sirve para cambiar de
        equipo.
      </div>
    );
  return (
    <div className={`${styles.note} ${styles.noteWarn}`}>
      <Icon name="alert" size={14} />
      {durability === 'unsupported'
        ? 'Este navegador puede borrar tus obras si le falta espacio. Exporta una copia a menudo.'
        : 'Este navegador puede borrar tus obras si le falta espacio o si pasas tiempo sin abrir la app. Exporta una copia a menudo; en Chrome o Edge, guardar la app en marcadores ayuda a protegerlas.'}
    </div>
  );
}

export interface ProjectBackupProps {
  /** Se invoca tras un import correcto (la obra ya está reemplazada): cierra el modal. */
  onImported?: () => void;
}

/**
 * Copia de seguridad del proyecto (F6.3): exporta el dominio a .json e importa
 * uno reemplazando el proyecto actual. El import es DESTRUCTIVO → confirma y
 * descarga un backup del estado actual ANTES de pisar. Solo cierra si la obra
 * importada llegó a disco; si no, lo dice y deja volver a la anterior (Etapa 0).
 * Enseña cuándo se descargó la última copia (recordatorio de copia).
 */
export function ProjectBackup({ onImported }: ProjectBackupProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  // La importada no llegó a disco y la anterior sigue guardada: se ofrece volver.
  const [puedeVolver, setPuedeVolver] = useState(false);
  const [busy, setBusy] = useState(false);
  const copia = useEstadoCopia();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reelegir el mismo archivo
    if (!file) return;
    setError(null);
    setPuedeVolver(false);
    setBusy(true);
    try {
      const text = await readFileText(file);
      const data = parseObraJson(text); // valida estructura + schemaVersion
      const ok = window.confirm(
        'Importar este proyecto reemplazará TODO el trabajo actual.\n\n' +
          'Se descargará una copia de seguridad del proyecto actual antes de continuar.\n\n' +
          '¿Continuar?',
      );
      if (!ok) return;
      // Guarda la actual, descarga su copia, carga la importada y comprueba que
      // llegó a disco: un guardado fallido ya no se da por bueno.
      const res = await importarSobreActiva(data);
      if (res.kind === 'ok') {
        onImported?.();
        return;
      }
      setError(IMPORT_MSG[res.kind]);
      setPuedeVolver(res.kind === 'sin-guardar' && res.puedeVolver);
    } catch (err) {
      setError(err instanceof ImportError ? ERROR_MSG[err.kind]! : 'No se pudo leer el archivo.');
    } finally {
      setBusy(false);
    }
  }

  async function volver() {
    setBusy(true);
    try {
      if (await volverAObraGuardada()) {
        setError(null);
        setPuedeVolver(false);
      } else setError('No se pudo leer la obra anterior. Usa la copia que está en tus descargas.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.wrap}>
      <div className={styles.text}>
        <div className={styles.title}>Copia de seguridad del proyecto</div>
        <div className={styles.sub}>
          Guarda o restaura todo el proyecto como archivo .json. Importar reemplaza el proyecto
          actual.
        </div>
      </div>
      {copia.registrada && (
        <div className={`${styles.note} ${copia.vencida ? styles.noteWarn : ''}`}>
          <Icon name="backup" size={14} />
          {copia.texto}
        </div>
      )}
      <DurabilityNote />
      <div className={styles.actions}>
        <button
          type="button"
          className={`t150 ${styles.btn}`}
          onClick={() => descargarCopia()}
          disabled={busy}
        >
          <Icon name="download" size={14} />
          Exportar .json
        </button>
        <button
          type="button"
          className={`t150 ${styles.btn}`}
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <Icon name="upload" size={14} />
          Importar .json
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onPick}
          className={styles.hidden}
          aria-label="Importar proyecto .json"
        />
      </div>
      {error && (
        <div className={styles.error} role="alert">
          <Icon name="alert" size={14} />
          <span>
            {error}
            {puedeVolver && (
              <>
                {' '}
                <button type="button" className={styles.link} onClick={volver} disabled={busy}>
                  Volver a la obra anterior
                </button>
              </>
            )}
          </span>
        </div>
      )}
    </section>
  );
}

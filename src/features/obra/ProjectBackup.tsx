import { useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import {
  ImportError,
  exportObraJson,
  flushPending,
  parseObraJson,
  readFileText,
  usePersistStore,
} from '../../persist';
import { useObraStore } from '../../store';
import styles from './ProjectBackup.module.css';

const ERROR_MSG: Record<string, string> = {
  malformado: 'El archivo no es un proyecto Concreta válido (JSON dañado o con otra estructura).',
  'version-desconocida':
    'El archivo viene de una versión más nueva de Concreta y aún no se puede abrir aquí.',
};

export interface ProjectBackupProps {
  /** Se invoca tras un import correcto (la obra ya está reemplazada): cierra el modal. */
  onImported?: () => void;
}

/**
 * Copia de seguridad del proyecto (F6.3): exporta el dominio a .json e importa
 * uno reemplazando el proyecto actual. El import es DESTRUCTIVO → confirma y
 * descarga un backup del estado actual ANTES de pisar. Si la escritura en
 * IndexedDB falla tras cargar, lo avisa (el chip de PersistUI pasa a "Sin guardar").
 */
export function ProjectBackup({ onImported }: ProjectBackupProps) {
  const loadObra = useObraStore((s) => s.loadObra);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reelegir el mismo archivo
    if (!file) return;
    setError(null);
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
      exportObraJson('concreta-copia-antes-de-importar.json'); // backup previo
      loadObra(data);
      try {
        await flushPending(); // persiste la obra importada de inmediato
      } catch {
        usePersistStore.getState().setStatus('error'); // cargó pero no se pudo guardar
      }
      onImported?.();
    } catch (err) {
      setError(err instanceof ImportError ? ERROR_MSG[err.kind]! : 'No se pudo leer el archivo.');
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
      <div className={styles.actions}>
        <button
          type="button"
          className={`t150 ${styles.btn}`}
          onClick={() => exportObraJson()}
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
          {error}
        </div>
      )}
    </section>
  );
}

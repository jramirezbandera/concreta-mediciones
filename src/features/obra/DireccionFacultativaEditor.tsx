import { useEffect } from 'react';
import { Icon } from '../../components/Icon';
import type { Agente } from '../../core/types';
import { useObraStore } from '../../store';
import styles from './ObraModal.module.css';

/** Roles habituales; el input es libre (datalist), así que se pueden teclear otros. */
const ROLES = ['Director de obra', 'Director de ejecución de obra', 'Coordinador de seguridad y salud'];

/**
 * Editor de la dirección facultativa (pies de firma por rol): lista de agentes
 * (rol/nombre/nº colegiado) con añadir/quitar. Firmas vacías se filtran al
 * exportar. Estado vacío (P2): una fila pre-sembrada guía la primera edición.
 */
export function DireccionFacultativaEditor({ compact }: { compact?: boolean }) {
  const agentes = (useObraStore((s) => s.obra.direccionFacultativa) as Agente[] | undefined) ?? [];
  const add = useObraStore((s) => s.addAgenteDF);
  const edit = useObraStore((s) => s.editAgenteDF);
  const del = useObraStore((s) => s.deleteAgenteDF);

  // Al abrir sin agentes, siembra una fila (guarda con getState para no duplicar
  // en el doble montaje de StrictMode: el set de Zustand es síncrono).
  useEffect(() => {
    const df = useObraStore.getState().obra.direccionFacultativa as Agente[] | undefined;
    if (!df || df.length === 0) add();
  }, [add]);

  return (
    <div className={styles.dfList}>
      {agentes.map((a) => (
        <div key={a.id} className={`${styles.dfRow} ${compact ? styles.dfRowCompact : ''}`}>
          <label className={styles.dfField}>
            <span className={`caps ${styles.fLabel}`}>Rol</span>
            <input
              className={styles.input}
              list="df-roles"
              value={a.rol}
              onChange={(e) => edit(a.id, 'rol', e.target.value)}
              aria-label="Rol del agente"
            />
          </label>
          <label className={styles.dfField}>
            <span className={`caps ${styles.fLabel}`}>Nombre</span>
            <input
              className={styles.input}
              value={a.nombre}
              onChange={(e) => edit(a.id, 'nombre', e.target.value)}
              aria-label="Nombre del agente"
            />
          </label>
          <label className={styles.dfColegiado}>
            <span className={`caps ${styles.fLabel}`}>Nº colegiado</span>
            <input
              className={styles.input}
              value={a.colegiado ?? ''}
              onChange={(e) => edit(a.id, 'colegiado', e.target.value)}
              aria-label="Número de colegiado"
            />
          </label>
          <button
            type="button"
            className={`t150 tap-target ${styles.dfDel}`}
            onClick={() => del(a.id)}
            aria-label="Eliminar agente"
            title="Eliminar agente"
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      ))}
      <datalist id="df-roles">
        {ROLES.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <button type="button" className={`t150 ${styles.dfAdd}`} onClick={add}>
        <Icon name="plus" size={14} /> Añadir agente
      </button>
    </div>
  );
}

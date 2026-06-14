import { Modal } from '../components';
import styles from './ShortcutsHelp.module.css';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
const MOD = isMac ? '⌘' : 'Ctrl';

interface Row {
  keys: string[];
  label: string;
}

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'General',
    rows: [
      { keys: [MOD, 'K'], label: 'Buscar partida en la obra' },
      { keys: ['Supr'], label: 'Eliminar la partida seleccionada (con deshacer)' },
      { keys: ['Esc'], label: 'Cerrar referencia / deseleccionar partida' },
      { keys: [MOD, 'C'], label: 'Copiar la partida seleccionada' },
      { keys: [MOD, 'V'], label: 'Pegar en el capítulo/subcapítulo activo' },
      { keys: ['?'], label: 'Mostrar esta ayuda' },
    ],
  },
  {
    title: 'Líneas de medición',
    rows: [
      { keys: ['Tab'], label: 'Ir a la celda siguiente y editarla' },
      { keys: ['Shift', 'Tab'], label: 'Ir a la celda anterior' },
      { keys: ['Enter'], label: 'Bajar en la misma columna' },
      { keys: [MOD, 'Enter'], label: 'Añadir línea nueva' },
      { keys: ['Esc'], label: 'Cancelar la edición de la celda' },
    ],
  },
];

/** Chuleta de atajos de teclado (tecla `?` o botón). */
export function ShortcutsHelp({ open, onClose, compact }: { open: boolean; onClose: () => void; compact?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title="Atajos de teclado" icon="command" compact={compact}>
      <div className={styles.groups}>
        {GROUPS.map((g) => (
          <div key={g.title} className={styles.group}>
            <div className={`sec-head ${styles.groupTitle}`}>{g.title}</div>
            {g.rows.map((r) => (
              <div key={r.label} className={styles.row}>
                <span className={styles.keys}>
                  {r.keys.map((k, i) => (
                    <kbd key={i} className={styles.kbd}>
                      {k}
                    </kbd>
                  ))}
                </span>
                <span className={styles.label}>{r.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}

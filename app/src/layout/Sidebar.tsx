import { Icon } from '../components/Icon';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  /** Estilo drawer (móvil/tablet). */
  drawer?: boolean;
  /** Selecciona "Toda la obra" (vista presupuesto). */
  onSelectAll?: () => void;
  /** Se invoca tras seleccionar (cierra el drawer en móvil). */
  onAfterSelect?: () => void;
}

/**
 * Sidebar de capítulos. En F0 es un cascarón vacío (estado de primer arranque):
 * cabecera "Capítulos" + afordancia de añadir deshabilitada. El árbol de
 * capítulos/subcapítulos con importes y barras se construye en F2.
 */
export function Sidebar({ drawer = false, onSelectAll, onAfterSelect }: SidebarProps) {
  function selectAll() {
    onSelectAll?.();
    onAfterSelect?.();
  }

  return (
    <aside className={`${styles.sidebar} ${drawer ? styles.drawer : ''}`} aria-label="Capítulos">
      <div className={`scroll-thin ${styles.scroll}`}>
        <button type="button" className={styles.allRow} onClick={selectAll}>
          <Icon name="layers" size={16} />
          Toda la obra
        </button>

        <div className={styles.head}>
          <span className="sec-head">Capítulos</span>
          <button type="button" className={styles.addBtn} disabled title="Disponible en F2">
            <Icon name="plus" size={13} /> Añadir capítulo
          </button>
        </div>

        <p className={styles.empty}>
          Sin capítulos todavía. Importa un presupuesto o crea el primero (F2).
        </p>
      </div>

      <div className={styles.footnote}>Concreta · Mediciones</div>
    </aside>
  );
}

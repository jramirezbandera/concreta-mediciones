/* ---------- Menú ⋮ de un capítulo (reordenar + eliminar) ------------------- */
import { useEffect, useRef } from 'react';
import { Icon } from '../../components';
import { useObraStore } from '../../store';
import type { SiblingNav } from './shared';
import styles from '../Sidebar.module.css';

/**
 * Menú del capítulo, espejo del de subcapítulos (`SubMenu`). Da la vía NO-ratón
 * de reordenar —arrastrar la tarjeta es cómodo pero no existe en táctil ni con
 * teclado— y recoge «Eliminar», que antes era un icono a un clic dentro de la
 * propia tarjeta (borrar un capítulo se lleva sus partidas: mejor un paso más).
 * «Añadir subcapítulo» sigue fuera, a un clic: es la acción frecuente.
 */
export function ChapterMenu({
  chId,
  nav,
  onDelete,
  onClose,
}: {
  chId: string;
  nav: SiblingNav;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const moveContainerBy = useObraStore((s) => s.moveContainerBy);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={`${styles.subMenuPop} ${styles.chapMenuPop}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={!nav.prev}
        className={`tcol ${styles.menuItem}`}
        onClick={() => {
          moveContainerBy(chId, -1);
          onClose();
        }}
      >
        <Icon name="arrowUp" size={13} /> Subir
      </button>
      <button
        type="button"
        disabled={!nav.next}
        className={`tcol ${styles.menuItem}`}
        onClick={() => {
          moveContainerBy(chId, 1);
          onClose();
        }}
      >
        <Icon name="arrowDown" size={13} /> Bajar
      </button>
      <div className={styles.menuDivider} />
      <button
        type="button"
        className={`tcol ${styles.menuItem} ${styles.menuDanger}`}
        onClick={() => {
          onDelete(chId);
          onClose();
        }}
      >
        <Icon name="trash" size={13} /> Eliminar capítulo
      </button>
    </div>
  );
}

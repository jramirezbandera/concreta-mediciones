/* ---------- Menú ⋮ de un contenedor del árbol (T-17: edición profunda) ----- */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components';
import { flattenContainers, subtreeIds } from '../../core/tree';
import type { Chapter, SubChapter } from '../../core/types';
import { useObraStore } from '../../store';
import type { SiblingNav } from './shared';
import styles from '../Sidebar.module.css';

export function SubMenu({
  sub,
  chId,
  parentId,
  chapters,
  nav,
  onAddChild,
  onDelete,
  onClose,
}: {
  sub: SubChapter;
  chId: string;
  /** Contenedor del que cuelga (el capítulo para depth 1): destino "actual". */
  parentId: string;
  chapters: Chapter[];
  /** Hermanos: habilita «Subir/Bajar» (la vía no-ratón de reordenar). */
  nav: SiblingNav;
  onAddChild: (chId: string, parentId: string) => void;
  onDelete: (chId: string, subId: string) => void;
  onClose: () => void;
}) {
  const moveSubtree = useObraStore((s) => s.moveSubtree);
  const moveContainerBy = useObraStore((s) => s.moveContainerBy);
  const [moving, setMoving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  // Destinos de "Mover a": cualquier contenedor FUERA del propio subárbol
  // (un nodo no puede colgar de sí mismo); el padre actual sale deshabilitado.
  const branch = subtreeIds(sub);
  const target = (id: string, code: string, title: string, depth: number) => {
    const cur = id === parentId;
    return (
      <button
        key={id}
        type="button"
        disabled={cur}
        className={`tcol ${styles.menuTarget}`}
        style={depth > 0 ? { paddingLeft: 8 + depth * 14 } : undefined}
        onClick={() => {
          moveSubtree(sub.id, id);
          onClose();
        }}
      >
        <span className={`mono ${styles.menuCode}`}>{code}</span>
        <span className={styles.menuLabel}>{title}</span>
        {cur && <span className={styles.menuActual}>actual</span>}
      </button>
    );
  };

  return (
    <div ref={ref} className={styles.subMenuPop} onClick={(e) => e.stopPropagation()}>
      {moving ? (
        <>
          <div className={`sec-head ${styles.menuHead}`}>Mover a</div>
          <div className={`scroll-thin ${styles.menuList}`}>
            {chapters.map((ch) => (
              <div key={ch.id}>
                {target(ch.id, ch.code, ch.title, 0)}
                {flattenContainers(ch)
                  .filter((f) => !branch.has(f.sub.id))
                  .map((f) => target(f.sub.id, f.sub.code, f.sub.title, f.depth))}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={!nav.prev}
            className={`tcol ${styles.menuItem}`}
            onClick={() => {
              moveContainerBy(sub.id, -1);
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
              moveContainerBy(sub.id, 1);
              onClose();
            }}
          >
            <Icon name="arrowDown" size={13} /> Bajar
          </button>
          <div className={styles.menuDivider} />
          <button
            type="button"
            className={`tcol ${styles.menuItem}`}
            onClick={() => {
              onAddChild(chId, sub.id);
              onClose();
            }}
          >
            <Icon name="plus" size={13} /> Añadir subcapítulo
          </button>
          <button type="button" className={`tcol ${styles.menuItem}`} onClick={() => setMoving(true)}>
            <Icon name="move" size={13} /> Mover a…
          </button>
          <div className={styles.menuDivider} />
          <button
            type="button"
            className={`tcol ${styles.menuItem} ${styles.menuDanger}`}
            onClick={() => {
              onDelete(chId, sub.id);
              onClose();
            }}
          >
            <Icon name="trash" size={13} /> Eliminar
          </button>
        </>
      )}
    </div>
  );
}

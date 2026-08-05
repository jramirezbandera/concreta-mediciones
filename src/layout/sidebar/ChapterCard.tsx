/* ---------- Tarjeta de capítulo de primer nivel --------------------------- */
import { useCallback, useState } from 'react';
import { Icon } from '../../components';
import { flattenContainers } from '../../core/tree';
import type { Chapter } from '../../core/types';
import type { Cents } from '../../core/money';
import { useReorderSource, useReorderTarget, type ReorderDrag } from '../../hooks/useReorderDrag';
import { ChapterMenu } from './ChapterMenu';
import { k, ROOT_SCOPE, type DropHandlers, type SiblingNav } from './shared';
import styles from '../Sidebar.module.css';

export function ChapterCard({
  ch,
  active,
  expanded,
  importe,
  nav,
  onSelect,
  onToggle,
  onAddSub,
  onDelete,
  onReorder,
  drop,
}: {
  ch: Chapter;
  active: string;
  expanded: boolean;
  importe: Cents;
  /** Capítulos vecinos: destino de «soltar debajo» y habilita Subir/Bajar. */
  nav: SiblingNav;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onAddSub: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (nodeId: string, beforeId: string | null) => void;
  drop?: DropHandlers;
}) {
  // Activo si es el propio capítulo o CUALQUIER descendiente (N niveles).
  const isActive = active === ch.id || flattenContainers(ch).some((f) => f.sub.id === active);
  const hasChildren = !!ch.children?.length;
  const [menuOpen, setMenuOpen] = useState(false);
  const dropProps = drop?.bind(ch.id, ch.id, null);

  // Arrastrar la tarjeta ENTERA (a diferencia de la fila de partida, que exige
  // agarrarla por su asa: aquí no hay celdas editables cuyo texto seleccionar).
  const dragSrc = useReorderSource(
    useCallback((): ReorderDrag => ({ kind: 'contenedor', id: ch.id, scope: ROOT_SCOPE }), [ch.id]),
  );
  const reorder = useReorderTarget(
    useCallback(
      (d: ReorderDrag) => d.kind === 'contenedor' && d.scope === ROOT_SCOPE && d.id !== ch.id,
      [ch.id],
    ),
    useCallback(
      (d: ReorderDrag, place: 'before' | 'after') =>
        onReorder(d.id, place === 'before' ? ch.id : nav.next),
      [ch.id, nav.next, onReorder],
    ),
  );

  return (
    <div className={styles.chapWrap}>
      <button
        type="button"
        className={`tcol ${styles.chap} ${isActive ? styles.on : ''} ${dropProps?.isOver ? styles.dropOver : ''} ${dragSrc.dragging ? styles.dragging : ''} ${reorder.place === 'before' ? styles.dropBefore : ''} ${reorder.place === 'after' ? styles.dropAfter : ''}`}
        onClick={() => onSelect(ch.id)}
        // Copiar desde Referencia (F5.2) y reordenar el árbol son arrastres
        // distintos y nunca simultáneos: mientras se arrastra una partida de
        // Referencia manda su drop; el resto del tiempo, el de reordenación.
        {...(dropProps ? dropProps.events : reorder.events)}
        {...dragSrc.source}
        {...dragSrc.handle}
      >
        <div className={styles.chapTop}>
          {hasChildren ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label={expanded ? 'Colapsar' : 'Desplegar'}
              className={`tcol ${styles.chev}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(ch.id);
              }}
            >
              <Icon name={expanded ? 'chevronDown' : 'chevron'} size={13} />
            </span>
          ) : (
            <span className={styles.chevSpacer} />
          )}
          <span className={`mono ${styles.chapCode}`}>{ch.code}</span>
          <span className={styles.chapTitle}>{ch.title}</span>
          <span className={styles.chapActions}>
            <span
              role="button"
              tabIndex={-1}
              aria-label="Añadir subcapítulo"
              className={`tcol ${styles.chapAction}`}
              onClick={(e) => {
                e.stopPropagation();
                onAddSub(ch.id);
              }}
            >
              <Icon name="plus" size={13} />
            </span>
            <span
              role="button"
              tabIndex={-1}
              aria-label="Acciones del capítulo"
              className={`tcol ${styles.chapAction} ${menuOpen ? styles.open : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((o) => !o);
              }}
            >
              <Icon name="dots" size={13} />
            </span>
          </span>
          {importe > 0 && <span className={`mono ${styles.chapK}`}>{k(importe)}</span>}
        </div>
      </button>
      {menuOpen && (
        <ChapterMenu
          chId={ch.id}
          nav={nav}
          onDelete={onDelete}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

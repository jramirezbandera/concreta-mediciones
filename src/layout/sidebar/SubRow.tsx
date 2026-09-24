/* ---------- Fila de subcapítulo (a cualquier profundidad) ------------------ */
import { useCallback, useState } from 'react';
import { Icon } from '../../components';
import type { Chapter, SubChapter } from '../../core/types';
import { useReorderSource, useReorderTarget, type ReorderDrag } from '../../hooks/useReorderDrag';
import { SubMenu } from './SubMenu';
import type { DropHandlers, SiblingNav } from './shared';
import styles from '../Sidebar.module.css';

export function SubRow({
  sub,
  depth,
  chId,
  parentId,
  chapters,
  active,
  empty,
  open,
  nav,
  onSelect,
  onDelete,
  onAddChild,
  onToggle,
  onReorder,
  drop,
}: {
  sub: SubChapter;
  /** 1 = sub de primer nivel; 2+ = anidado (sangría). */
  depth: number;
  chId: string;
  /** Contenedor del que cuelga (el capítulo para depth 1). */
  parentId: string;
  chapters: Chapter[];
  active: string;
  /** Subárbol SIN partidas (esqueleto de taxonomía en bancos): se atenúa. */
  empty?: boolean;
  /** Desplegado (solo aplica si tiene hijos). */
  open?: boolean;
  /** Hermanos (mismo padre): destino de «soltar debajo» y Subir/Bajar. */
  nav: SiblingNav;
  onSelect: (id: string) => void;
  onDelete: (chId: string, subId: string) => void;
  onAddChild: (chId: string, parentId: string) => void;
  onToggle: (id: string) => void;
  onReorder: (nodeId: string, beforeId: string | null) => void;
  drop?: DropHandlers;
}) {
  const on = active === sub.id;
  const [menuOpen, setMenuOpen] = useState(false);
  const dropProps = drop?.bind(sub.id, chId, sub.id);
  const hasChildren = !!sub.children?.length;

  // Reordenar entre HERMANOS (mismo padre). Colgar de otro contenedor sigue
  // siendo «Mover a» del menú ⋮: un arrastre no debería reestructurar el árbol.
  const dragSrc = useReorderSource(
    useCallback(
      (): ReorderDrag => ({ kind: 'contenedor', id: sub.id, scope: parentId }),
      [sub.id, parentId],
    ),
  );
  const reorder = useReorderTarget(
    useCallback(
      (d: ReorderDrag) => d.kind === 'contenedor' && d.scope === parentId && d.id !== sub.id,
      [parentId, sub.id],
    ),
    useCallback(
      (d: ReorderDrag, place: 'before' | 'after') =>
        onReorder(d.id, place === 'before' ? sub.id : nav.next),
      [sub.id, nav.next, onReorder],
    ),
  );

  // Mismo patrón que ChapterCard: fila <div> + botón principal que la cubre;
  // chevron y ⋮ son botones reales hermanos (no anidados en otro <button>).
  return (
    <div className={styles.subRowWrap}>
      <div
        className={`tcol ${styles.subRow} ${on ? styles.on : ''} ${empty && !on ? styles.dim : ''} ${dropProps?.isOver ? styles.dropOver : ''} ${dragSrc.dragging ? styles.dragging : ''} ${reorder.place === 'before' ? styles.dropBefore : ''} ${reorder.place === 'after' ? styles.dropAfter : ''}`}
        // 8px de respiro base (es el padding del row, que el inline pisa) +
        // sangría por nivel.
        style={{ paddingLeft: 8 + (depth - 1) * 14 }}
        {...(dropProps ? dropProps.events : reorder.events)}
        {...dragSrc.source}
        {...dragSrc.handle}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={!!open}
            aria-label={open ? 'Colapsar' : 'Desplegar'}
            className={`tcol ${styles.subChev} ${styles.overRow}`}
            onClick={() => onToggle(sub.id)}
          >
            <Icon name={open ? 'chevronDown' : 'chevron'} size={12} />
          </button>
        ) : (
          <span className={styles.subChevSpacer} />
        )}
        <button
          type="button"
          className={styles.rowMain}
          aria-current={on ? 'true' : undefined}
          onClick={() => onSelect(sub.id)}
        >
          <span className={`mono ${styles.subCode}`}>{sub.code}</span>
          <span className={styles.subTitle}>{sub.title}</span>
        </button>
        <button
          type="button"
          aria-label="Acciones del subcapítulo"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`tcol ${styles.subAct} ${styles.overRow} ${menuOpen ? styles.open : ''}`}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Icon name="dots" size={13} />
        </button>
      </div>
      {menuOpen && (
        <SubMenu
          sub={sub}
          chId={chId}
          parentId={parentId}
          chapters={chapters}
          nav={nav}
          onAddChild={onAddChild}
          onDelete={onDelete}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

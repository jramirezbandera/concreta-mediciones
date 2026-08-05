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

  return (
    <div className={styles.subRowWrap}>
      <button
        type="button"
        className={`tcol ${styles.subRow} ${on ? styles.on : ''} ${empty && !on ? styles.dim : ''} ${dropProps?.isOver ? styles.dropOver : ''} ${dragSrc.dragging ? styles.dragging : ''} ${reorder.place === 'before' ? styles.dropBefore : ''} ${reorder.place === 'after' ? styles.dropAfter : ''}`}
        // 8px de respiro base (es el padding del row, que el inline pisa) +
        // sangría por nivel.
        style={{ paddingLeft: 8 + (depth - 1) * 14 }}
        onClick={() => onSelect(sub.id)}
        {...(dropProps ? dropProps.events : reorder.events)}
        {...dragSrc.source}
        {...dragSrc.handle}
      >
        {hasChildren ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label={open ? 'Colapsar' : 'Desplegar'}
            className={`tcol ${styles.subChev}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(sub.id);
            }}
          >
            <Icon name={open ? 'chevronDown' : 'chevron'} size={12} />
          </span>
        ) : (
          <span className={styles.subChevSpacer} />
        )}
        <span className={`mono ${styles.subCode}`}>{sub.code}</span>
        <span className={styles.subTitle}>{sub.title}</span>
        <span
          role="button"
          tabIndex={-1}
          aria-label="Acciones del subcapítulo"
          className={`tcol ${styles.subAct} ${menuOpen ? styles.open : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
        >
          <Icon name="dots" size={13} />
        </span>
      </button>
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

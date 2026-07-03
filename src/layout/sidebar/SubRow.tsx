/* ---------- Fila de subcapítulo (a cualquier profundidad) ------------------ */
import { useState } from 'react';
import { Icon } from '../../components';
import type { Chapter, SubChapter } from '../../core/types';
import { SubMenu } from './SubMenu';
import type { DropHandlers } from './shared';
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
  onSelect,
  onDelete,
  onAddChild,
  onToggle,
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
  onSelect: (id: string) => void;
  onDelete: (chId: string, subId: string) => void;
  onAddChild: (chId: string, parentId: string) => void;
  onToggle: (id: string) => void;
  drop?: DropHandlers;
}) {
  const on = active === sub.id;
  const [menuOpen, setMenuOpen] = useState(false);
  const dropProps = drop?.bind(sub.id, chId, sub.id);
  const hasChildren = !!sub.children?.length;
  return (
    <div className={styles.subRowWrap}>
      <button
        type="button"
        className={`tcol ${styles.subRow} ${on ? styles.on : ''} ${empty && !on ? styles.dim : ''} ${dropProps?.isOver ? styles.dropOver : ''}`}
        // 8px de respiro base (es el padding del row, que el inline pisa) +
        // sangría por nivel.
        style={{ paddingLeft: 8 + (depth - 1) * 14 }}
        onClick={() => onSelect(sub.id)}
        {...dropProps?.events}
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
          onAddChild={onAddChild}
          onDelete={onDelete}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

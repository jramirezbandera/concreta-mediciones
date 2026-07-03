/* ---------- Tarjeta de capítulo de primer nivel --------------------------- */
import { Icon } from '../../components';
import { flattenContainers } from '../../core/tree';
import type { Chapter } from '../../core/types';
import type { Cents } from '../../core/money';
import { k, type DropHandlers } from './shared';
import styles from '../Sidebar.module.css';

export function ChapterCard({
  ch,
  active,
  expanded,
  importe,
  onSelect,
  onToggle,
  onAddSub,
  onDelete,
  drop,
}: {
  ch: Chapter;
  active: string;
  expanded: boolean;
  importe: Cents;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onAddSub: (id: string) => void;
  onDelete: (id: string) => void;
  drop?: DropHandlers;
}) {
  // Activo si es el propio capítulo o CUALQUIER descendiente (N niveles).
  const isActive = active === ch.id || flattenContainers(ch).some((f) => f.sub.id === active);
  const hasChildren = !!ch.children?.length;
  const dropProps = drop?.bind(ch.id, ch.id, null);
  return (
    <button
      type="button"
      className={`tcol ${styles.chap} ${isActive ? styles.on : ''} ${dropProps?.isOver ? styles.dropOver : ''}`}
      onClick={() => onSelect(ch.id)}
      {...dropProps?.events}
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
            aria-label="Eliminar capítulo"
            className={`tcol ${styles.chapAction} ${styles.chapDel}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(ch.id);
            }}
          >
            <Icon name="trash" size={13} />
          </span>
        </span>
        {importe > 0 && <span className={`mono ${styles.chapK}`}>{k(importe)}</span>}
      </div>
    </button>
  );
}

import { useMemo } from 'react';
import { Icon } from '../../components';
import type { Chapter } from '../../core/types';
import { ALL, selectChapterTotals, selectPem, useObraStore } from '../../store';
import { AllChapters } from './AllChapters';
import { ChapterHeader } from './ChapterHeader';
import { PartidasTable } from './PartidasTable';
import styles from './Presupuesto.module.css';

/** Estado vacío de un capítulo sin partidas, con alta directa de la primera. */
function EmptyChapter({ chapter }: { chapter: Chapter }) {
  const addPartida = useObraStore((s) => s.addPartida);
  return (
    <div className={`dot-grid ${styles.empty}`}>
      <div className={styles.emptyCard}>
        <div className={styles.emptyIcon}>
          <Icon name="folder" size={24} />
        </div>
        <div className={styles.emptyTitle}>Capítulo sin partidas</div>
        <p className={styles.emptyText}>
          «{chapter.title}» aún no tiene partidas medidas. Añade la primera o crea un subcapítulo
          desde el árbol.
        </p>
        <button type="button" className={styles.emptyAdd} onClick={() => addPartida(chapter.id, null)}>
          <Icon name="plus" size={15} /> Añadir partida
        </button>
      </div>
    </div>
  );
}

/**
 * Vista Presupuesto (F2.1, lectura). Enruta según la selección del sidebar:
 * "Toda la obra" → `AllChapters`; un capítulo/subcapítulo → su cabecera + tabla.
 * Seleccionar un subcapítulo resuelve a su capítulo padre y muestra todas sus
 * partidas (agrupadas por subcapítulo dentro de la tabla).
 */
export function PresupuestoView({ compact }: { compact: boolean }) {
  const active = useObraStore((s) => s.active);
  const chapters = useObraStore((s) => s.chapters);
  const partidas = useObraStore((s) => s.partidas);
  const chapterTotals = useObraStore(selectChapterTotals);
  const pem = useObraStore(selectPem);

  const activeChapter = useMemo(
    () =>
      chapters.find((ch) => ch.id === active || ch.children?.some((c) => c.id === active)) ??
      chapters[0],
    [active, chapters],
  );

  const cls = `${styles.view}${compact ? ` ${styles.compact}` : ''}`;

  if (active === ALL) {
    return (
      <div className={cls}>
        <AllChapters compact={compact} />
      </div>
    );
  }

  if (!activeChapter) {
    return <div className={cls} />;
  }

  const ps = partidas[activeChapter.id] ?? [];
  const importe = chapterTotals[activeChapter.id] ?? 0;

  return (
    <div className={cls}>
      <ChapterHeader chapter={activeChapter} importe={importe} count={ps.length} pem={pem} />
      {ps.length > 0 ? (
        <PartidasTable chapter={activeChapter} partidas={ps} chapterTotal={importe} />
      ) : (
        <EmptyChapter chapter={activeChapter} />
      )}
    </div>
  );
}

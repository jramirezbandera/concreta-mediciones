import { useMemo, useRef } from 'react';
import { Icon } from '../../components';
import type { Chapter } from '../../core/types';
import { useElementWidth } from '../../hooks/useElementWidth';
import { ALL, selectChapterTotals, selectPem, useObraStore } from '../../store';
import { AllChapters } from './AllChapters';
import { ChapterHeader } from './ChapterHeader';
import { Partidas } from './Partidas';
import styles from './Presupuesto.module.css';

/** Por debajo de este ancho ÚTIL la tabla conmuta a tarjetas (prototipo: 780). */
const COMPACT_WIDTH = 780;

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
 * Vista Presupuesto. Enruta según la selección del sidebar: "Toda la obra" →
 * `AllChapters`; un capítulo/subcapítulo → su cabecera + tabla/tarjetas. El modo
 * compacto se decide por el ANCHO ÚTIL real del área (no el viewport): con la
 * sidebar fija el contenido puede ser estrecho aunque la ventana sea ancha.
 */
export function PresupuestoView({ compact: mobile }: { compact: boolean }) {
  const viewRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(viewRef);
  const compact = mobile || (width > 0 && width < COMPACT_WIDTH);

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

  let content = null;
  if (active === ALL) {
    content = <AllChapters compact={compact} />;
  } else if (activeChapter) {
    const ps = partidas[activeChapter.id] ?? [];
    const importe = chapterTotals[activeChapter.id] ?? 0;
    content = (
      <>
        <ChapterHeader chapter={activeChapter} importe={importe} count={ps.length} pem={pem} />
        {ps.length > 0 ? (
          <Partidas compact={compact} chapter={activeChapter} partidas={ps} chapterTotal={importe} />
        ) : (
          <EmptyChapter chapter={activeChapter} />
        )}
      </>
    );
  }

  return (
    <div ref={viewRef} className={cls}>
      {content}
    </div>
  );
}

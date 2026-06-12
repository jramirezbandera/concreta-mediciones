import { useMemo, useRef } from 'react';
import { EmptyAction, EmptyState, Icon } from '../../components';
import type { Chapter } from '../../core/types';
import { findNode } from '../../core/tree';
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
export function PresupuestoView({
  compact: mobile,
  onImport,
}: {
  compact: boolean;
  /** Lleva a la vista Importar (CTA del estado vacío de obra, F8.3). */
  onImport?: () => void;
}) {
  const viewRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(viewRef);
  const compact = mobile || (width > 0 && width < COMPACT_WIDTH);

  const active = useObraStore((s) => s.active);
  const chapters = useObraStore((s) => s.chapters);
  const partidas = useObraStore((s) => s.partidas);
  const chapterTotals = useObraStore(selectChapterTotals);
  const pem = useObraStore(selectPem);
  const addChapter = useObraStore((s) => s.addChapter);

  // Resuelve el id activo (capítulo o sub a CUALQUIER profundidad) a su capítulo.
  const activeChapter = useMemo(
    () => findNode(chapters, active)?.chapter ?? chapters[0],
    [active, chapters],
  );

  // fadeUp: entrada sutil al cambiar de vista (gated en reduced-motion global).
  const cls = `fadeUp ${styles.view}${compact ? ` ${styles.compact}` : ''}`;

  // Obra sin capítulos ("Estados de UI de M1" §1): wedge de entrada con CTAs,
  // no una vista en blanco.
  if (chapters.length === 0) {
    return (
      <div ref={viewRef} className={`${cls} ${styles.viewFill}`}>
        <EmptyState
          icon="building"
          title="Empieza tu primera obra"
          text="Importa un presupuesto .bc3 de Presto, Arquímedes o CYPE, o crea la estructura de capítulos en blanco."
        >
          {onImport && (
            <EmptyAction primary onClick={onImport}>
              Importar .bc3
            </EmptyAction>
          )}
          <EmptyAction onClick={() => addChapter('Capítulo 1')}>Añadir capítulo</EmptyAction>
        </EmptyState>
      </div>
    );
  }

  let content = null;
  let fill = false; // el estado vacío necesita la raíz en columna flex (viewFill)
  if (active === ALL) {
    content = <AllChapters compact={compact} />;
  } else if (activeChapter) {
    const ps = partidas[activeChapter.id] ?? [];
    const importe = chapterTotals[activeChapter.id] ?? 0;
    fill = ps.length === 0;
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
    <div ref={viewRef} className={`${cls}${fill ? ` ${styles.viewFill}` : ''}`}>
      {content}
    </div>
  );
}

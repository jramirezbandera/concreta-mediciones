import { useEffect, useMemo, useRef } from 'react';
import { EmptyAction, EmptyState, Icon } from '../../components';
import type { Chapter, SubChapter } from '../../core/types';
import { partidaImporte } from '../../core/medicion';
import { sumCents } from '../../core/money';
import { ancestorIds, findNode, subtreeIds } from '../../core/tree';
import { useElementWidth } from '../../hooks/useElementWidth';
import { ALL, selectChapterTotals, selectPem, useObraStore } from '../../store';
import { AllChapters } from './AllChapters';
import { ChapterHeader } from './ChapterHeader';
import { Partidas } from './Partidas';
import styles from './Presupuesto.module.css';

/** Por debajo de este ancho ÚTIL la tabla conmuta a tarjetas (prototipo: 780). */
const COMPACT_WIDTH = 780;

/** Estado vacío del contenedor activo sin partidas (capítulo o sub aislado),
 *  con alta directa de la primera EN ese contenedor. */
function EmptyChapter({ chapter, sub }: { chapter: Chapter; sub?: SubChapter | null }) {
  const addPartida = useObraStore((s) => s.addPartida);
  const node = sub ?? chapter;
  return (
    <div className={`dot-grid ${styles.empty}`}>
      <div className={styles.emptyCard}>
        <div className={styles.emptyIcon}>
          <Icon name="folder" size={24} />
        </div>
        <div className={styles.emptyTitle}>{sub ? 'Subcapítulo' : 'Capítulo'} sin partidas</div>
        <p className={styles.emptyText}>
          «{node.title}» aún no tiene partidas medidas. Añade la primera o crea un subcapítulo
          desde el árbol.
        </p>
        <button
          type="button"
          className={styles.emptyAdd}
          onClick={() => addPartida(chapter.id, sub?.id ?? null)}
        >
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
  const setActive = useObraStore((s) => s.setActive);
  const revealNonce = useObraStore((s) => s.revealNonce);

  const coefK = useObraStore((s) => s.rates.coefK);

  // Scroll a la partida revelada por el buscador. Atado a `revealNonce` (no a
  // `openPartidaId`) para NO hacer scroll en cada apertura manual. Reintento
  // acotado por frames: el nodo puede no estar montado aún tras renavegar
  // (swap del subárbol focused, flip tabla↔tarjetas, cierre del drawer móvil).
  const lastNonce = useRef(0);
  useEffect(() => {
    if (revealNonce === 0 || revealNonce === lastNonce.current) return;
    lastNonce.current = revealNonce;
    const openId = useObraStore.getState().openPartidaId;
    if (!openId) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let tries = 0;
    const attempt = () => {
      const el = document.getElementById(`partida-${openId}`);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
        return;
      }
      if (tries++ < 6) raf = requestAnimationFrame(attempt);
    };
    raf = requestAnimationFrame(attempt);
    return () => cancelAnimationFrame(raf);
  }, [revealNonce]);

  // Resuelve el id activo (capítulo o sub a CUALQUIER profundidad) a su capítulo.
  const activeChapter = useMemo(
    () => findNode(chapters, active)?.chapter ?? chapters[0],
    [active, chapters],
  );

  // Sub AISLADO: si el activo es un sub (no el capítulo), la vista muestra
  // SOLO su subárbol — navegación de obras grandes (un banco tipo BCCA mete
  // miles de partidas por capítulo; seleccionar «Arenas» debe enseñar Arenas).
  const focused = useMemo(() => {
    const hit = findNode(chapters, active);
    if (!hit || hit.depth === 0) return null; // capítulo, ALL o id desconocido
    const sub = hit.node as SubChapter;
    const ids = subtreeIds(sub);
    const ps = (partidas[hit.chapter.id] ?? []).filter((p) => p.sub != null && ids.has(p.sub));
    return { sub, ps };
  }, [active, chapters, partidas]);

  // Miga capítulo → … → sub cuando se aísla un sub: hace legible que la vista se
  // ha estrechado (el salto del buscador) y da vía de vuelta (clic al capítulo).
  const headerPath = useMemo(() => {
    if (!focused) return undefined;
    return ancestorIds(chapters, focused.sub.id).map((id) => {
      const node = findNode(chapters, id)?.node;
      return { id, code: node?.code ?? '', title: node?.title ?? '' };
    });
  }, [focused, chapters]);

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
    // Aislado: cabecera, total, conteo y vacío hablan del SUB, no del capítulo.
    const shown = focused ? focused.ps : ps;
    const importe = focused
      ? sumCents(focused.ps.map((p) => partidaImporte(p, coefK)))
      : (chapterTotals[activeChapter.id] ?? 0);
    fill = shown.length === 0;
    content = (
      <>
        <ChapterHeader
          chapter={focused ? focused.sub : activeChapter}
          importe={importe}
          count={shown.length}
          pem={pem}
          path={headerPath}
          onNavigate={setActive}
        />
        {shown.length > 0 ? (
          <Partidas
            compact={compact}
            chapter={activeChapter}
            partidas={ps}
            chapterTotal={importe}
            focus={focused?.sub.id ?? null}
          />
        ) : (
          <EmptyChapter chapter={activeChapter} sub={focused?.sub} />
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

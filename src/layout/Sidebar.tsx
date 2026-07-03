import { Fragment, useMemo, useState } from 'react';
import { Icon, InlineCreate } from '../components';
import {
  ancestorIds,
  emptyContainers,
  findNode,
  flattenContainers,
  type FlatContainer,
} from '../core/tree';
import { BuscarPartidas } from '../features/presupuesto/BuscarPartidas';
import type { Chapter } from '../core/types';
import { ALL, selectChapterTotals, selectPem, useObraStore } from '../store';
import { ChapterCard } from './sidebar/ChapterCard';
import { ResumenCard } from './sidebar/ResumenCard';
import { SubRow } from './sidebar/SubRow';
import { k, type DropHandlers } from './sidebar/shared';
import styles from './Sidebar.module.css';

// El modal «Ajusta» vive ahora en ./sidebar/AjustaModal; se re-exporta para no
// romper el import de Sidebar.test.tsx (superficie estable, F-05).
export { AjustaModal } from './sidebar/AjustaModal';

export interface SidebarProps {
  /** Estilo drawer (móvil/tablet). */
  drawer?: boolean;
  /** Se invoca tras seleccionar (cierra el drawer en móvil). */
  onAfterSelect?: () => void;
}

/**
 * Filas VISIBLES del árbol de un capítulo: un sub se ve solo si TODOS sus
 * ancestros (subs) están desplegados — colapsar un nodo oculta su subárbol
 * entero. Pre-orden, igual que `flattenContainers`.
 */
function visibleContainers(ch: Chapter, expanded: Record<string, boolean>): FlatContainer[] {
  const out: FlatContainer[] = [];
  const hidden = new Set<string>();
  for (const f of flattenContainers(ch)) {
    if (f.parentId !== ch.id && (hidden.has(f.parentId) || !expanded[f.parentId])) {
      hidden.add(f.sub.id);
      continue;
    }
    out.push(f);
  }
  return out;
}

/**
 * Sidebar de capítulos (F2.1 + F2.4): "Toda la obra", árbol de capítulos/
 * subcapítulos con importe `{k}` y barra de % PEM, alta inline de capítulos y
 * subcapítulos, papelera con confirmación, y la tarjeta Resumen al pie. Suscrito
 * al store (navegación, despliegue y CRUD estructural).
 */
export function Sidebar({ drawer = false, onAfterSelect }: SidebarProps) {
  const active = useObraStore((s) => s.active);
  const expanded = useObraStore((s) => s.expanded);
  const chapters = useObraStore((s) => s.chapters);
  const chapterTotals = useObraStore(selectChapterTotals);
  const pem = useObraStore(selectPem);
  const setActive = useObraStore((s) => s.setActive);
  const setView = useObraStore((s) => s.setView);
  const toggleExpanded = useObraStore((s) => s.toggleExpanded);
  const addChapter = useObraStore((s) => s.addChapter);
  const addSubchapter = useObraStore((s) => s.addSubchapter);
  const deleteChapter = useObraStore((s) => s.deleteChapter);
  const deleteSubchapter = useObraStore((s) => s.deleteSubchapter);
  const refDrag = useObraStore((s) => s.refDrag);
  const setRefDrag = useObraStore((s) => s.setRefDrag);
  const requestCopyRefPartidas = useObraStore((s) => s.requestCopyRefPartidas);

  const [creatingChapter, setCreatingChapter] = useState(false);
  const [creatingSubFor, setCreatingSubFor] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  // Contenedores cuyo subárbol no tiene partidas (esqueleto de taxonomía en
  // bancos tipo BCCA): se atenúan en el árbol para distinguir contenido de
  // clasificación vacía. Un solo Set (los ids de sub son únicos entre capítulos).
  const partidas = useObraStore((s) => s.partidas);
  const emptySubs = useMemo(() => {
    const out = new Set<string>();
    for (const ch of chapters)
      for (const id of emptyContainers(ch, partidas[ch.id] ?? [])) out.add(id);
    return out;
  }, [chapters, partidas]);

  // Drop de partidas de Referencia (F5.2): sólo activo mientras se arrastra.
  const drop: DropHandlers | undefined = refDrag
    ? {
        bind: (id, chId, subId) => ({
          isOver: dropId === id,
          events: {
            onDragOver: (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              if (dropId !== id) setDropId(id);
            },
            onDragLeave: () => setDropId((d) => (d === id ? null : d)),
            onDrop: (e) => {
              e.preventDefault();
              // Mismo preflight de colisión que el resto de vías de copia (T-1/D2):
              // soltar sobre el árbol también puede abrir el diálogo de resolución.
              if (refDrag) requestCopyRefPartidas(refDrag.items, { chId, subId }, refDrag.contra);
              setRefDrag(null);
              setDropId(null);
            },
          },
        }),
      }
    : undefined;

  const select = (id: string) => {
    setActive(id);
    setView('presupuesto');
    onAfterSelect?.();
  };
  // `parentId` puede ser el capítulo o un sub a cualquier profundidad (T-17).
  // Con subs colapsables hay que abrir la CADENA entera de ancestros (y el
  // propio padre, para que el hijo recién creado quede a la vista).
  const onAddSub = (chId: string, parentId: string = chId) => {
    // Abrir la cadena de ancestros (capítulo → … → padre) para que el hijo
    // recién creado quede a la vista. Mismo walk que `revealPartida`, vía helper.
    for (const id of ancestorIds(chapters, parentId)) toggleExpanded(id, true);
    setCreatingSubFor(parentId);
  };
  const onDeleteChapter = (id: string) => {
    const ch = chapters.find((c) => c.id === id);
    if (window.confirm(`¿Eliminar el capítulo «${ch?.title}» y todas sus partidas?`))
      deleteChapter(id);
  };
  const onDeleteSub = (chId: string, subId: string) => {
    // Borrar PROMUEVE (T-17): las partidas y los sub-contenedores del borrado
    // suben al nivel superior; el mensaje lo dice según lo que tenga.
    const node = findNode(chapters, subId)?.node;
    const msg = node?.children?.length
      ? `¿Eliminar el subcapítulo «${node?.title}»? Sus subcapítulos y partidas suben al nivel superior.`
      : `¿Eliminar el subcapítulo «${node?.title}»? Sus partidas suben al nivel superior.`;
    if (window.confirm(msg)) deleteSubchapter(chId, subId);
  };

  return (
    <aside
      className={`${styles.sidebar} ${drawer ? styles.drawer : ''}`}
      aria-label="Capítulos de la obra"
    >
      <BuscarPartidas onAfterSelect={onAfterSelect} />

      <div className={styles.allWrap}>
        <button
          type="button"
          className={`tcol ${styles.allRow} ${active === ALL ? styles.on : ''}`}
          onClick={() => select(ALL)}
        >
          <span className={styles.allIcon}>
            <Icon name="grid" size={14} />
          </span>
          <span className={styles.allLabel}>Toda la obra</span>
          <span className={`mono ${styles.allK}`}>{k(pem)}</span>
        </button>
      </div>

      <div className={styles.head}>
        <span className="sec-head">Capítulos</span>
        <button
          type="button"
          className={styles.headAdd}
          title="Añadir capítulo"
          aria-label="Añadir capítulo"
          onClick={() => setCreatingChapter(true)}
        >
          <Icon name="plus" size={15} />
        </button>
      </div>

      <nav className={`scroll-thin ${styles.nav}`}>
        {chapters.map((ch) => (
          <div key={ch.id}>
            <ChapterCard
              ch={ch}
              active={active}
              expanded={!!expanded[ch.id]}
              importe={chapterTotals[ch.id] ?? 0}
              onSelect={select}
              onToggle={toggleExpanded}
              onAddSub={(id) => onAddSub(id)}
              onDelete={onDeleteChapter}
              drop={drop}
            />
            {ch.children && expanded[ch.id] && (
              <div className={styles.subList}>
                {visibleContainers(ch, expanded).map((f) => (
                  <Fragment key={f.sub.id}>
                    <SubRow
                      sub={f.sub}
                      depth={f.depth}
                      chId={ch.id}
                      parentId={f.parentId}
                      chapters={chapters}
                      active={active}
                      empty={emptySubs.has(f.sub.id)}
                      open={!!expanded[f.sub.id]}
                      onSelect={select}
                      onDelete={onDeleteSub}
                      onAddChild={onAddSub}
                      onToggle={toggleExpanded}
                      drop={drop}
                    />
                    {/* Alta de un HIJO de este sub (T-17), sangrada a su nivel. */}
                    {creatingSubFor === f.sub.id && (
                      <div style={{ marginLeft: 8 + f.depth * 14 }}>
                        <InlineCreate
                          placeholder="Nombre del subcapítulo…"
                          onCommit={(t) => {
                            addSubchapter(f.sub.id, t);
                            setCreatingSubFor(null);
                          }}
                          onCancel={() => setCreatingSubFor(null)}
                        />
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>
            )}
            {creatingSubFor === ch.id && (
              <div className={styles.createSub}>
                <InlineCreate
                  placeholder="Nombre del subcapítulo…"
                  onCommit={(t) => {
                    addSubchapter(ch.id, t);
                    setCreatingSubFor(null);
                  }}
                  onCancel={() => setCreatingSubFor(null)}
                />
              </div>
            )}
          </div>
        ))}
        {creatingChapter && (
          <div className={styles.createChapter}>
            <InlineCreate
              placeholder="Nombre del capítulo…"
              onCommit={(t) => {
                addChapter(t);
                setCreatingChapter(false);
              }}
              onCancel={() => setCreatingChapter(false)}
            />
          </div>
        )}
      </nav>

      <div className={styles.footer}>
        <ResumenCard compact={drawer} />
      </div>
    </aside>
  );
}

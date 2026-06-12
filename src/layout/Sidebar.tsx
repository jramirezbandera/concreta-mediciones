import { useState } from 'react';
import { Bar, Icon, InlineCreate, IvaSelect } from '../components';
import { fmtCents, fmtNum, toEur, type Cents } from '../core/money';
import { flattenContainers } from '../core/tree';
import type { Chapter, SubChapter } from '../core/types';
import {
  ALL,
  selectChapterTotals,
  selectPec,
  selectPem,
  selectTotalConIva,
  useObraStore,
} from '../store';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  /** Estilo drawer (móvil/tablet). */
  drawer?: boolean;
  /** Se invoca tras seleccionar (cierra el drawer en móvil). */
  onAfterSelect?: () => void;
}

/** Importe en céntimos → "12,3k" (millares de euro, 1 decimal). */
function k(cents: Cents): string {
  return `${fmtNum(toEur(cents) / 1000, 1)}k`;
}

/* ---------- Tarjeta Resumen (composición del presupuesto) ----------------- */
function ResumenCard() {
  const pem = useObraStore(selectPem);
  const pec = useObraStore(selectPec);
  const total = useObraStore(selectTotalConIva);
  const gg = useObraStore((s) => s.rates.gg);
  const bi = useObraStore((s) => s.rates.bi);
  const iva = useObraStore((s) => s.rates.iva);
  const setRates = useObraStore((s) => s.setRates);

  const ggbi: Cents = pec - pem;
  const ivaCents: Cents = total - pec;
  const pemColor = 'var(--accent)';
  const ggbiColor = 'color-mix(in srgb, var(--accent) 45%, var(--bg-elevated))';
  const ivaColor = 'var(--text-disabled)';
  const segs: [Cents, string][] = [
    [pem, pemColor],
    [ggbi, ggbiColor],
    [ivaCents, ivaColor],
  ];

  return (
    <div className={styles.resumen}>
      <div className={`sec-head ${styles.resHead}`}>Resumen</div>
      <div className={styles.compBar}>
        {segs.map(([value, color], i) => (
          <div
            key={i}
            className={styles.compSeg}
            style={{ width: `${total ? (value / total) * 100 : 0}%`, background: color }}
          />
        ))}
      </div>
      <div className={styles.resRows}>
        <div className={styles.resRow}>
          <span className={styles.resLabel}>
            <span className={styles.resDot} style={{ background: pemColor }} />
            PEM
          </span>
          <span className={`mono ${styles.resVal}`}>{fmtCents(pem)}</span>
        </div>
        <div className={styles.resRow}>
          <span className={styles.resLabel}>
            <span className={styles.resDot} style={{ background: ggbiColor }} />
            GG + BI ({Math.round((gg + bi) * 100)}%)
          </span>
          <span className={`mono ${styles.resVal}`}>{fmtCents(ggbi)}</span>
        </div>
        <div className={styles.resRow}>
          <span className={styles.resLabel}>PEC s/ IVA</span>
          <span className={`mono ${styles.resVal} ${styles.strong}`}>{fmtCents(pec)}</span>
        </div>
        <div className={styles.resRow}>
          <span className={styles.resLabel}>
            <span className={styles.resDot} style={{ background: ivaColor }} />
            <IvaSelect rate={iva} onChange={(r) => setRates({ iva: r })} />
          </span>
          <span className={`mono ${styles.resVal}`}>{fmtCents(ivaCents)}</span>
        </div>
      </div>
      <div className={styles.resTotal}>
        <span className={styles.resTotalLabel}>Total</span>
        <span className={`mono ${styles.resTotalVal}`}>{fmtCents(total)}</span>
      </div>
    </div>
  );
}

/* ---------- Drop de partidas de Referencia (F5.2) ------------------------- */
/** Genera los props de drop para una fila destino; `undefined` si no se arrastra. */
interface DropHandlers {
  bind: (id: string, chId: string, subId: string | null) => {
    isOver: boolean;
    events: {
      onDragOver: (e: React.DragEvent) => void;
      onDragLeave: () => void;
      onDrop: (e: React.DragEvent) => void;
    };
  };
}

/* ---------- Fila de subcapítulo (a cualquier profundidad) ------------------ */
function SubRow({
  sub,
  depth,
  chId,
  active,
  onSelect,
  onDelete,
  drop,
}: {
  sub: SubChapter;
  /** 1 = sub de primer nivel; 2+ = anidado (sangría). */
  depth: number;
  chId: string;
  active: string;
  onSelect: (id: string) => void;
  onDelete: (chId: string, subId: string) => void;
  drop?: DropHandlers;
}) {
  const on = active === sub.id;
  const dropProps = drop?.bind(sub.id, chId, sub.id);
  // Fase 1: solo se borran subs de primer nivel SIN hijos (borrar un contenedor
  // con sub-contenedores es edición profunda → T-17; el store también lo bloquea).
  const deletable = depth === 1 && !sub.children?.length;
  return (
    <button
      type="button"
      className={`tcol ${styles.subRow} ${on ? styles.on : ''} ${dropProps?.isOver ? styles.dropOver : ''}`}
      style={{ paddingLeft: (depth - 1) * 14 }}
      onClick={() => onSelect(sub.id)}
      {...dropProps?.events}
    >
      <span className={`mono ${styles.subCode}`}>{sub.code}</span>
      <span className={styles.subTitle}>{sub.title}</span>
      {deletable && (
        <span
          role="button"
          tabIndex={-1}
          aria-label="Eliminar subcapítulo"
          className={`tcol ${styles.subDel}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(chId, sub.id);
          }}
        >
          <Icon name="trash" size={12} />
        </span>
      )}
    </button>
  );
}

/* ---------- Tarjeta de capítulo de primer nivel --------------------------- */
function ChapterCard({
  ch,
  active,
  expanded,
  importe,
  pct,
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
  pct: number;
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
      {importe > 0 && (
        <div className={styles.chapBarRow}>
          <span className={styles.chapBar}>
            <Bar pct={pct} active={isActive} height={3} />
          </span>
          <span className={`mono ${styles.chapPct}`}>{fmtNum(pct, 1)}%</span>
        </div>
      )}
    </button>
  );
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
  const copyRefPartidas = useObraStore((s) => s.copyRefPartidas);

  const [creatingChapter, setCreatingChapter] = useState(false);
  const [creatingSubFor, setCreatingSubFor] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

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
              if (refDrag) copyRefPartidas(refDrag.items, { chId, subId }, refDrag.contra);
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
  const onAddSub = (id: string) => {
    toggleExpanded(id, true);
    setCreatingSubFor(id);
  };
  const onDeleteChapter = (id: string) => {
    const ch = chapters.find((c) => c.id === id);
    if (window.confirm(`¿Eliminar el capítulo «${ch?.title}» y todas sus partidas?`))
      deleteChapter(id);
  };
  const onDeleteSub = (chId: string, subId: string) => {
    const sub = chapters.find((c) => c.id === chId)?.children?.find((s) => s.id === subId);
    if (window.confirm(`¿Eliminar el subcapítulo «${sub?.title}»? Sus partidas pasan al capítulo.`))
      deleteSubchapter(chId, subId);
  };

  return (
    <aside
      className={`${styles.sidebar} ${drawer ? styles.drawer : ''}`}
      aria-label="Capítulos de la obra"
    >
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
              pct={pem ? ((chapterTotals[ch.id] ?? 0) / pem) * 100 : 0}
              onSelect={select}
              onToggle={toggleExpanded}
              onAddSub={onAddSub}
              onDelete={onDeleteChapter}
              drop={drop}
            />
            {ch.children && expanded[ch.id] && (
              <div className={styles.subList}>
                {flattenContainers(ch).map((f) => (
                  <SubRow
                    key={f.sub.id}
                    sub={f.sub}
                    depth={f.depth}
                    chId={ch.id}
                    active={active}
                    onSelect={select}
                    onDelete={onDeleteSub}
                    drop={drop}
                  />
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
        <ResumenCard />
      </div>
    </aside>
  );
}

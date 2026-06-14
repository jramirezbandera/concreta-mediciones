import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { EditableNum, Icon, InlineCreate, IvaSelect, Modal } from '../components';
import { fmtCents, fmtNum, parseEsNumber, toCents, toEur, type Cents } from '../core/money';
import { coefKParaObjetivo, pem as pemCore } from '../core/totales';
import {
  ancestorIds,
  emptyContainers,
  findNode,
  flattenContainers,
  subtreeIds,
  type FlatContainer,
} from '../core/tree';
import { BuscarPartidas } from '../features/presupuesto/BuscarPartidas';
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

/* ---------- Modal "Ajusta": K que cuadra el PEM a un objetivo -------------- */
/**
 * Calcula el coeficiente K que lleva el PEM a la cifra objetivo que teclea el
 * usuario (rebaja/subida del constructor, cuadrar un PEM contractual). La base
 * del cálculo es el PEM a K=1, así que reajustar al mismo objetivo es idempotente.
 * El preview muestra el K resultante y el PEM REAL que saldrá (con el redondeo
 * por partida, que puede dejar una desviación de céntimos respecto al objetivo).
 */
function AjustaModal({
  open,
  onClose,
  baseCents,
  currentPem,
  pemAt,
  onApply,
  compact,
}: {
  open: boolean;
  onClose: () => void;
  baseCents: Cents; // PEM a K=1 (base de la razón)
  currentPem: Cents; // PEM con el K vigente (semilla del objetivo)
  pemAt: (coefK: number) => Cents; // PEM real con un K dado (redondeo por partida)
  onApply: (coefK: number) => void;
  compact: boolean;
}) {
  const [draft, setDraft] = useState('');
  // Al abrir, precarga el objetivo con el PEM actual: el punto de partida natural.
  useEffect(() => {
    if (open) setDraft(fmtNum(toEur(currentPem), 2).replace(/\./g, ''));
  }, [open, currentPem]);

  const target = parseEsNumber(draft);
  const targetCents = target != null ? toCents(target) : null;
  const valido = targetCents != null && targetCents > 0 && baseCents > 0;
  const k = valido ? coefKParaObjetivo(baseCents, targetCents) : null;
  // PEM real que saldrá al aplicar ese K (redondeo por partida, no escalar el total).
  const resultPem = k != null ? pemAt(k) : null;
  const delta = resultPem != null && targetCents != null ? resultPem - targetCents : null;

  function apply() {
    if (k == null) return;
    onApply(k);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajustar a un PEM objetivo"
      subtitle="Calcula el coeficiente K que cuadra el presupuesto con la cifra que indiques"
      icon="target"
      compact={compact}
      footer={
        <>
          <button type="button" className={styles.ajustaCancel} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={styles.ajustaApply} onClick={apply} disabled={k == null}>
            Aplicar K {k != null ? `×${fmtNum(k, 4)}` : ''}
          </button>
        </>
      }
    >
      <div className={styles.ajustaBody}>
        <label className={styles.ajustaField}>
          <span className={`caps ${styles.ajustaLabel}`}>PEM objetivo</span>
          <span className={styles.ajustaInputWrap}>
            <input
              className={`mono ${styles.ajustaInput}`}
              value={draft}
              inputMode="decimal"
              aria-label="PEM objetivo en euros"
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') apply();
              }}
            />
            <span className={styles.ajustaUnit}>€</span>
          </span>
        </label>

        <div className={styles.ajustaPreview}>
          <div className={styles.ajustaPrevRow}>
            <span className={styles.ajustaPrevLabel}>PEM actual (K ×1)</span>
            <span className="mono">{fmtCents(baseCents)}</span>
          </div>
          <div className={styles.ajustaPrevRow}>
            <span className={styles.ajustaPrevLabel}>Coeficiente K</span>
            <span className={`mono ${styles.ajustaPrevK}`}>{k != null ? `×${fmtNum(k, 4)}` : '—'}</span>
          </div>
          <div className={styles.ajustaPrevRow}>
            <span className={styles.ajustaPrevLabel}>PEM resultante</span>
            <span className={`mono ${styles.ajustaPrevStrong}`}>
              {resultPem != null ? fmtCents(resultPem) : '—'}
            </span>
          </div>
          {delta != null && Math.abs(delta) >= 1 && (
            <div className={styles.ajustaNote}>
              <Icon name="alert" size={12} /> Desvío de {fmtNum(toEur(delta))} € por el redondeo de
              precios por partida (inevitable; queda dentro de la tolerancia habitual).
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Tarjeta Resumen (composición del presupuesto) ----------------- */
function ResumenCard({ compact }: { compact: boolean }) {
  const pem = useObraStore(selectPem);
  const pec = useObraStore(selectPec);
  const total = useObraStore(selectTotalConIva);
  const gg = useObraStore((s) => s.rates.gg);
  const bi = useObraStore((s) => s.rates.bi);
  const iva = useObraStore((s) => s.rates.iva);
  const coefK = useObraStore((s) => s.rates.coefK);
  const setRates = useObraStore((s) => s.setRates);
  const partidas = useObraStore((s) => s.partidas);

  // PEM a K=1: base del ajuste por objetivo, independiente del K vigente.
  const baseCents = useMemo(() => pemCore(partidas, 1), [partidas]);
  const [targeting, setTargeting] = useState(false);

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
      <div className={styles.resTop}>
        <div className={`sec-head ${styles.resHeadInline}`}>Resumen</div>
        <div className={styles.kBox} title="Coeficiente K global de la obra (1 = sin ajuste)">
          <span className={`caps ${styles.kCap}`}>K</span>
          <span className={styles.kNum}>
            <EditableNum
              value={coefK}
              dec={4}
              ariaLabel="Coeficiente K"
              onCommit={(v) => setRates({ coefK: v })}
            />
          </span>
          <button
            type="button"
            className={styles.kBtn}
            onClick={() => setTargeting(true)}
            disabled={baseCents <= 0}
            title="Ajustar K a un PEM objetivo"
          >
            <Icon name="target" size={11} /> Ajusta
          </button>
        </div>
      </div>
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

      <AjustaModal
        open={targeting}
        onClose={() => setTargeting(false)}
        baseCents={baseCents}
        currentPem={pem}
        pemAt={(k) => pemCore(partidas, k)}
        onApply={(k) => setRates({ coefK: k })}
        compact={compact}
      />
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

/* ---------- Menú ⋮ de un contenedor del árbol (T-17: edición profunda) ----- */
function SubMenu({
  sub,
  chId,
  parentId,
  chapters,
  onAddChild,
  onDelete,
  onClose,
}: {
  sub: SubChapter;
  chId: string;
  /** Contenedor del que cuelga (el capítulo para depth 1): destino "actual". */
  parentId: string;
  chapters: Chapter[];
  onAddChild: (chId: string, parentId: string) => void;
  onDelete: (chId: string, subId: string) => void;
  onClose: () => void;
}) {
  const moveSubtree = useObraStore((s) => s.moveSubtree);
  const [moving, setMoving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  // Destinos de "Mover a": cualquier contenedor FUERA del propio subárbol
  // (un nodo no puede colgar de sí mismo); el padre actual sale deshabilitado.
  const branch = subtreeIds(sub);
  const target = (id: string, code: string, title: string, depth: number) => {
    const cur = id === parentId;
    return (
      <button
        key={id}
        type="button"
        disabled={cur}
        className={`tcol ${styles.menuTarget}`}
        style={depth > 0 ? { paddingLeft: 8 + depth * 14 } : undefined}
        onClick={() => {
          moveSubtree(sub.id, id);
          onClose();
        }}
      >
        <span className={`mono ${styles.menuCode}`}>{code}</span>
        <span className={styles.menuLabel}>{title}</span>
        {cur && <span className={styles.menuActual}>actual</span>}
      </button>
    );
  };

  return (
    <div ref={ref} className={styles.subMenuPop} onClick={(e) => e.stopPropagation()}>
      {moving ? (
        <>
          <div className={`sec-head ${styles.menuHead}`}>Mover a</div>
          <div className={`scroll-thin ${styles.menuList}`}>
            {chapters.map((ch) => (
              <div key={ch.id}>
                {target(ch.id, ch.code, ch.title, 0)}
                {flattenContainers(ch)
                  .filter((f) => !branch.has(f.sub.id))
                  .map((f) => target(f.sub.id, f.sub.code, f.sub.title, f.depth))}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            className={`tcol ${styles.menuItem}`}
            onClick={() => {
              onAddChild(chId, sub.id);
              onClose();
            }}
          >
            <Icon name="plus" size={13} /> Añadir subcapítulo
          </button>
          <button type="button" className={`tcol ${styles.menuItem}`} onClick={() => setMoving(true)}>
            <Icon name="move" size={13} /> Mover a…
          </button>
          <div className={styles.menuDivider} />
          <button
            type="button"
            className={`tcol ${styles.menuItem} ${styles.menuDanger}`}
            onClick={() => {
              onDelete(chId, sub.id);
              onClose();
            }}
          >
            <Icon name="trash" size={13} /> Eliminar
          </button>
        </>
      )}
    </div>
  );
}

/* ---------- Fila de subcapítulo (a cualquier profundidad) ------------------ */
function SubRow({
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

/* ---------- Tarjeta de capítulo de primer nivel --------------------------- */
function ChapterCard({
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

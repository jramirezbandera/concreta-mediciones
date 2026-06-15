import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Icon } from '../../components';
import { MIN_QUERY } from '../../core/buscar';
import { fmtNum, round2 } from '../../core/money';
import { REF_DESC, REF_SOURCES, type RefCopyItem, type RefPartida, type RefSource } from '../../core/refdata';
import { deleteObraById, useSessionStore } from '../../persist';
import { selectCopyTarget, useObraStore } from '../../store';
import { loadObraRefSource } from './obraSource';
import styles from './Referencia.module.css';

/** Tope de resultados de la búsqueda en una base (no montar miles de filas). */
const REF_SEARCH_CAP = 100;

/** Auto-abrir el primer capítulo solo si tiene ≤ este nº de partidas (bases enormes → colapsado, 2A). */
const REF_AUTOOPEN_MAX = 200;

/** Descriptor ligero de fuente para el selector (sin cargar la obra entera). */
interface SourceDesc {
  id: string;
  kind: 'base' | 'presupuesto';
  name: string;
  org: string;
  /** Obra de solo-referencia (importada): se puede quitar desde el selector. */
  removable?: boolean;
}

/** Item de copia desde una partida de referencia. */
function copyItem(source: RefSource, p: RefPartida): RefCopyItem {
  return { sourceName: source.name, partida: p };
}

/** Contenedor del árbol de referencia (capítulo o subcapítulo, N niveles). */
type RefContainer = { id: string; code: string; title: string; children?: RefContainer[] };

/** Todas las partidas del subárbol de un contenedor (sus directas + las de sus
 *  descendientes), para copiar/arrastrar un capítulo o subcapítulo entero. */
function subtreePartidas(node: RefContainer, bySub: Map<string, RefPartida[]>): RefPartida[] {
  const out = [...(bySub.get(node.id) ?? [])];
  for (const c of node.children ?? []) out.push(...subtreePartidas(c, bySub));
  return out;
}

/** Importe de descomposición de una línea (con %CI sobre el coste directo). */
function itemImporte(items: RefPartida['items'], i: number): number {
  const it = items[i]!;
  if (it.type === '%CI') {
    const base = items
      .filter((x) => x.type !== '%CI')
      .reduce((s, x) => s + round2(x.cantidad * (x.precio ?? 0)), 0);
    return round2((base * it.cantidad) / 100);
  }
  return round2(it.cantidad * (it.precio ?? 0));
}

/* ---------- selector de fuente ------------------------------------------- */
function SourceSelect({
  sources,
  curId,
  onSelect,
  onImport,
  onDelete,
}: {
  sources: SourceDesc[];
  curId: string;
  onSelect: (id: string) => void;
  onImport: () => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  // Sin fuentes (arranque limpio: ni bases precargadas ni otras obras): la lista
  // puede estar vacía, así que `cur` puede ser undefined → placeholder, sin crash.
  const cur = sources.find((s) => s.id === curId) ?? sources[0];
  return (
    <div ref={ref} className={styles.srcWrap}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={`tcol ${styles.srcBtn}`}>
        <span className={styles.srcIcon}>
          <Icon name={cur?.kind === 'presupuesto' ? 'doc' : 'layers'} size={15} />
        </span>
        <span className={styles.srcText}>
          <span className={styles.srcName}>{cur ? cur.name : 'Sin fuentes de referencia'}</span>
          <span className={styles.srcOrg}>{cur ? cur.org : 'Añade una base o crea otra obra'}</span>
        </span>
        <Icon name="chevronDown" size={15} style={{ color: 'var(--text-disabled)', flexShrink: 0 }} />
      </button>
      {open && (
        <div className={styles.srcMenu}>
          {sources.map((s) => {
            const on = s.id === curId;
            return (
              <div key={s.id} className={styles.srcRow}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(s.id);
                    setOpen(false);
                  }}
                  className={`tcol ${styles.srcOpt} ${on ? styles.on : ''}`}
                >
                  <span className={`${styles.srcOptIcon} ${on ? styles.on : ''}`}>
                    <Icon name={s.kind === 'base' ? 'layers' : 'doc'} size={14} />
                  </span>
                  <span className={styles.srcText}>
                    <span className={`${styles.srcName} ${on ? styles.on : ''}`}>{s.name}</span>
                    <span className={styles.srcOrg}>
                      {s.org} · {s.kind === 'base' ? 'Base de precios' : 'Presupuesto'}
                    </span>
                  </span>
                </button>
                {s.removable && (
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(s.id);
                      setOpen(false);
                    }}
                    title={`Quitar ${s.name} de las referencias`}
                    aria-label={`Quitar ${s.name} de las referencias`}
                    className={`tcol ${styles.srcDel}`}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                )}
              </div>
            );
          })}
          {sources.length > 0 && <div className={styles.srcDivider} />}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onImport();
            }}
            className={`tcol ${styles.srcOpt} ${styles.srcImport}`}
          >
            <span className={styles.srcOptIcon} style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <Icon name="upload" size={15} />
            </span>
            <span className={styles.srcText}>
              <span className={styles.srcName} style={{ color: 'var(--accent)' }}>
                Añadir base de referencia…
              </span>
              <span className={styles.srcOrg}>Archivo .bc3 (FIEBDC-3) · CYPE, Presto, ITeC…</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- fila de partida de referencia (descripción desplegable) ------ */
function RefPartidaRow({
  p,
  selected,
  onToggleSel,
  onCopyOne,
  onDragStart,
  onDragEnd,
  pathLabel,
}: {
  p: RefPartida;
  selected: boolean;
  onToggleSel: (p: RefPartida) => void;
  onCopyOne: (p: RefPartida) => void;
  onDragStart: (e: React.DragEvent, p: RefPartida) => void;
  onDragEnd: () => void;
  /** Ruta del subcapítulo al que pertenece (solo en resultados de búsqueda). */
  pathLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  // Las bases traen la desc por código (REF_DESC); las obras propias en la partida.
  const desc = p.desc ?? REF_DESC[p.code] ?? '';
  return (
    <div className={`${styles.part} ${open ? styles.open : ''}`}>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, p)}
        onDragEnd={onDragEnd}
        className={`${styles.partRow} ${selected ? styles.selected : ''}`}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title={open ? 'Ocultar descripción' : 'Ver descripción'}
          className={`tcol ${styles.partChev} ${open ? styles.on : ''}`}
        >
          <Icon name={open ? 'chevronDown' : 'chevron'} size={13} />
        </button>
        <button
          type="button"
          onClick={() => onToggleSel(p)}
          title="Seleccionar"
          aria-label={`Seleccionar ${p.code}`}
          aria-pressed={selected}
          className={`tcol ${styles.partCheck} ${selected ? styles.on : ''}`}
        >
          {selected && <Icon name="check" size={12} />}
        </button>
        <span className={`mono ${styles.partCode}`}>{p.code}</span>
        <div className={styles.partTitleWrap} onClick={() => setOpen((o) => !o)}>
          <div className={`${styles.partTitle} ${open ? styles.open : ''}`}>{p.title}</div>
          {pathLabel && <div className={styles.partPath}>{pathLabel}</div>}
        </div>
        <span className={`mono ${styles.partUd}`}>{p.ud}</span>
        <span className={`mono ${styles.partPrecio}`}>{fmtNum(p.precio)}</span>
        <button
          type="button"
          onClick={() => onCopyOne(p)}
          title="Copiar a mi presupuesto"
          aria-label={`Copiar ${p.code} a mi presupuesto`}
          className={`tcol ${styles.partCopy}`}
        >
          <Icon name="arrowLeft" size={15} />
        </button>
      </div>
      {open && (
        <div className={styles.partDetail}>
          {desc && <p className={styles.partDesc}>{desc}</p>}
          {p.items.length > 0 && (
            <div className={styles.descomp}>
              <div className={`caps ${styles.descompHead}`}>Descomposición</div>
              {p.items.map((it, i) => (
                <div key={i} className={styles.descompRow}>
                  <Badge type={it.type} />
                  <span className={styles.descompDesc}>{it.desc}</span>
                  <span className={`mono ${styles.descompCant}`}>
                    {fmtNum(it.cantidad, 3)} {it.type === '%CI' ? '%' : it.ud}
                  </span>
                  <span className={`mono ${styles.descompImp}`}>{fmtNum(itemImporte(p.items, i))}</span>
                </div>
              ))}
            </div>
          )}
          <div className={styles.partDetailActions}>
            <button type="button" onClick={() => onCopyOne(p)} className={styles.partCopyBig}>
              <Icon name="arrowLeft" size={14} /> Copiar a mi presupuesto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===========================================================================
   Panel de Referencia (F5 → multi-obra T-10): abre una base/otra obra propia en
   solo lectura y copia partidas/capítulos al presupuesto propio. Las obras
   guardadas se cargan PEREZOSAMENTE desde IndexedDB (loading/error + guarda
   anti-respuesta-obsoleta). La copia pasa por el PREFLIGHT de colisión del store.
   =========================================================================== */
export function ReferenciaPanel({ onImport }: { onImport: () => void }) {
  const refSourceId = useObraStore((s) => s.refSourceId);
  const setRefSource = useObraStore((s) => s.setRefSource);
  const setRefOpen = useObraStore((s) => s.setRefOpen);
  const refMaximized = useObraStore((s) => s.refMaximized);
  const setRefMax = useObraStore((s) => s.setRefMax);
  const requestCopyRefPartidas = useObraStore((s) => s.requestCopyRefPartidas);
  const setRefDrag = useObraStore((s) => s.setRefDrag);
  const target = useObraStore(selectCopyTarget);
  const obras = useSessionStore((s) => s.obras);
  const activeObraId = useSessionStore((s) => s.activeId);

  // Lista de fuentes: bases estáticas + tus obras guardadas (menos la activa).
  const sourceList = useMemo<SourceDesc[]>(() => {
    const bases: SourceDesc[] = REF_SOURCES.map((s) => ({ id: s.id, kind: s.kind, name: s.name, org: s.org }));
    const propias: SourceDesc[] = obras
      .filter((o) => o.id !== activeObraId)
      .map((o) => ({
        id: `obra:${o.id}`,
        kind: 'presupuesto',
        name: o.name,
        org: o.kind === 'reference' ? 'Referencia importada' : 'Obra propia',
        removable: o.kind === 'reference',
      }));
    return [...bases, ...propias];
  }, [obras, activeObraId]);

  // Caché de obras propias ya cargadas como fuente (no re-leer el blob al volver).
  const [obraCache, setObraCache] = useState<Record<string, RefSource>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(0);

  const isObraSrc = refSourceId.startsWith('obra:');
  const source: RefSource | undefined = isObraSrc
    ? obraCache[refSourceId]
    : (REF_SOURCES.find((s) => s.id === refSourceId) ?? REF_SOURCES[0]);

  // Carga perezosa de la obra seleccionada como fuente (con guarda anti-stale).
  useEffect(() => {
    // Bump SIEMPRE: cualquier cambio de fuente invalida una carga en vuelo, también
    // al pasar a una base o a una obra ya cacheada (si no, esa carga pintaría un
    // error/loading sobre la fuente ya seleccionada).
    const myReq = ++reqRef.current;
    if (!isObraSrc || obraCache[refSourceId]) {
      setLoading(false);
      setError(null);
      return;
    }
    const obraId = refSourceId.slice('obra:'.length);
    const meta = obras.find((o) => o.id === obraId);
    setLoading(true);
    setError(null);
    void loadObraRefSource(obraId, meta?.name ?? 'Obra').then((rs) => {
      if (myReq !== reqRef.current) return; // el usuario cambió de fuente: descarta
      setLoading(false);
      if (rs) setObraCache((c) => ({ ...c, [refSourceId]: rs }));
      else setError('No se pudo cargar la obra (datos dañados).');
    });
  }, [refSourceId, isObraSrc, obraCache, obras]);

  const [sel, setSel] = useState<Record<string, RefCopyItem>>({});
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Al cambiar de fuente, limpia selección/búsqueda.
  useEffect(() => {
    setSel({});
    setQ('');
  }, [refSourceId]);

  // Partidas agrupadas por su contenedor INMEDIATO: clave = `sub` de la partida, o
  // el id del capítulo para las que cuelgan directas de él. Es la base del árbol
  // recursivo (el .bc3 ya trae la jerarquía en `chapters[].children` + `sub`).
  const bySub = useMemo(() => {
    const m = new Map<string, RefPartida[]>();
    if (!source) return m;
    for (const ch of source.chapters)
      for (const p of source.partidas[ch.id] ?? []) {
        const key = p.sub ?? ch.id;
        const arr = m.get(key);
        if (arr) arr.push(p);
        else m.set(key, [p]);
      }
    return m;
  }, [source]);

  // Nº de partidas del subárbol de cada contenedor (recuento que se muestra y
  // umbral de auto-apertura). Una pasada por fuente.
  const subtreeCount = useMemo(() => {
    const m = new Map<string, number>();
    if (!source) return m;
    const walk = (node: RefContainer): number => {
      let n = (bySub.get(node.id) ?? []).length;
      for (const c of node.children ?? []) n += walk(c);
      m.set(node.id, n);
      return n;
    };
    for (const ch of source.chapters) walk(ch);
    return m;
  }, [source, bySub]);

  // Al resolverse la fuente, auto-abre el primer capítulo y TODO su subárbol solo si
  // es pequeño (≤ REF_AUTOOPEN_MAX partidas). En bases enormes (BCCA, miles) queda
  // colapsado: abrir un capítulo solo muestra sus subcapítulos, no miles de filas.
  useEffect(() => {
    const first = source?.chapters[0];
    if (!first || (subtreeCount.get(first.id) ?? 0) > REF_AUTOOPEN_MAX) {
      setExpanded({});
      return;
    }
    const ids: Record<string, boolean> = {};
    const walk = (node: RefContainer) => {
      ids[node.id] = true;
      (node.children ?? []).forEach(walk);
    };
    walk(first);
    setExpanded(ids);
  }, [source, subtreeCount]);

  // Invalida la caché de fuentes-obra que pueden haber cambiado: la obra ACTIVA
  // (se está editando ahora) y las que ya no existen (borradas). El resto se
  // mantiene cacheado. Sin esto, reabrir como fuente una obra editada/borrada
  // serviría un snapshot viejo (o una obra fantasma).
  useEffect(() => {
    setObraCache((c) => {
      const liveKeys = new Set(obras.map((o) => `obra:${o.id}`));
      const activeKey = activeObraId ? `obra:${activeObraId}` : null;
      let changed = false;
      const next: Record<string, RefSource> = {};
      for (const k of Object.keys(c)) {
        if (k === activeKey || !liveKeys.has(k)) {
          changed = true; // purga: activa (editable) o borrada
          continue;
        }
        next[k] = c[k]!;
      }
      return changed ? next : c;
    });
  }, [activeObraId, obras]);

  const refKey = (p: RefPartida) => `${refSourceId}::${p.id}`;

  // Búsqueda diferida: teclear no bloquea por re-filtrar la base (CR-6). El índice
  // `haystack` se precomputa UNA vez por fuente (no se reconstruyen strings por
  // tecla) y los resultados se topan para no montar miles de filas.
  const dq = useDeferredValue(q);
  const query = dq.trim().toLowerCase();
  const searching = query.length >= MIN_QUERY;

  const chapterData = useMemo(
    () => (source ? source.chapters.map((ch) => ({ ch, ps: source.partidas[ch.id] ?? [] })) : []),
    [source],
  );

  // Índice `${code} ${title}` por partida. Se construye SOLO cuando hay búsqueda activa
  // (no recorrer 70k partidas al abrir la fuente si el usuario aún no busca — 2A/Codex).
  const haystacks = useMemo(() => {
    const m = new Map<string, string>();
    if (!searching) return m;
    for (const { ps } of chapterData)
      for (const p of ps) m.set(p.id, `${p.code} ${p.title}`.toLowerCase());
    return m;
  }, [searching, chapterData]);

  // Etiqueta de ruta por contenedor ("3 PRECIOS UNITARIOS ▸ 01 DEMOLICIONES"),
  // solo en búsqueda: ubica cada resultado en la jerarquía del banco.
  const pathLabels = useMemo(() => {
    const m = new Map<string, string>();
    if (!source || !searching) return m;
    const walk = (node: RefContainer, prefix: string) => {
      const label = prefix ? `${prefix} ▸ ${node.code} ${node.title}` : `${node.code} ${node.title}`;
      m.set(node.id, label);
      (node.children ?? []).forEach((c) => walk(c, label));
    };
    for (const ch of source.chapters) walk(ch, '');
    return m;
  }, [source, searching]);

  // Resultados de búsqueda: lista PLANA de coincidencias (tope global), cada una
  // con la ruta de su subcapítulo. Recorre todo el árbol vía `bySub` (clave por
  // contenedor) para no perder las partidas de subcapítulos profundos.
  const search = useMemo(() => {
    const matches: { p: RefPartida; path: string }[] = [];
    if (!searching || !source) return { matches, truncated: false };
    let truncated = false;
    outer: for (const ch of source.chapters)
      for (const p of source.partidas[ch.id] ?? []) {
        if (!(haystacks.get(p.id) ?? '').includes(query)) continue;
        if (matches.length >= REF_SEARCH_CAP) {
          truncated = true;
          break outer;
        }
        matches.push({ p, path: pathLabels.get(p.sub ?? ch.id) ?? '' });
      }
    return { matches, truncated };
  }, [searching, query, source, haystacks, pathLabels]);

  function toggleSel(p: RefPartida) {
    if (!source) return;
    const k = refKey(p);
    setSel((prev) => {
      const n = { ...prev };
      if (n[k]) delete n[k];
      else n[k] = copyItem(source, p);
      return n;
    });
  }
  const selCount = Object.keys(sel).length;

  function beginDrag(e: React.DragEvent, items: RefCopyItem[]) {
    const dt = e.dataTransfer;
    if (dt) {
      dt.effectAllowed = 'copy';
      try {
        dt.setData('text/plain', 'concreta-ref');
      } catch {
        /* algunos entornos (jsdom) no soportan setData */
      }
    }
    // Un precio es "contradictorio" solo si se introduce desde Certificaciones;
    // copiar desde la referencia nunca lo marca como tal.
    setRefDrag({ items, contra: false });
  }
  function dragStart(e: React.DragEvent, p: RefPartida) {
    if (!source) return;
    const k = refKey(p);
    // Si la partida arrastrada está en la selección, arrastra TODA la selección.
    beginDrag(e, sel[k] ? Object.values(sel) : [copyItem(source, p)]);
  }
  const endDrag = () => setRefDrag(null);

  // Copia/arrastra el subárbol completo de un contenedor (capítulo o subcapítulo).
  const nodeItems = (node: RefContainer): RefCopyItem[] =>
    source ? subtreePartidas(node, bySub).map((p) => copyItem(source, p)) : [];

  // Quitar una obra de solo-referencia (importada) de la lista. Si era la fuente
  // seleccionada, deselecciona antes de borrar (el efecto de invalidación de caché
  // ya purga la borrada; sin deseleccionar, la fuente quedaría "datos dañados").
  function deleteSource(id: string) {
    if (refSourceId === id) setRefSource('');
    void deleteObraById(id.slice('obra:'.length));
  }

  // Render recursivo del árbol del banco: cada contenedor (capítulo o subcapítulo,
  // N niveles) muestra sus partidas directas seguidas de sus hijos. La sangría la
  // dan los `partList` anidados (no hay que calcularla). Solo en modo navegación
  // (en búsqueda se pinta la lista plana de resultados).
  const renderNode = (node: RefContainer, depth: number): React.ReactNode => {
    const open = !!expanded[node.id];
    const directPs = bySub.get(node.id) ?? [];
    const kids = node.children ?? [];
    return (
      <div key={node.id} className={styles.chap}>
        <div
          draggable
          onDragStart={(e) => beginDrag(e, nodeItems(node))}
          onDragEnd={endDrag}
          className={styles.chapRow}
        >
          <button
            type="button"
            onClick={() => setExpanded((e) => ({ ...e, [node.id]: !e[node.id] }))}
            className={`tcol ${styles.chapChev}`}
            aria-label={open ? `Colapsar ${node.title}` : `Desplegar ${node.title}`}
          >
            <Icon name={open ? 'chevronDown' : 'chevron'} size={14} />
          </button>
          <span className={`mono ${styles.chapCode}`}>{node.code}</span>
          <span className={`caps ${styles.chapTitle}`}>{node.title}</span>
          <span className={styles.chapCount}>{subtreeCount.get(node.id) ?? 0}</span>
          <button
            type="button"
            onClick={() => requestCopyRefPartidas(nodeItems(node), null, false)}
            title="Copiar el contenedor entero"
            aria-label={`Copiar ${node.code} entero`}
            className={`tcol ${styles.chapCopy}`}
          >
            <Icon name="arrowLeft" size={14} />
          </button>
        </div>
        {open && (kids.length > 0 || directPs.length > 0) && (
          <div className={styles.partList}>
            {directPs.map((p) => (
              <RefPartidaRow
                key={p.id}
                p={p}
                selected={!!sel[refKey(p)]}
                onToggleSel={toggleSel}
                onCopyOne={(pp) => source && requestCopyRefPartidas([copyItem(source, pp)], null, false)}
                onDragStart={dragStart}
                onDragEnd={endDrag}
              />
            ))}
            {kids.map((c) => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headTop}>
          <span className={`sec-head ${styles.headTitle}`}>Referencia · copiar partidas</span>
          <button
            type="button"
            onClick={() => setRefMax()}
            title={refMaximized ? 'Restaurar tamaño' : 'Ver a pantalla completa'}
            aria-label={refMaximized ? 'Restaurar tamaño' : 'Ver a pantalla completa'}
            aria-pressed={refMaximized}
            className={`tcol icon-btn ${styles.closeBtn}`}
          >
            <Icon name={refMaximized ? 'shrink' : 'expand'} size={15} />
          </button>
          <button
            type="button"
            onClick={() => setRefOpen(false)}
            title="Cerrar referencia"
            aria-label="Cerrar referencia"
            className={`tcol icon-btn ${styles.closeBtn}`}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <SourceSelect
          sources={sourceList}
          curId={refSourceId}
          onSelect={setRefSource}
          onImport={onImport}
          onDelete={deleteSource}
        />
        <div className={styles.search}>
          <Icon name="search" size={15} style={{ color: 'var(--text-disabled)', flexShrink: 0 }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar partida o código…"
            aria-label="Buscar partida o código"
            className={styles.searchInput}
          />
          {q && (
            <button type="button" onClick={() => setQ('')} className={`tcol ${styles.searchClear}`} aria-label="Limpiar búsqueda">
              <Icon name="x" size={13} />
            </button>
          )}
        </div>
      </div>

      <div className={`scroll-thin ${styles.tree}`}>
        {loading ? (
          <div className={styles.state}>
            <Icon name="loader" size={16} className={styles.spin} /> Cargando obra…
          </div>
        ) : error ? (
          <div className={styles.state}>
            <Icon name="alert" size={16} /> {error}
          </div>
        ) : !source ? (
          <div className={styles.empty}>
            <Icon name="layers" size={22} className={styles.emptyIcon} />
            <p className={styles.emptyText}>
              No hay fuentes de referencia. Añade una base de precios .bc3 (no reemplaza tu
              obra) o usa otra de tus obras para copiar partidas.
            </p>
            <button type="button" onClick={onImport} className={styles.emptyCta}>
              <Icon name="upload" size={14} /> Añadir base de referencia
            </button>
          </div>
        ) : searching ? (
          <div className={styles.partList}>
            {search.matches.map(({ p, path }) => (
              <RefPartidaRow
                key={p.id}
                p={p}
                pathLabel={path}
                selected={!!sel[refKey(p)]}
                onToggleSel={toggleSel}
                onCopyOne={(pp) => source && requestCopyRefPartidas([copyItem(source, pp)], null, false)}
                onDragStart={dragStart}
                onDragEnd={endDrag}
              />
            ))}
            {search.matches.length === 0 && <div className={styles.state}>Sin coincidencias</div>}
            {search.truncated && (
              <div className={styles.state}>Afina la búsqueda ({REF_SEARCH_CAP}+ resultados)</div>
            )}
          </div>
        ) : (
          source.chapters.map((ch) => renderNode(ch, 0))
        )}
      </div>

      {selCount > 0 && (
        <div className={styles.actionBar}>
          <div className={styles.selBox}>
            <div className={styles.selInfo}>
              <span className={styles.selText}>
                <span className={`mono ${styles.selCount}`}>{selCount}</span> seleccionada
                {selCount === 1 ? '' : 's'}
              </span>
              <button type="button" onClick={() => setSel({})} className={`tcol ${styles.selClear}`}>
                Limpiar
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                requestCopyRefPartidas(Object.values(sel), null, false);
                setSel({});
              }}
              className={styles.copyToBtn}
            >
              <Icon name="arrowLeft" size={15} style={{ flexShrink: 0 }} />
              <span style={{ flexShrink: 0 }}>Copiar a</span>
              <span className={styles.copyToLabel}>{target.label}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

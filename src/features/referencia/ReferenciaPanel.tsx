import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components';
import { REF_SOURCES, type RefCopyItem, type RefPartida, type RefSource } from '../../core/refdata';
import { deleteObraById, useSessionStore } from '../../persist';
import { selectCopyContra, selectCopyTarget, useObraStore } from '../../store';
import { loadObraRefSource, lruPut } from './obraSource';
import { SourceSelect, type SourceDesc } from './components/SourceSelect';
import { RefPartidaRow } from './components/RefPartidaRow';
import { REF_SEARCH_CAP, useRefIndex, type RefContainer } from './useRefIndex';
import styles from './Referencia.module.css';

/** Auto-abrir el primer capítulo solo si tiene ≤ este nº de partidas (bases enormes → colapsado, 2A). */
const REF_AUTOOPEN_MAX = 200;

/** Filas de partida renderizadas por contenedor abierto; «Mostrar más» sube el tope
 *  de ESE contenedor (PLAN_REFERENCIA_LAZY §3). Solo limita el DOM: copiar o
 *  arrastrar el contenedor opera sobre `bySub`, no sobre lo pintado. */
const REF_BROWSE_CAP = 200;

/** Item de copia desde una partida de referencia. */
function copyItem(source: RefSource, p: RefPartida): RefCopyItem {
  return { sourceName: source.name, partida: p };
}

/** Todas las partidas del subárbol de un contenedor (sus directas + las de sus
 *  descendientes), para copiar/arrastrar un capítulo o subcapítulo entero. */
function subtreePartidas(node: RefContainer, bySub: Map<string, RefPartida[]>): RefPartida[] {
  const out = [...(bySub.get(node.id) ?? [])];
  for (const c of node.children ?? []) out.push(...subtreePartidas(c, bySub));
  return out;
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
  // Naturaleza de la copia según la vista: contradictorio (P.C.) en Certificaciones,
  // partida normal (BASE) en Presupuesto. La regla vive en `selectCopyContra`.
  const contra = useObraStore(selectCopyContra);
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
      // LRU: volver a una fuente ya cacheada refresca su recencia (un A→B→A→C
      // debe desalojar B, no A). Si ya es la última clave, devuelve el MISMO
      // objeto → React descarta el set y el efecto no cicla.
      if (isObraSrc && obraCache[refSourceId]) {
        setObraCache((c) =>
          Object.keys(c).at(-1) === refSourceId ? c : lruPut(c, refSourceId, c[refSourceId]!),
        );
      }
      setLoading(false);
      setError(null);
      return;
    }
    const obraId = refSourceId.slice('obra:'.length);
    const meta = obras.find((o) => o.id === obraId);
    setLoading(true);
    setError(null);
    loadObraRefSource(obraId, meta?.name ?? 'Obra')
      .then((rs) => {
        if (myReq !== reqRef.current) return; // el usuario cambió de fuente: descarta
        setLoading(false);
        if (rs) setObraCache((c) => lruPut(c, refSourceId, rs));
        else setError('No se pudo cargar la obra (datos dañados).');
      })
      // E-06: un rechazo de IndexedDB dejaba el spinner girando para siempre
      // (solo se manejaba el «resultado null», no el rechazo).
      .catch(() => {
        if (myReq !== reqRef.current) return;
        setLoading(false);
        setError('No se pudo cargar la obra.');
      });
  }, [refSourceId, isObraSrc, obraCache, obras]);

  const [sel, setSel] = useState<Record<string, RefCopyItem>>({});
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Tope de filas renderizadas por contenedor (id → tope subido con «Mostrar más»).
  const [rowCap, setRowCap] = useState<Record<string, number>>({});

  // Al cambiar de fuente, limpia selección/búsqueda/topes de render.
  useEffect(() => {
    setSel({});
    setQ('');
    setRowCap({});
  }, [refSourceId]);

  // Índice/búsqueda de la fuente (derivaciones puras, F-06): agrupado por
  // contenedor, recuentos de subárbol y la lista plana de coincidencias.
  const { bySub, subtreeCount, searching, search } = useRefIndex(source, q);

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
    // Un precio es "contradictorio" solo si se introduce desde Certificaciones; la
    // naturaleza se CONGELA aquí (al iniciar el arrastre) con la vista de ese momento.
    setRefDrag({ items, contra });
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
    deleteObraById(id.slice('obra:'.length)).catch(() =>
      setError('No se pudo quitar la obra de referencia. Reintenta.'),
    );
  }

  // Render recursivo del árbol del banco: cada contenedor (capítulo o subcapítulo,
  // N niveles) muestra sus partidas directas seguidas de sus hijos. La sangría la
  // dan los `partList` anidados (no hay que calcularla). Solo en modo navegación
  // (en búsqueda se pinta la lista plana de resultados).
  const renderNode = (node: RefContainer, depth: number): React.ReactNode => {
    const open = !!expanded[node.id];
    const directPs = bySub.get(node.id) ?? [];
    const kids = node.children ?? [];
    // Tope de render: abrir un contenedor de miles de partidas (BCCA, Precio
    // Centro) no monta miles de filas — pinta las primeras REF_BROWSE_CAP y
    // «Mostrar más» sube el tope de ESE contenedor. Copiar/arrastrar no cambia.
    const cap = rowCap[node.id] ?? REF_BROWSE_CAP;
    const visiblePs = directPs.length > cap ? directPs.slice(0, cap) : directPs;
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
            onClick={() => requestCopyRefPartidas(nodeItems(node), null, contra)}
            title="Copiar el contenedor entero"
            aria-label={`Copiar ${node.code} entero`}
            className={`tcol ${styles.chapCopy}`}
          >
            <Icon name="arrowLeft" size={14} />
          </button>
        </div>
        {open && (kids.length > 0 || directPs.length > 0) && (
          <div className={styles.partList}>
            {visiblePs.map((p) => (
              <RefPartidaRow
                key={p.id}
                p={p}
                selected={!!sel[refKey(p)]}
                onToggleSel={toggleSel}
                onCopyOne={(pp) => source && requestCopyRefPartidas([copyItem(source, pp)], null, contra)}
                onDragStart={dragStart}
                onDragEnd={endDrag}
              />
            ))}
            {directPs.length > cap && (
              <button
                type="button"
                className={`tcol ${styles.moreBtn}`}
                onClick={() => setRowCap((m) => ({ ...m, [node.id]: cap + REF_BROWSE_CAP }))}
              >
                <Icon name="chevronDown" size={13} />
                Mostrar {Math.min(REF_BROWSE_CAP, directPs.length - cap).toLocaleString('es-ES')} más
                <span className={styles.moreCount}>
                  {(directPs.length - cap).toLocaleString('es-ES')} ocultas
                </span>
              </button>
            )}
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
                onCopyOne={(pp) => source && requestCopyRefPartidas([copyItem(source, pp)], null, contra)}
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
                requestCopyRefPartidas(Object.values(sel), null, contra);
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

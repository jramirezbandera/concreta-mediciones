import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Icon } from '../../components';
import { fmtNum, round2 } from '../../core/money';
import { REF_DESC, REF_SOURCES, type RefCopyItem, type RefPartida, type RefSource } from '../../core/refdata';
import type { View } from '../../layout';
import { useSessionStore } from '../../persist';
import { selectCopyTarget, useObraStore } from '../../store';
import { loadObraRefSource } from './obraSource';
import styles from './Referencia.module.css';

/** Descriptor ligero de fuente para el selector (sin cargar la obra entera). */
interface SourceDesc {
  id: string;
  kind: 'base' | 'presupuesto';
  name: string;
  org: string;
}

/** Item de copia desde una partida de referencia. */
function copyItem(source: RefSource, p: RefPartida): RefCopyItem {
  return { sourceName: source.name, partida: p };
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
}: {
  sources: SourceDesc[];
  curId: string;
  onSelect: (id: string) => void;
  onImport: () => void;
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
  const cur = sources.find((s) => s.id === curId) ?? sources[0]!;
  return (
    <div ref={ref} className={styles.srcWrap}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={`tcol ${styles.srcBtn}`}>
        <span className={styles.srcIcon}>
          <Icon name={cur.kind === 'base' ? 'layers' : 'doc'} size={15} />
        </span>
        <span className={styles.srcText}>
          <span className={styles.srcName}>{cur.name}</span>
          <span className={styles.srcOrg}>{cur.org}</span>
        </span>
        <Icon name="chevronDown" size={15} style={{ color: 'var(--text-disabled)', flexShrink: 0 }} />
      </button>
      {open && (
        <div className={styles.srcMenu}>
          {sources.map((s) => {
            const on = s.id === curId;
            return (
              <button
                key={s.id}
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
            );
          })}
          <div className={styles.srcDivider} />
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
                Importar base de precios…
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
}: {
  p: RefPartida;
  selected: boolean;
  onToggleSel: (p: RefPartida) => void;
  onCopyOne: (p: RefPartida) => void;
  onDragStart: (e: React.DragEvent, p: RefPartida) => void;
  onDragEnd: () => void;
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
export function ReferenciaPanel() {
  const refSourceId = useObraStore((s) => s.refSourceId);
  const setRefSource = useObraStore((s) => s.setRefSource);
  const setRefOpen = useObraStore((s) => s.setRefOpen);
  const setView = useObraStore((s) => s.setView);
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
      .map((o) => ({ id: `obra:${o.id}`, kind: 'presupuesto', name: o.name, org: 'Obra propia' }));
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
  const [contra, setContra] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Al cambiar de fuente, limpia selección/búsqueda.
  useEffect(() => {
    setSel({});
    setQ('');
  }, [refSourceId]);

  // Al resolverse la fuente (estática o cargada), abre su primer capítulo.
  useEffect(() => {
    const first = source?.chapters[0];
    setExpanded(first ? { [first.id]: true } : {});
  }, [source]);

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
  const query = q.trim().toLowerCase();
  const matchP = (p: RefPartida) => !query || `${p.title} ${p.code}`.toLowerCase().includes(query);

  const chapterData = useMemo(
    () => (source ? source.chapters.map((ch) => ({ ch, ps: source.partidas[ch.id] ?? [] })) : []),
    [source],
  );

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
    setRefDrag({ items, contra });
  }
  function dragStart(e: React.DragEvent, p: RefPartida) {
    if (!source) return;
    const k = refKey(p);
    // Si la partida arrastrada está en la selección, arrastra TODA la selección.
    beginDrag(e, sel[k] ? Object.values(sel) : [copyItem(source, p)]);
  }
  function dragStartChapter(e: React.DragEvent, ps: RefPartida[]) {
    if (!source) return;
    beginDrag(e, ps.map((p) => copyItem(source, p)));
  }
  const endDrag = () => setRefDrag(null);

  function openImport() {
    setView('import' as View);
    setRefOpen(false);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headTop}>
          <span className={`sec-head ${styles.headTitle}`}>Referencia · copiar partidas</span>
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
        <SourceSelect sources={sourceList} curId={refSourceId} onSelect={setRefSource} onImport={openImport} />
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
        <button
          type="button"
          onClick={() => setContra((c) => !c)}
          className={`tcol ${styles.contraBtn} ${contra ? styles.on : ''}`}
          aria-pressed={contra}
        >
          <span className={`${styles.contraTrack} ${contra ? styles.on : ''}`}>
            <span className={styles.contraKnob} />
          </span>
          <span className={styles.contraLabel}>Copiar como precio contradictorio</span>
        </button>
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
        ) : (
          chapterData.map(({ ch, ps }) => {
            const filtered = ps.filter(matchP);
            if (query && !filtered.length) return null;
            const open = query ? true : !!expanded[ch.id];
            return (
              <div key={ch.id} className={styles.chap}>
                <div
                  draggable
                  onDragStart={(e) => dragStartChapter(e, ps)}
                  onDragEnd={endDrag}
                  className={styles.chapRow}
                >
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => ({ ...e, [ch.id]: !e[ch.id] }))}
                    className={`tcol ${styles.chapChev}`}
                    aria-label={open ? `Colapsar ${ch.title}` : `Desplegar ${ch.title}`}
                  >
                    <Icon name={open ? 'chevronDown' : 'chevron'} size={14} />
                  </button>
                  <span className={`mono ${styles.chapCode}`}>{ch.code}</span>
                  <span className={`caps ${styles.chapTitle}`}>{ch.title}</span>
                  <span className={styles.chapCount}>{ps.length}</span>
                  <button
                    type="button"
                    onClick={() => source && requestCopyRefPartidas(ps.map((p) => copyItem(source, p)), null, contra)}
                    title="Copiar capítulo entero"
                    aria-label={`Copiar capítulo ${ch.code} entero`}
                    className={`tcol ${styles.chapCopy}`}
                  >
                    <Icon name="arrowLeft" size={14} />
                  </button>
                </div>
                {open && (
                  <div className={styles.partList}>
                    {(query ? filtered : ps).map((p) => (
                      <RefPartidaRow
                        key={p.id}
                        p={p}
                        selected={!!sel[refKey(p)]}
                        onToggleSel={toggleSel}
                        onCopyOne={(pp) =>
                          source && requestCopyRefPartidas([copyItem(source, pp)], null, contra)
                        }
                        onDragStart={dragStart}
                        onDragEnd={endDrag}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className={styles.actionBar}>
        {selCount > 0 ? (
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
        ) : (
          <div className={styles.hint}>
            <Icon name="grip" size={14} style={{ flexShrink: 0 }} />
            Arrastra una partida al árbol de tu presupuesto, o marca varias y cópialas a{' '}
            <span className={styles.hintTarget}>{target.label}</span>.
          </div>
        )}
      </div>
    </div>
  );
}

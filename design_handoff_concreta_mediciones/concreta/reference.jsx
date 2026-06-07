/* ===========================================================================
   Concreta · Mediciones — Panel de Referencia (modo split)
   Abre una base de precios u otro presupuesto en solo lectura y permite copiar
   partidas/capítulos al presupuesto propio (arrastrando o por selección).
   El payload de arrastre se publica en window.__refDrag.
   =========================================================================== */
const { Icon: RIcon, ICONS: RI } = window.MedIcons;
const { Badge: RBadge } = window.MedUI;

/* clave única de una partida de referencia */
function refKey(sourceId, p) { return sourceId + "::" + p.id; }

/* construye el item de copia para una partida */
function partidaItem(source, chId, p) {
  return { kind: "partida", sourceId: source.id, sourceName: source.name, chId, partida: p };
}

/* ---------- selector de fuente ------------------------------------------- */
function SourceSelect({ sources, curId, onSelect, onImport }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const cur = sources.find((s) => s.id === curId) || sources[0];
  return (
    <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <button onClick={() => setOpen((o) => !o)} className="tcol"
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, height: 38, padding: "0 10px", borderRadius: 8,
          border: "1px solid var(--border-main)", background: "var(--bg-surface)", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <span style={{ display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: 7, flexShrink: 0,
          background: "var(--accent-soft)", color: "var(--accent)" }}>
          <RIcon d={cur.kind === "base" ? RI.layers : RI.doc} size={15} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cur.name}</span>
          <span style={{ display: "block", fontSize: 10.5, color: "var(--text-disabled)" }}>{cur.org}</span>
        </span>
        <RIcon d={RI.chevronDown} size={15} style={{ color: "var(--text-disabled)", flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: 44, left: 0, right: 0, zIndex: 200, padding: 6,
          borderRadius: 11, background: "var(--bg-surface)", border: "1px solid var(--border-main)", boxShadow: "var(--shadow-float)" }}>
          {sources.map((s) => {
            const on = s.id === curId;
            return (
              <button key={s.id} onClick={() => { onSelect(s.id); setOpen(false); }} className="tcol export-item"
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 9px", borderRadius: 8,
                  border: 0, cursor: "pointer", background: on ? "var(--accent-soft)" : "transparent", textAlign: "left", fontFamily: "inherit" }}>
                <span style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: on ? "var(--accent)" : "var(--bg-elevated)", color: on ? "var(--on-accent)" : "var(--text-secondary)" }}>
                  <RIcon d={s.kind === "base" ? RI.layers : RI.doc} size={14} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: on ? "var(--accent)" : "var(--text-primary)" }}>{s.name}</span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--text-disabled)" }}>{s.org} · {s.kind === "base" ? "Base de precios" : "Presupuesto"}</span>
                </span>
              </button>
            );
          })}
          <div style={{ height: 1, background: "var(--border-sub)", margin: "5px 8px" }} />
          <button onClick={() => { setOpen(false); if (onImport) onImport(); }} className="tcol export-item"
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 9px", borderRadius: 8, border: 0, cursor: "pointer", background: "transparent", textAlign: "left", fontFamily: "inherit", color: "var(--accent)" }}>
            <span style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: "var(--accent-soft)" }}>
              <RIcon d={RI.upload} size={15} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>Importar base de precios…</span>
              <span style={{ display: "block", fontSize: 11, color: "var(--text-disabled)" }}>Archivo .bc3 (FIEBDC-3) · CYPE, Presto, ITeC…</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- fila de partida de referencia (con descripción desplegable) -- */
function RefPartida({ source, chId, p, selected, onToggleSel, onCopyOne, onDragStart }) {
  const [open, setOpen] = React.useState(false);
  const desc = (window.REF_DESC && window.REF_DESC[p.code]) || p.desc;
  const base = (p.items || []).filter((it) => it.type !== "%CI").reduce((s, it) => s + window.round2(it.cantidad * it.precio), 0);
  return (
    <div style={{ borderRadius: 8, border: "1px solid " + (open ? "var(--border-main)" : "transparent"), overflow: "hidden",
      background: open ? "var(--bg-elevated)" : "transparent" }}>
      <div draggable
        onDragStart={(e) => onDragStart(e, p)}
        onDragEnd={() => { window.__refDrag = null; }}
        className="ref-row"
        style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 8px 7px 6px", borderRadius: 7, cursor: "grab",
          border: "1px solid " + (selected ? "color-mix(in srgb, var(--accent) 45%, var(--border-main))" : "transparent"),
          background: selected ? "var(--accent-soft)" : "transparent" }}>
        <button onClick={() => setOpen((o) => !o)} title={open ? "Ocultar descripción" : "Ver descripción"} className="tcol"
          style={{ display: "grid", placeItems: "center", width: 18, height: 18, flexShrink: 0, border: 0, background: "transparent", cursor: "pointer", color: open ? "var(--accent)" : "var(--text-disabled)", padding: 0 }}>
          <RIcon d={open ? RI.chevronDown : RI.chevron} size={13} />
        </button>
        <button onClick={() => onToggleSel(p)} title="Seleccionar" className="tcol"
          style={{ display: "grid", placeItems: "center", width: 18, height: 18, flexShrink: 0, borderRadius: 5, cursor: "pointer",
            border: "1.5px solid " + (selected ? "var(--accent)" : "var(--border-main)"), background: selected ? "var(--accent)" : "transparent",
            color: "var(--on-accent)", padding: 0 }}>
          {selected && <RIcon d={RI.check} size={12} />}
        </button>
        <span className="mono" style={{ fontSize: 11, color: "var(--text-disabled)", width: 58, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.code}</span>
        <div style={{ flex: 1, minWidth: 0 }} onClick={() => setOpen((o) => !o)}>
          <div style={{ fontSize: 12.5, fontWeight: open ? 600 : 400, color: "var(--text-primary)", cursor: "pointer",
            overflow: open ? "visible" : "hidden", textOverflow: open ? "clip" : "ellipsis", whiteSpace: open ? "normal" : "nowrap", lineHeight: open ? 1.35 : 1.4 }}>{p.title}</div>
        </div>
        <span className="mono" style={{ fontSize: 11, color: "var(--text-disabled)", flexShrink: 0 }}>{p.ud}</span>
        <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", width: 64, textAlign: "right", flexShrink: 0 }}>{window.fmtNum(p.precio)}</span>
        <button onClick={() => onCopyOne(p)} title="Copiar a mi presupuesto" className="tcol ref-copy"
          style={{ display: "grid", placeItems: "center", width: 26, height: 26, flexShrink: 0, borderRadius: 6, cursor: "pointer",
            border: 0, background: "var(--bg-elevated)", color: "var(--accent)" }}>
          <RIcon d={RI.arrowLeft} size={15} />
        </button>
      </div>
      {open && (
        <div style={{ padding: "4px 12px 12px 32px" }}>
          {desc && <p style={{ margin: "4px 0 10px", fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)" }}>{desc}</p>}
          {(p.items || []).length > 0 && (
            <div style={{ borderRadius: 7, border: "1px solid var(--border-main)", background: "var(--bg-surface)", overflow: "hidden" }}>
              <div className="caps" style={{ fontSize: 9, fontWeight: 600, color: "var(--text-disabled)", padding: "7px 10px 5px" }}>Descomposición</div>
              {(p.items || []).map((it, i) => {
                const imp = it.type === "%CI" ? window.round2((base * it.cantidad) / 100) : window.round2(it.cantidad * it.precio);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderTop: "1px solid var(--border-sub)" }}>
                    <RBadge type={it.type} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.desc}</span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--text-disabled)", flexShrink: 0 }}>{window.fmtNum(it.cantidad, 3)} {it.type === "%CI" ? "%" : it.ud}</span>
                    <span className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", width: 56, textAlign: "right", flexShrink: 0 }}>{window.fmtNum(imp)}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={() => onCopyOne(p)} className="t150"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 7, border: 0, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--on-accent)", background: "var(--accent)", fontFamily: "inherit" }}>
              <RIcon d={RI.arrowLeft} size={14} /> Copiar a mi presupuesto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===========================================================================
   Panel de Referencia
   =========================================================================== */
function ReferencePanel({ sources, curSourceId, onSelectSource, onCopy, activeChapterLabel, onClose, onImport, compact }) {
  const source = sources.find((s) => s.id === curSourceId) || sources[0];
  const [expanded, setExpanded] = React.useState(() => {
    const e = {}; (source.chapters || []).forEach((c, i) => { if (i === 0) e[c.id] = true; }); return e;
  });
  const [sel, setSel] = React.useState({});   // key -> item
  const [q, setQ] = React.useState("");
  const [contra, setContra] = React.useState(false); // copiar como precio contradictorio
  React.useEffect(() => { window.__refContra = contra; return () => { window.__refContra = false; }; }, [contra]);

  React.useEffect(() => { setSel({}); setQ(""); }, [curSourceId]);

  const query = q.trim().toLowerCase();
  const matchP = (p) => !query || (p.title + " " + p.code).toLowerCase().includes(query);

  function toggleSel(p) {
    const k = refKey(source.id, p);
    setSel((prev) => { const n = { ...prev }; if (n[k]) delete n[k]; else n[k] = partidaItem(source, p._chId, p); return n; });
  }
  const selCount = Object.keys(sel).length;

  function dragStart(e, p) {
    const k = refKey(source.id, p);
    const items = sel[k] ? Object.values(sel) : [partidaItem(source, p._chId, p)];
    window.__refDrag = items;
    e.dataTransfer.effectAllowed = "copy";
    try { e.dataTransfer.setData("text/plain", "concreta-ref"); } catch (_) {}
  }
  function dragStartChapter(e, ch, partidas) {
    const items = partidas.map((p) => partidaItem(source, ch.id, p));
    window.__refDrag = items;
    e.dataTransfer.effectAllowed = "copy";
    try { e.dataTransfer.setData("text/plain", "concreta-ref"); } catch (_) {}
  }

  // partidas con su chId inyectado
  const chapterData = (source.chapters || []).map((ch) => {
    const ps = (source.partidas[ch.id] || []).map((p) => ({ ...p, _chId: ch.id }));
    return { ch, ps };
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg-surface)", minWidth: 0 }}>
      {/* cabecera */}
      <div style={{ flexShrink: 0, padding: "10px 12px", borderBottom: "1px solid var(--border-main)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
          <span className="sec-head" style={{ flex: 1 }}>Referencia · copiar partidas</span>
          <button onClick={onClose} title="Cerrar referencia" className="tcol icon-btn" style={{ width: 26, height: 26 }}>
            <RIcon d={RI.x} size={16} />
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <SourceSelect sources={sources} curId={curSourceId} onSelect={onSelectSource} onImport={onImport} />
        </div>
        {/* buscador */}
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, height: 34, padding: "0 10px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-main)" }}>
          <RIcon d={RI.search} size={15} style={{ color: "var(--text-disabled)", flexShrink: 0 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar partida o código…"
            style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", fontSize: 13, color: "var(--text-primary)", fontFamily: "inherit" }} />
          {q && <button onClick={() => setQ("")} className="tcol" style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--text-disabled)", padding: 2 }}><RIcon d={RI.x} size={13} /></button>}
        </div>
        {/* copiar como precio contradictorio */}
        <button onClick={() => setContra((c) => !c)} className="tcol"
          style={{ marginTop: 8, width: "100%", display: "flex", alignItems: "center", gap: 9, height: 32, padding: "0 8px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
            border: "1px solid " + (contra ? "color-mix(in srgb, var(--state-warn) 50%, var(--border-main))" : "var(--border-main)"),
            background: contra ? "color-mix(in srgb, var(--state-warn) 10%, transparent)" : "transparent" }}>
          <span style={{ display: "grid", placeItems: "center", width: 30, height: 18, borderRadius: 20, flexShrink: 0, padding: 2, justifyContent: contra ? "flex-end" : "flex-start",
            background: contra ? "var(--state-warn)" : "var(--border-main)", transition: "background .15s" }}>
            <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", display: "block" }} />
          </span>
          <span style={{ flex: 1, textAlign: "left", fontSize: 12, fontWeight: 500, color: contra ? "var(--state-warn)" : "var(--text-secondary)" }}>Copiar como precio contradictorio</span>
        </button>
      </div>

      {/* árbol */}
      <div className="scroll-thin" style={{ flex: 1, overflowY: "auto", padding: "8px 8px 12px" }}>
        {chapterData.map(({ ch, ps }) => {
          const filtered = ps.filter(matchP);
          if (query && !filtered.length) return null;
          const open = query ? true : !!expanded[ch.id];
          return (
            <div key={ch.id} style={{ marginBottom: 2 }}>
              <div className="ref-chap" draggable
                onDragStart={(e) => dragStartChapter(e, ch, ps)}
                onDragEnd={() => { window.__refDrag = null; }}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 8px", borderRadius: 7, cursor: "grab" }}>
                <button onClick={() => setExpanded((e) => ({ ...e, [ch.id]: !e[ch.id] }))} className="tcol"
                  style={{ display: "grid", placeItems: "center", width: 18, height: 18, border: 0, background: "transparent", cursor: "pointer", color: "var(--text-disabled)", flexShrink: 0, padding: 0 }}>
                  <RIcon d={open ? RI.chevronDown : RI.chevron} size={14} />
                </button>
                <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", flexShrink: 0 }}>{ch.code}</span>
                <span className="caps" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.title}</span>
                <span style={{ fontSize: 11, color: "var(--text-disabled)", flexShrink: 0 }}>{ps.length}</span>
                <button onClick={() => onCopy(ps.map((p) => partidaItem(source, ch.id, p)), contra)} title="Copiar capítulo entero" className="tcol ref-copy"
                  style={{ display: "grid", placeItems: "center", width: 24, height: 24, flexShrink: 0, borderRadius: 6, cursor: "pointer", border: 0, background: "var(--bg-elevated)", color: "var(--accent)" }}>
                  <RIcon d={RI.arrowLeft} size={14} />
                </button>
              </div>
              {open && (
                <div style={{ paddingLeft: 8, display: "flex", flexDirection: "column", gap: 1, marginTop: 1 }}>
                  {(query ? filtered : ps).map((p) => (
                    <RefPartida key={p.id} source={source} chId={ch.id} p={p}
                      selected={!!sel[refKey(source.id, p)]} onToggleSel={toggleSel}
                      onCopyOne={(pp) => onCopy([partidaItem(source, ch.id, pp)], contra)}
                      onDragStart={dragStart} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* barra de acción */}
      <div style={{ flexShrink: 0, padding: "10px 12px", borderTop: "1px solid var(--border-main)", background: "var(--bg-elevated)" }}>
        {selCount > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}><span className="mono" style={{ color: "var(--accent)", fontWeight: 600 }}>{selCount}</span> seleccionada{selCount === 1 ? "" : "s"}</span>
              <button onClick={() => setSel({})} className="tcol" style={{ marginLeft: "auto", border: 0, background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--text-disabled)", fontFamily: "inherit" }}>Limpiar</button>
            </div>
            <button onClick={() => { onCopy(Object.values(sel), contra); setSel({}); }} className="t150"
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 7, height: 36, padding: "0 13px", borderRadius: 7, border: 0, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--on-accent)", background: "var(--accent)", fontFamily: "inherit" }}>
              <RIcon d={RI.arrowLeft} size={15} style={{ flexShrink: 0 }} />
              <span style={{ flexShrink: 0 }}>Copiar a</span>
              <span style={{ minWidth: 0, flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.9 }}>{activeChapterLabel}</span>
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--text-disabled)", lineHeight: 1.4 }}>
            <RIcon d={RI.grip} size={14} style={{ flexShrink: 0 }} />
            Arrastra una partida al árbol de tu presupuesto, o marca varias y cópialas a <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{activeChapterLabel}</span>.
          </div>
        )}
      </div>
    </div>
  );
}

window.MedRef = { ReferencePanel };

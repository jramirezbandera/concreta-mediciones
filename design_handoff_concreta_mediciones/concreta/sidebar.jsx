/* ===========================================================================
   Concreta · Mediciones — Sidebar (árbol de capítulos + Resumen)
   =========================================================================== */
const { Icon: SbIcon, ICONS: SB } = window.MedIcons;
const { Bar: SbBar, InlineCreate: SbCreate, IvaSelect: SbIva } = window.MedUI;

/* ---------- Fila de capítulo de primer nivel ----------------------------- */
function ChapterCard({ ch, active, expanded, onSelect, onToggle, importe, pct, onAddSub, onDropRef, onDelete }) {
  const isActive = active === ch.id || (ch.children && ch.children.some((c) => c.id === active));
  const hasChildren = ch.children && ch.children.length;
  const [hover, setHover] = React.useState(false);
  const [drop, setDrop] = React.useState(false);
  const dropProps = onDropRef ? {
    onDragOver: (e) => { if (window.__refDrag) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setDrop(true); } },
    onDragLeave: () => setDrop(false),
    onDrop: (e) => { const it = window.__refDrag; setDrop(false); if (it) { e.preventDefault(); window.__refDrag = null; onDropRef(it, ch.id, null, window.__refContra); } },
  } : {};
  return (
    <button onClick={() => onSelect(ch.id)} className="tcol" {...dropProps}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: "relative", width: "100%", textAlign: "left", padding: "9px 12px",
        border: drop ? "1px solid var(--accent)" : "1px solid transparent", cursor: "pointer", borderRadius: 6, fontFamily: "inherit",
        background: drop ? "var(--accent-soft)" : (isActive ? "var(--accent-soft)" : (hover ? "var(--bg-elevated)" : "transparent")),
        boxShadow: drop ? "0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent)" : "none",
      }}>
      {isActive && <span style={{ position: "absolute", left: 0, top: 7, bottom: 7, width: 2.5, borderRadius: 2, background: "var(--accent)" }} />}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {hasChildren ? (
          <span onClick={(e) => { e.stopPropagation(); onToggle(ch.id); }} className="tcol"
            style={{ display: "grid", placeItems: "center", width: 18, height: 18, marginLeft: -2, color: "var(--text-disabled)" }}>
            <SbIcon d={expanded ? SB.chevronDown : SB.chevron} size={13} />
          </span>
        ) : <span style={{ width: 16, flexShrink: 0 }} />}
        <span className="mono" style={{ fontSize: 11, flexShrink: 0, color: isActive ? "var(--accent)" : "var(--text-disabled)" }}>{ch.code}</span>
        <span style={{
          flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13,
          fontWeight: isActive ? 600 : 500, color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
        }}>{ch.title}</span>
        {onAddSub && (
          <span onClick={(e) => { e.stopPropagation(); onAddSub(ch.id); }} title="Añadir subcapítulo" className="tcol"
            style={{ display: "grid", placeItems: "center", width: 18, height: 18, borderRadius: 4, flexShrink: 0,
              color: "var(--text-disabled)", opacity: isActive || hover ? 1 : 0 }}>
            <SbIcon d={SB.plus} size={13} />
          </span>
        )}
        {onDelete && (
          <span onClick={(e) => { e.stopPropagation(); if (window.confirm("¿Eliminar el capítulo «" + ch.title + "» y todas sus partidas?")) onDelete(ch.id); }} title="Eliminar capítulo" className="tcol sb-del"
            style={{ display: "grid", placeItems: "center", width: 18, height: 18, borderRadius: 4, flexShrink: 0, color: "var(--text-disabled)", opacity: isActive || hover ? 1 : 0 }}>
            <SbIcon d={SB.trash} size={13} />
          </span>
        )}
        {importe > 0 && (
          <span className="mono" style={{ fontSize: 11, fontWeight: 500, flexShrink: 0, color: isActive ? "var(--accent)" : "var(--text-disabled)" }}>
            {window.fmtNum(importe / 1000, 1)}k
          </span>
        )}
      </div>
      {importe > 0 && (
        <div style={{ marginTop: 7, paddingLeft: 26, paddingRight: 2, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1 }}><SbBar pct={pct} active={isActive} height={3} /></div>
          <span className="mono" style={{ fontSize: 10, flexShrink: 0, color: isActive ? "var(--accent)" : "var(--text-disabled)" }}>{window.fmtNum(pct, 1)}%</span>
        </div>
      )}
    </button>
  );
}

/* ---------- Subcapítulos (al expandir) ----------------------------------- */
function SubRows({ ch, active, onSelect, onDropRef, onDelete }) {
  return (
    <div style={{ margin: "2px 0 4px 26px", paddingLeft: 10, borderLeft: "1px solid var(--border-main)", display: "flex", flexDirection: "column", gap: 1 }}>
      {ch.children.map((c) => {
        const on = active === c.id;
        return <SubRow key={c.id} ch={ch} c={c} on={on} onSelect={onSelect} onDropRef={onDropRef} onDelete={onDelete} />;
      })}
    </div>
  );
}
function SubRow({ ch, c, on, onSelect, onDropRef, onDelete }) {
  const [drop, setDrop] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const dropProps = onDropRef ? {
    onDragOver: (e) => { if (window.__refDrag) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setDrop(true); } },
    onDragLeave: () => setDrop(false),
    onDrop: (e) => { const it = window.__refDrag; setDrop(false); if (it) { e.preventDefault(); window.__refDrag = null; onDropRef(it, ch.id, c.id, window.__refContra); } },
  } : {};
  return (
    <button onClick={() => onSelect(c.id)} className="tcol" {...dropProps}
      onMouseEnter={(e) => { setHover(true); if (!on && !drop) e.currentTarget.style.background = "var(--bg-elevated)"; }}
      onMouseLeave={(e) => { setHover(false); if (!on && !drop) e.currentTarget.style.background = "transparent"; }}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8, height: 28, padding: "0 8px",
        textAlign: "left", border: drop ? "1px solid var(--accent)" : "1px solid transparent", cursor: "pointer", borderRadius: 5, fontFamily: "inherit",
        background: drop ? "var(--accent-soft)" : (on ? "var(--accent-soft)" : "transparent"),
        color: on ? "var(--accent)" : "var(--text-secondary)", fontWeight: on ? 500 : 400,
      }}>
      <span className="mono" style={{ fontSize: 10.5, opacity: 0.8 }}>{c.code}</span>
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5 }}>{c.title}</span>
      {onDelete && (
        <span onClick={(e) => { e.stopPropagation(); if (window.confirm("¿Eliminar el subcapítulo «" + c.title + "»? Sus partidas pasan al capítulo.")) onDelete(ch.id, c.id); }} title="Eliminar subcapítulo" className="tcol sb-del"
          style={{ display: "grid", placeItems: "center", width: 18, height: 18, borderRadius: 4, flexShrink: 0, color: "var(--text-disabled)", opacity: on || hover ? 1 : 0 }}>
          <SbIcon d={SB.trash} size={12} />
        </span>
      )}
    </button>
  );
}

/* ---------- Tarjeta Resumen con barra de composición --------------------- */
function ResumenCard({ pem, ivaRate, onSetIva }) {
  const rate = ivaRate != null ? ivaRate : window.IVA_RATE;
  const ggbi = window.round2(pem * window.GGBI_RATE);
  const pec = window.round2(pem + ggbi);
  const iva = window.round2(pec * rate);
  const total = window.round2(pec + iva);
  const segs = [
    { label: "PEM", value: pem, color: "var(--accent)" },
    { label: "GG + BI", value: ggbi, color: "color-mix(in srgb, var(--accent) 45%, var(--bg-elevated))" },
    { label: "IVA", value: iva, color: "var(--text-disabled)" },
  ];
  const Row = ({ label, value, color, strong }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
        {color && <span style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: color }} />}
        {label}
      </span>
      <span className="mono" style={{ fontSize: 12, flexShrink: 0, fontWeight: strong ? 600 : 500, color: strong ? "var(--text-primary)" : "var(--text-secondary)" }}>
        {window.fmtEur(value)}
      </span>
    </div>
  );
  return (
    <div style={{ borderRadius: 10, border: "1px solid var(--border-main)", background: "var(--bg-elevated)", padding: 14, boxShadow: "var(--shadow-panel)" }}>
      <div className="sec-head" style={{ marginBottom: 11 }}>Resumen</div>
      {/* barra de composición apilada */}
      <div style={{ display: "flex", width: "100%", height: 9, borderRadius: 999, overflow: "hidden", gap: 2, marginBottom: 12 }}>
        {segs.map((s, i) => (
          <div key={i} style={{ width: (s.value / total) * 100 + "%", background: s.color, borderRadius: 2, transition: "width .5s ease" }} title={s.label} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Row label="PEM" value={pem} color={segs[0].color} />
        <Row label={"GG + BI (" + Math.round(window.GGBI_RATE * 100) + "%)"} value={ggbi} color={segs[1].color} />
        <Row label="PEC s/ IVA" value={pec} strong />
        {onSetIva ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: segs[2].color }} />
              <SbIva rate={rate} onChange={onSetIva} />
            </span>
            <span className="mono" style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{window.fmtEur(iva)}</span>
          </div>
        ) : (
          <Row label={"IVA " + Math.round(rate * 100) + "%"} value={iva} color={segs[2].color} />
        )}
      </div>
      <div style={{ marginTop: 13, paddingTop: 13, borderTop: "1px solid var(--border-main)", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Total</span>
        <span className="mono" style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>{window.fmtEur(total)}</span>
      </div>
    </div>
  );
}

/* ---------- Sidebar completa --------------------------------------------- */
function Sidebar({ active, expanded, onSelect, onToggle, pem, chapterTotals, chapters, onAddChapter, onAddSubchapter, drawer, onAfterSelect, refOpen, onDropRef, onDeleteChapter, onDeleteSub, ivaRate, onSetIva }) {
  const [creatingChapter, setCreatingChapter] = useState(false);
  const [creatingSubFor, setCreatingSubFor] = useState(null);
  const allActive = active === "__ALL__";
  const sel = (id) => { onSelect(id); if (onAfterSelect) onAfterSelect(); };
  return (
    <aside style={{ width: drawer ? "min(88vw, 308px)" : 286, height: drawer ? "100%" : "auto", flexShrink: 0, borderRight: "1px solid var(--border-main)", background: "var(--bg-surface)", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Toda la obra */}
      <div style={{ padding: "12px 10px 0" }}>
        <button onClick={() => sel("__ALL__")} className="tcol"
          style={{
            position: "relative", width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
            textAlign: "left", borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
            background: allActive ? "var(--accent-soft)" : "transparent",
            border: allActive ? "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" : "1px solid transparent",
          }}
          onMouseEnter={(e) => { if (!allActive) e.currentTarget.style.background = "var(--bg-elevated)"; }}
          onMouseLeave={(e) => { if (!allActive) e.currentTarget.style.background = "transparent"; }}>
          <span style={{
            display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: 6,
            background: allActive ? "var(--accent)" : "var(--bg-elevated)",
            color: allActive ? "var(--on-accent)" : "var(--text-secondary)",
          }}>
            <SbIcon d={SB.grid} size={14} />
          </span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: allActive ? 600 : 500, color: allActive ? "var(--accent)" : "var(--text-primary)" }}>Toda la obra</span>
          <span className="mono" style={{ fontSize: 11, fontWeight: 500, color: allActive ? "var(--accent)" : "var(--text-disabled)" }}>{window.fmtNum(pem / 1000, 1)}k</span>
        </button>
      </div>

      {/* cabecera de capítulos */}
      <div style={{ padding: "16px 14px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="sec-head">Capítulos</span>
        <span onClick={() => setCreatingChapter(true)} title="Añadir capítulo" className="tcol"
          style={{ display: "grid", placeItems: "center", width: 22, height: 22, borderRadius: 5, color: "var(--text-disabled)", cursor: "pointer" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-disabled)"; }}>
          <SbIcon d={SB.plus} size={15} />
        </span>
      </div>

      <nav className="scroll-thin" style={{ flex: 1, overflowY: "auto", padding: "0 10px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        {chapters.map((ch) => (
          <div key={ch.id}>
            <ChapterCard ch={ch} active={active} expanded={!!expanded[ch.id]}
              onSelect={sel} onToggle={onToggle}
              importe={chapterTotals[ch.id] || 0}
              pct={pem ? ((chapterTotals[ch.id] || 0) / pem) * 100 : 0}
              onAddSub={(id) => { onToggle(id, true); setCreatingSubFor(id); }}
              onDropRef={onDropRef} onDelete={onDeleteChapter} />
            {ch.children && expanded[ch.id] && <SubRows ch={ch} active={active} onSelect={sel} onDropRef={onDropRef} onDelete={onDeleteSub} />}
            {creatingSubFor === ch.id && (
              <div style={{ marginLeft: 26, marginTop: 2 }}>
                <SbCreate placeholder="Nombre del subcapítulo…"
                  onCommit={(t) => { onAddSubchapter(ch.id, t); setCreatingSubFor(null); }}
                  onCancel={() => setCreatingSubFor(null)} />
              </div>
            )}
          </div>
        ))}
        {creatingChapter && (
          <SbCreate placeholder="Nombre del capítulo…"
            onCommit={(t) => { onAddChapter(t); setCreatingChapter(false); }}
            onCancel={() => setCreatingChapter(false)} />
        )}
      </nav>

      <div style={{ padding: 10, borderTop: "1px solid var(--border-main)", background: "var(--bg-surface)" }}>
        <ResumenCard pem={pem} ivaRate={ivaRate} onSetIva={onSetIva} />
      </div>
    </aside>
  );
}

window.MedSidebar = { Sidebar, ResumenCard };

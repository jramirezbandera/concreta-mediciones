/* ===========================================================================
   Concreta · Mediciones — componentes base de UI (estética Concreta, dark/light)
   =========================================================================== */
const { useState, useMemo, useRef, useEffect } = React;

/* ---------- Iconos (lucide paths, stroke 1.6) ---------------------------- */
function Icon({ d, size = 16, cls = "", sw = 1.7, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round"
      strokeLinejoin="round" className={cls} style={style} aria-hidden="true">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}
const ICONS = {
  chevron: "M9 6l6 6-6 6",
  chevronDown: "M6 9l6 6 6-6",
  upload: ["M12 16V4", "M7 9l5-5 5 5", "M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"],
  list: ["M8 6h12", "M8 12h12", "M8 18h12", "M3.5 6h.01", "M3.5 12h.01", "M3.5 18h.01"],
  download: ["M12 4v12", "M7 11l5 5 5-5", "M4 19v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1"],
  doc: ["M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z", "M14 3v5h5"],
  layers: ["M12 3l9 5-9 5-9-5 9-5z", "M3 13l9 5 9-5", "M3 17l9 5 9-5"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3"],
  command: ["M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0-3 3"],
  menu: ["M3 6h18", "M3 12h18", "M3 18h18"],
  clipboardCheck: ["M9 5H7a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2", "M9 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9V5z", "M9.5 13.5l2 2 3.5-4"],
  arrowLeft: ["M19 12H5", "M11 18l-6-6 6-6"],
  split: ["M3 4h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z", "M12 4v16"],
  grip: ["M9 5h.01", "M9 12h.01", "M9 19h.01", "M15 5h.01", "M15 12h.01", "M15 19h.01"],
  dots: ["M12 5h.01", "M12 12h.01", "M12 19h.01"],
  trash: ["M4 7h16", "M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2", "M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13", "M10 11v6", "M14 11v6"],
  building: ["M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17", "M3 21h18", "M9 7h.01", "M9 11h.01", "M9 15h.01", "M14 21v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v4"],
  idcard: ["M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z", "M8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M5 16c.5-1.6 1.8-2.5 3-2.5s2.5.9 3 2.5", "M14 9h5", "M14 13h5"],
  hardhat: ["M4 16a8 8 0 0 1 16 0", "M3 16h18", "M10 8V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3"],
  compass: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M15.5 8.5l-2 5-5 2 2-5 5-2z"],
  plus: ["M12 5v14", "M5 12h14"],
  pencil: ["M12 20h9", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"],
  folder: ["M3 7.5a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.4.6l1 1a2 2 0 0 0 1.4.6H19a2 2 0 0 1 2 2v6.3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5z"],
  ruler: ["M4 14.5L14.5 4 20 9.5 9.5 20 4 14.5z", "M8 11l2 2", "M11 8l2 2", "M14.5 8.5l1.5 1.5"],
  grid: ["M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"],
  check: ["M5 12l5 5 9-11"],
  x: ["M6 6l12 12", "M18 6L6 18"],
  sun: ["M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z", "M12 1v3", "M12 20v3", "M4.2 4.2l2.1 2.1", "M17.7 17.7l2.1 2.1", "M1 12h3", "M20 12h3", "M4.2 19.8l2.1-2.1", "M17.7 6.3l2.1-2.1"],
  moon: ["M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"],
};

/* ---------- Badge de tipo de recurso (Concreta: punto + mono caps) ------- */
const BADGE = {
  MO:    { label: "MO",  color: "var(--state-warn)" },
  MQ:    { label: "MQ",  color: "var(--state-mq)" },
  MAT:   { label: "MAT", color: "var(--state-mat)" },
  "%CI": { label: "%CI", color: "var(--state-neutral)" },
};
function Badge({ type }) {
  const b = BADGE[type] || BADGE["%CI"];
  return (
    <span className="badge" style={{
      background: "color-mix(in srgb, " + b.color + " 13%, transparent)",
      color: b.color,
    }}>
      <span className="dot" style={{ background: b.color }} />
      {b.label}
    </span>
  );
}

/* ---------- Botón fantasma de la barra superior --------------------------- */
function GhostBtn({ icon, children, onClick, active }) {
  return (
    <button onClick={onClick} className="tcol"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 11px",
        borderRadius: 6, fontSize: 13, fontWeight: 500, border: 0, cursor: "pointer",
        background: active ? "var(--bg-elevated)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; } }}>
      {icon && <Icon d={ICONS[icon]} size={15} />}
      {children}
    </button>
  );
}

/* ---------- Barra de proporción (lineal) --------------------------------- */
function Bar({ pct, active, height = 4 }) {
  return (
    <div style={{ width: "100%", height, borderRadius: 999, overflow: "hidden", background: "var(--border-main)" }}>
      <div style={{
        height: "100%", borderRadius: 999, transition: "width .5s cubic-bezier(.22,1,.36,1)",
        width: Math.max(2, Math.min(100, pct)) + "%",
        background: active ? "var(--accent)" : "var(--text-disabled)",
      }} />
    </div>
  );
}

/* ---------- Celda numérica editable inline ------------------------------- */
function EditableNum({ value, dec = 2, onCommit, bold, accent }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.select(); }, [editing]);

  function start() {
    setDraft(window.fmtNum(value, dec).replace(/\./g, ""));
    setEditing(true);
  }
  function commit() {
    const norm = draft.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(norm);
    setEditing(false);
    if (!isNaN(n)) onCommit(n);
  }
  if (editing) {
    return (
      <input ref={inputRef} value={draft} inputMode="decimal"
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="mono"
        style={{
          width: "100%", textAlign: "right", borderRadius: 4, padding: "3px 6px", margin: "-2px 0",
          outline: "none", fontSize: 12.5, color: "var(--text-primary)",
          background: "var(--bg-primary)", border: "1px solid var(--accent)",
          boxShadow: "0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent)",
        }} />
    );
  }
  return (
    <button onClick={start} className="mono tcol"
      style={{
        position: "relative", width: "100%", textAlign: "right", borderRadius: 4,
        padding: "3px 6px", margin: "-2px 0", border: 0, cursor: "text", background: "transparent",
        fontSize: 12.5, fontWeight: bold ? 600 : 400,
        color: accent ? "var(--accent)" : (bold ? "var(--text-primary)" : "var(--text-secondary)"),
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      {window.fmtNum(value, dec)}
    </button>
  );
}

window.MedIcons = { Icon, ICONS };

/* ---------- Hook de breakpoint responsive -------------------------------- */
function useBreakpoint() {
  const get = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1280;
    return { w, isMobile: w < 760, isTablet: w >= 760 && w < 1024, isDesktop: w >= 1024, isCompact: w < 1024 };
  };
  const [bp, setBp] = useState(get);
  useEffect(() => {
    let raf = 0;
    const onR = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setBp(get())); };
    window.addEventListener("resize", onR);
    return () => { window.removeEventListener("resize", onR); cancelAnimationFrame(raf); };
  }, []);
  return bp;
}
window.useBreakpoint = useBreakpoint;
window.MedUI = { Badge, GhostBtn, EditableNum, Bar };

/* ---------- Selector de IVA (10% reforma / 21% obra nueva) --------------- */
function IvaSelect({ rate, onChange, align = "left" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const opts = [[0.10, "Reforma de vivienda"], [0.21, "Obra nueva"]];
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} className="tcol"
        title="Cambiar tipo de IVA" style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 5px 1px 6px", borderRadius: 5,
          border: "1px solid var(--border-main)", background: open ? "var(--bg-surface)" : "transparent", cursor: "pointer", fontFamily: "inherit",
          fontSize: 11.5, fontWeight: 500, color: "var(--text-secondary)" }}>
        IVA {Math.round(rate * 100)}%
        <Icon d={ICONS.chevronDown} size={12} style={{ color: "var(--text-disabled)" }} />
      </button>
      {open && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: 26, [align]: 0, width: 196, zIndex: 400, padding: 5,
          borderRadius: 9, background: "var(--bg-surface)", border: "1px solid var(--border-main)", boxShadow: "var(--shadow-float)" }}>
          {opts.map(([r, label]) => {
            const on = Math.abs(r - rate) < 0.001;
            return (
              <button key={r} onClick={() => { onChange(r); setOpen(false); }} className="tcol"
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 6, border: 0, cursor: "pointer",
                  background: on ? "var(--accent-soft)" : "transparent", textAlign: "left", fontFamily: "inherit" }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--bg-elevated)"; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, width: 34, flexShrink: 0, color: on ? "var(--accent)" : "var(--text-primary)" }}>{Math.round(r * 100)}%</span>
                <span style={{ flex: 1, fontSize: 12.5, color: on ? "var(--accent)" : "var(--text-secondary)" }}>{label}</span>
                {on && <Icon d={ICONS.check} size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}
window.MedUI.IvaSelect = IvaSelect;

/* ---------- Badge de precio contradictorio (no presupuestado) ----------- */
function ContraChip({ small }) {
  return (
    <span title="Precio contradictorio · no incluido en el presupuesto inicial"
      style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 3, padding: small ? "1px 5px" : "1px 6px", borderRadius: 20,
        fontSize: small ? 9 : 9.5, fontWeight: 700, letterSpacing: ".04em", whiteSpace: "nowrap",
        background: "color-mix(in srgb, var(--state-warn) 18%, transparent)", color: "var(--state-warn)" }}>
      P.C.
    </span>
  );
}
window.MedUI.ContraChip = ContraChip;

/* ---------- Texto editable inline (descripciones) ------------------------ */
function autosize(el) { if (!el) return; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
function EditableText({ value, onCommit, className = "", style, placeholder = "—" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    if (editing && ref.current) {
      const el = ref.current; el.focus();
      el.selectionStart = el.selectionEnd = el.value.length;
      autosize(el);
    }
  }, [editing]);
  function commit() {
    setEditing(false);
    const v = draft.replace(/\s+$/, "");
    if (v && v !== value) onCommit(v);
  }
  if (editing) {
    return (
      <textarea ref={ref} value={draft} rows={1}
        onChange={(e) => { setDraft(e.target.value); autosize(e.target); }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
          if (e.key === "Escape") setEditing(false);
        }}
        style={{
          display: "block", width: "100%", resize: "none", borderRadius: 5,
          padding: "4px 6px", margin: "-3px -6px", outline: "none",
          fontSize: 13, lineHeight: 1.55, color: "var(--text-primary)",
          background: "var(--bg-primary)", border: "1px solid var(--accent)",
          boxShadow: "0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent)",
          fontFamily: "inherit",
        }} />
    );
  }
  return (
    <span onClick={() => { setDraft(value || ""); setEditing(true); }} className={"tcol " + className} style={style}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-soft)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      role="textbox">
      {value || <span style={{ color: "var(--text-disabled)", fontStyle: "italic" }}>{placeholder}</span>}
    </span>
  );
}

/* ---------- Creador inline (capítulo / subcapítulo) ---------------------- */
function InlineCreate({ placeholder, onCommit, onCancel }) {
  const [val, setVal] = useState("");
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.focus(); }, []);
  function commit() { const v = val.trim(); if (v) onCommit(v); else onCancel(); }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px" }}>
      <input ref={ref} value={val} placeholder={placeholder}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") onCancel(); }}
        style={{
          flex: 1, minWidth: 0, height: 28, borderRadius: 5, padding: "0 8px", fontSize: 12.5,
          color: "var(--text-primary)", background: "var(--bg-primary)",
          border: "1px solid var(--accent)", outline: "none",
        }} />
      <button onMouseDown={(e) => { e.preventDefault(); commit(); }}
        style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 5, border: 0, cursor: "pointer", color: "var(--on-accent)", background: "var(--accent)" }}>
        <Icon d={ICONS.check} size={15} />
      </button>
      <button onMouseDown={(e) => { e.preventDefault(); onCancel(); }} className="tcol"
        style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 5, border: 0, cursor: "pointer", color: "var(--text-secondary)", background: "transparent" }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
        <Icon d={ICONS.x} size={15} />
      </button>
    </div>
  );
}

window.MedUI.EditableText = EditableText;
window.MedUI.InlineCreate = InlineCreate;

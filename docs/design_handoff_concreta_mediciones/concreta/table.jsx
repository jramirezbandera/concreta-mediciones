/* ===========================================================================
   Concreta · Mediciones — Tabla de partidas + panel de detalle (medición)
   Nivel resumen: código · título · ud · cantidad · precio · importe
   Detalle (al expandir): descripción editable + líneas de medición
   =========================================================================== */
const { Icon: TbIcon, ICONS: TB } = window.MedIcons;
const { Badge: TBadge, EditableNum: TEdit, EditableText: TText, ContraChip: TContra } = window.MedUI;

/* marca visual: partida copiada de una base, hasta que se edite */
function BaseChip({ source }) {
  return (
    <span title={"Copiada de " + (source || "una base") + " · edítala para confirmarla"}
      style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 6px", borderRadius: 20,
        fontSize: 9.5, fontWeight: 700, letterSpacing: ".04em", whiteSpace: "nowrap",
        background: "color-mix(in srgb, var(--state-mq) 15%, transparent)", color: "var(--state-mq)" }}>
      BASE
    </span>
  );
}

/* menú de acciones de partida: mover a otro capítulo/subcapítulo o eliminar */
function PartidaMenu({ p, chapterId, chapters, onMove, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const isCur = (chId, subId) => chId === chapterId && (subId || null) === (p.sub || null);
  const TargetRow = ({ chId, subId, label, code, indent }) => {
    const cur = isCur(chId, subId);
    return (
      <button onClick={() => { if (!cur) { onMove(chId, subId); setOpen(false); } }} className="tcol"
        disabled={cur}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", paddingLeft: indent ? 24 : 8, borderRadius: 6,
          border: 0, cursor: cur ? "default" : "pointer", background: "transparent", textAlign: "left", fontFamily: "inherit", opacity: cur ? 0.55 : 1 }}
        onMouseEnter={(e) => { if (!cur) e.currentTarget.style.background = "var(--bg-elevated)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--text-disabled)", flexShrink: 0, width: indent ? 32 : 22 }}>{code}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        {cur && <span style={{ fontSize: 10, color: "var(--text-disabled)", flexShrink: 0 }}>actual</span>}
      </button>
    );
  };
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} title="Más acciones" className="tcol part-menu-btn"
        style={{ display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: 6, border: 0, cursor: "pointer", background: open ? "var(--bg-elevated)" : "transparent", color: open ? "var(--text-primary)" : "var(--text-disabled)" }}>
        <TbIcon d={TB.dots} size={16} />
      </button>
      {open && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: 30, right: 0, width: 248, zIndex: 300, padding: 6,
          borderRadius: 10, background: "var(--bg-surface)", border: "1px solid var(--border-main)", boxShadow: "var(--shadow-float)" }}>
          <div className="sec-head" style={{ padding: "6px 10px 5px" }}>Mover a</div>
          <div className="scroll-thin" style={{ maxHeight: 252, overflowY: "auto" }}>
            {chapters.map((ch) => (
              <React.Fragment key={ch.id}>
                <TargetRow chId={ch.id} subId={null} code={ch.code} label={ch.title} />
                {(ch.children || []).map((s) => (
                  <TargetRow key={s.id} chId={ch.id} subId={s.id} code={s.code} label={s.title} indent />
                ))}
              </React.Fragment>
            ))}
          </div>
          <div style={{ height: 1, background: "var(--border-sub)", margin: "5px 6px" }} />
          <button onClick={() => { onDelete(); setOpen(false); }} className="tcol"
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 6, border: 0, cursor: "pointer", background: "transparent", textAlign: "left", fontFamily: "inherit", fontSize: 12.5, fontWeight: 500, color: "var(--state-warn)" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "color-mix(in srgb, var(--state-warn) 12%, transparent)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <TbIcon d={TB.trash} size={15} /> Eliminar partida
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Celda numérica de medición (admite vacío = factor 1) --------- */
function MedNum({ value, dec = 2, onCommit, align = "right", muted }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef(null);
  useEffect(() => { if (editing && ref.current) ref.current.select(); }, [editing]);
  const isBlank = value == null || value === "" || isNaN(value);
  function start() { setDraft(isBlank ? "" : window.fmtNum(value, dec).replace(/\./g, "")); setEditing(true); }
  function commit() {
    setEditing(false);
    const s = draft.trim();
    if (s === "") { onCommit(""); return; }
    const n = parseFloat(s.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    if (!isNaN(n)) onCommit(n);
  }
  if (editing) {
    return (
      <input ref={ref} value={draft} inputMode="decimal"
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="mono"
        style={{ width: "100%", textAlign: align, borderRadius: 4, padding: "3px 6px", margin: "-2px 0",
          outline: "none", fontSize: 12, color: "var(--text-primary)", background: "var(--bg-surface)",
          border: "1px solid var(--accent)", boxShadow: "0 0 0 2px color-mix(in srgb, var(--accent) 28%, transparent)" }} />
    );
  }
  return (
    <button onClick={start} className="mono tcol"
      style={{ width: "100%", textAlign: align, borderRadius: 4, padding: "3px 6px", margin: "-2px 0",
        border: 0, cursor: "text", background: "transparent", fontSize: 12,
        color: isBlank ? "var(--text-disabled)" : (muted ? "var(--text-secondary)" : "var(--text-primary)") }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-surface)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      {isBlank ? "·" : window.fmtNum(value, dec)}
    </button>
  );
}

/* ---------- Texto de comentario de línea de medición --------------------- */
function MedComment({ value, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef(null);
  useEffect(() => { if (editing && ref.current) ref.current.select(); }, [editing]);
  if (editing) {
    return (
      <input ref={ref} value={draft} placeholder="Comentario…"
        onChange={(e) => setDraft(e.target.value)} onBlur={() => { setEditing(false); onCommit(draft); }}
        onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); onCommit(draft); } if (e.key === "Escape") setEditing(false); }}
        style={{ width: "100%", borderRadius: 4, padding: "3px 7px", margin: "-2px 0", outline: "none",
          fontSize: 12.5, color: "var(--text-primary)", background: "var(--bg-surface)",
          border: "1px solid var(--accent)", boxShadow: "0 0 0 2px color-mix(in srgb, var(--accent) 28%, transparent)" }} />
    );
  }
  return (
    <span onClick={() => { setDraft(value || ""); setEditing(true); }} className="tcol"
      style={{ display: "block", borderRadius: 4, padding: "3px 7px", margin: "-3px -7px", cursor: "text",
        fontSize: 12.5, color: value ? "var(--text-secondary)" : "var(--text-disabled)", fontStyle: value ? "normal" : "italic" }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-soft)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      {value || "Comentario…"}
    </span>
  );
}

/* ---------- Justificación del precio: en justif.jsx (window.MedJustif) ---- */

/* ---------- Toggle de pestañas del detalle ------------------------------- */
function DetailTab({ id, active, label, count, onClick, compact }) {
  const on = id === active;
  return (
    <button onClick={() => onClick(id)} className="tcol"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: compact ? 34 : 30,
        flex: compact ? 1 : "none", padding: compact ? "0 8px" : "0 14px", borderRadius: 7,
        border: 0, cursor: "pointer", fontSize: compact ? 12 : 12.5, fontWeight: on ? 600 : 500, fontFamily: "inherit",
        background: on ? "var(--bg-surface)" : "transparent",
        color: on ? "var(--text-primary)" : "var(--text-secondary)",
        boxShadow: on ? "var(--shadow-panel)" : "none" }}
      onMouseEnter={(e) => { if (!on) e.currentTarget.style.color = "var(--text-primary)"; }}
      onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = "var(--text-secondary)"; }}>
      {label}
      {count != null && (
        <span className="mono" style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 20,
          background: on ? "var(--accent-soft)" : "var(--bg-elevated)",
          color: on ? "var(--accent)" : "var(--text-disabled)" }}>{count}</span>
      )}
    </button>
  );
}

/* ---------- (Justificación tarjetas: en justif.jsx) ---------------------- */

/* ---------- Campo etiquetado para medición en móvil --------------------- */
function MedField({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="caps" style={{ fontSize: 9, fontWeight: 600, color: "var(--text-disabled)" }}>{label}</span>
      <div style={{ border: "1px solid var(--border-main)", borderRadius: 7, background: "var(--bg-primary)", padding: "5px 4px" }}>{children}</div>
    </div>
  );
}

/* ---------- Medición en tarjetas (móvil) -------------------------------- */
function MedCards({ p, med, onMedEdit, onMedDel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {med.map((l, i) => {
        const parcial = window.lineParcial(l);
        return (
          <div key={i} style={{ borderRadius: 9, border: "1px solid var(--border-main)", background: "var(--bg-surface)", padding: "10px 12px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <MedComment value={l.comment} onCommit={(v) => onMedEdit(p.id, i, "comment", v)} />
              </span>
              <button onClick={() => onMedDel(p.id, i)} title="Eliminar línea" className="med-del tcol"
                style={{ display: "grid", placeItems: "center", width: 30, height: 30, flexShrink: 0, borderRadius: 7, border: 0, cursor: "pointer", background: "var(--bg-elevated)", color: "var(--text-disabled)" }}>
                <TbIcon d={TB.x} size={15} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              <MedField label="Uds"><MedNum value={l.uds} align="center" dec={l.uds != null && Number.isInteger(Number(l.uds)) ? 0 : 2} onCommit={(v) => onMedEdit(p.id, i, "uds", v)} /></MedField>
              <MedField label="Longitud"><MedNum value={l.largo} align="center" onCommit={(v) => onMedEdit(p.id, i, "largo", v)} /></MedField>
              <MedField label="Anchura"><MedNum value={l.ancho} align="center" onCommit={(v) => onMedEdit(p.id, i, "ancho", v)} /></MedField>
              <MedField label="Altura"><MedNum value={l.alto} align="center" onCommit={(v) => onMedEdit(p.id, i, "alto", v)} /></MedField>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 10, paddingTop: 9, borderTop: "1px solid var(--border-sub)" }}>
              <span className="caps" style={{ fontSize: 9, fontWeight: 600, color: "var(--text-disabled)" }}>Parcial</span>
              <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)" }}>{window.fmtNum(parcial)}</span>
            </div>
          </div>
        );
      })}
      {med.length === 0 && (
        <div style={{ padding: "22px 14px", textAlign: "center", fontSize: 12.5, color: "var(--text-disabled)", borderRadius: 9, border: "1px dashed var(--border-main)", background: "var(--bg-surface)" }}>
          Sin líneas de medición. Añade la primera para calcular la cantidad.
        </div>
      )}
    </div>
  );
}

/* ---------- Panel de detalle (toggle a ancho completo) ------------------- */
function DetailPanel({ p, med, onEditField, onMedEdit, onMedAdd, onMedDel, compact, recursos, usage, recApi }) {
  const [tab, setTab] = useState("medicion");
  const total = window.medTotal(med);
  const HCell = ({ children, w, align = "left", pl }) => (
    <th style={{ width: w, textAlign: align, padding: "10px 10px", paddingLeft: pl, fontSize: 9.5, fontWeight: 600,
      letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-disabled)", whiteSpace: "nowrap" }}>{children}</th>
  );
  return (
    <div style={{ padding: compact ? "12px 12px 16px" : "14px 28px 22px", background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-main)" }}>
      {/* barra de pestañas */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 3, padding: 3, borderRadius: 9, background: "var(--bg-primary)", border: "1px solid var(--border-main)", width: compact ? "100%" : "auto" }}>
          <DetailTab id="medicion" active={tab} label="Medición" count={med.length} onClick={setTab} compact={compact} />
          <DetailTab id="descripcion" active={tab} label="Descripción" onClick={setTab} compact={compact} />
          <DetailTab id="justif" active={tab} label={compact ? "Precio" : "Justificación del precio"} count={(p.items || []).length || null} onClick={setTab} compact={compact} />
        </div>
        {!compact && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexShrink: 0, visibility: tab === "medicion" ? "hidden" : "visible" }}>
            <span className="caps" style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-disabled)" }}>Cantidad total</span>
            <span className="mono" style={{ fontSize: 17, fontWeight: 600, color: "var(--accent)" }}>{window.fmtNum(total)}</span>
            <span style={{ fontSize: 12, color: "var(--text-disabled)" }}>{p.ud}</span>
          </div>
        )}
      </div>

      {/* MEDICIÓN */}
      {tab === "medicion" && (
        <div>
          {compact ? (
            <MedCards p={p} med={med} onMedEdit={onMedEdit} onMedDel={onMedDel} />
          ) : (
            <div style={{ borderRadius: 9, border: "1px solid var(--border-main)", background: "var(--bg-surface)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-elevated)" }}>
                    <HCell w="auto" pl={14}>Comentario</HCell>
                    <HCell w={76} align="right">Uds</HCell>
                    <HCell w={104} align="right">Longitud</HCell>
                    <HCell w={104} align="right">Anchura</HCell>
                    <HCell w={104} align="right">Altura</HCell>
                    <HCell w={116} align="right">Parcial</HCell>
                    <HCell w={38}> </HCell>
                  </tr>
                </thead>
                <tbody>
                  {med.map((l, i) => {
                    const parcial = window.lineParcial(l);
                    const td = { padding: "8px 10px", borderTop: "1px solid var(--border-sub)", verticalAlign: "middle" };
                    return (
                      <tr key={i} className="med-row">
                        <td style={{ ...td, paddingLeft: 14 }}><MedComment value={l.comment} onCommit={(v) => onMedEdit(p.id, i, "comment", v)} /></td>
                        <td style={td}><MedNum value={l.uds} dec={l.uds != null && Number.isInteger(Number(l.uds)) ? 0 : 2} onCommit={(v) => onMedEdit(p.id, i, "uds", v)} /></td>
                        <td style={td}><MedNum value={l.largo} onCommit={(v) => onMedEdit(p.id, i, "largo", v)} /></td>
                        <td style={td}><MedNum value={l.ancho} onCommit={(v) => onMedEdit(p.id, i, "ancho", v)} /></td>
                        <td style={td}><MedNum value={l.alto} onCommit={(v) => onMedEdit(p.id, i, "alto", v)} /></td>
                        <td style={td} className="mono"><span style={{ display: "block", textAlign: "right", paddingRight: 8, fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{window.fmtNum(parcial)}</span></td>
                        <td style={{ ...td, textAlign: "center", paddingRight: 8 }}>
                          <button onClick={() => onMedDel(p.id, i)} title="Eliminar línea" className="med-del tcol"
                            style={{ display: "grid", placeItems: "center", width: 22, height: 22, borderRadius: 5, border: 0, cursor: "pointer", background: "transparent", color: "var(--text-disabled)" }}>
                            <TbIcon d={TB.x} size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {med.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: "24px 16px", textAlign: "center", fontSize: 12.5, color: "var(--text-disabled)" }}>
                      Sin líneas de medición. Añade la primera para calcular la cantidad.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {/* pie: añadir línea + cantidad total */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
            padding: compact ? "11px 12px" : "10px 14px", borderRadius: compact ? 9 : "0 0 9px 9px",
            border: "1px solid var(--border-main)", borderTop: compact ? "1px solid var(--border-main)" : "0",
            marginTop: compact ? 10 : -1, background: "var(--bg-elevated)" }}>
            <button onClick={() => onMedAdd(p.id)} className="tcol add-partida"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: compact ? 34 : 30, padding: "0 11px", borderRadius: 6, fontSize: 12.5, fontWeight: 500, border: 0, cursor: "pointer", background: compact ? "var(--bg-surface)" : "transparent", color: "var(--accent)", fontFamily: "inherit" }}>
              <TbIcon d={TB.plus} size={14} /> Añadir línea{compact ? "" : " de medición"}
            </button>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
              <span className="caps" style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-disabled)" }}>Cantidad total</span>
              <span className="mono" style={{ fontSize: 17, fontWeight: 600, color: "var(--accent)" }}>{window.fmtNum(total)}</span>
              <span style={{ fontSize: 11.5, color: "var(--text-disabled)" }}>{p.ud}</span>
            </div>
          </div>
        </div>
      )}

      {/* DESCRIPCIÓN */}
      {tab === "descripcion" && (
        <div style={{ borderRadius: 9, border: "1px solid var(--border-main)", background: "var(--bg-surface)", padding: compact ? "14px 16px" : "18px 22px" }}>
          <TText value={p.desc} onCommit={(v) => onEditField(p.id, "desc", v)}
            placeholder="Escribe la descripción detallada de la partida (sistema constructivo, materiales, normativa de aplicación, criterios de medición y abono…)"
            style={{ fontSize: compact ? 13.5 : 14, lineHeight: 1.7, color: "var(--text-secondary)", display: "block", borderRadius: 5, maxWidth: 820 }} />
        </div>
      )}

      {/* JUSTIFICACIÓN DEL PRECIO */}
      {tab === "justif" && (compact
        ? <window.MedJustif.PriceJustifCards p={p} recursos={recursos} usage={usage} recApi={recApi} />
        : <window.MedJustif.PriceJustifFull p={p} recursos={recursos} usage={usage} recApi={recApi} />)}
    </div>
  );
}

/* ---------- Fila de partida (nivel resumen) ------------------------------ */
function PartidaRow({ p, density, expanded, onToggle, onEditField, medApi, chapterTotal, showBars, recursos, usage, recApi, chaptersAll, partApi }) {
  const cantidad = window.partidaCantidad(p);
  const importe = window.partidaImporte(p);
  const padY = density === "compact" ? 8 : density === "comfy" ? 15 : 11;
  const pct = chapterTotal > 0 ? (importe / chapterTotal) * 100 : 0;
  const [hover, setHover] = React.useState(false);
  const cell = {
    padding: padY + "px 8px", verticalAlign: "middle", borderTop: "1px solid var(--border-sub)",
    background: expanded ? "color-mix(in srgb, var(--accent) 8%, transparent)" : (hover ? "color-mix(in srgb, var(--accent) 4%, transparent)" : "transparent"),
  };
  return (
    <React.Fragment>
      <tr className="tcol" onClick={() => onToggle(p.id)} style={{ cursor: "pointer" }}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <td style={{ ...cell, paddingLeft: 14, width: 124 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TbIcon d={expanded ? TB.chevronDown : TB.chevron} size={13}
              style={{ flexShrink: 0, color: expanded ? "var(--accent)" : "var(--text-disabled)" }} />
            <div style={{ minWidth: 0, lineHeight: 1.25 }}>
              <div className="mono" style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{p.pos}</div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--text-disabled)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.code}</div>
            </div>
          </div>
        </td>
        <td style={{ ...cell, paddingRight: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
            {p.mainType && <TBadge type={p.mainType} />}
            <TText value={p.title} onCommit={(v) => onEditField(p.id, "title", v)}
              placeholder="Título de la partida…"
              style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.4, borderRadius: 3 }} />
            {p.fromBase && <BaseChip source={p.baseSource} />}
            {p.contradictorio && <TContra />}
          </div>
        </td>
        <td className="mono" style={{ ...cell, fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap", width: 48 }}>{p.ud}</td>
        <td className="mono" style={{ ...cell, textAlign: "right", width: 96, paddingRight: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-primary)" }}>{window.fmtNum(cantidad)}</span>
        </td>
        <td style={{ ...cell, width: 92, paddingLeft: 4, paddingRight: 4 }} onClick={(e) => e.stopPropagation()}>
          <TEdit value={p.precio} dec={2} onCommit={(v) => onEditField(p.id, "precio", v)} />
        </td>
        <td style={{ ...cell, paddingRight: 12, paddingLeft: 4, width: 110 }}>
          <div className="mono" style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{window.fmtNum(importe)}</div>
          {showBars && (
            <div style={{ marginTop: 5, marginLeft: "auto", width: 64, height: 3, borderRadius: 999, overflow: "hidden", background: "var(--border-main)" }}>
              <div style={{ height: "100%", borderRadius: 999, width: Math.max(3, pct) + "%", background: "color-mix(in srgb, var(--accent) 60%, var(--bg-elevated))" }} />
            </div>
          )}
        </td>
        <td style={{ ...cell, width: 40, paddingLeft: 0, paddingRight: 8, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
          {partApi && <PartidaMenu p={p} chapterId={partApi.chapterId} chapters={chaptersAll || []}
            onMove={(toCh, toSub) => partApi.move(p.id, toCh, toSub)} onDelete={() => partApi.del(p.id)} />}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: 0 }}>
            <DetailPanel p={p} med={p.med || []}
              onEditField={onEditField}
              onMedEdit={medApi.edit} onMedAdd={medApi.add} onMedDel={medApi.del}
              recursos={recursos} usage={usage} recApi={recApi} />
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

/* ---------- Fila separadora de subcapítulo ------------------------------- */
function SubHeaderRow({ sub, importe }) {
  return (
    <tr style={{ background: "var(--bg-elevated)" }}>
      <td colSpan={5} style={{ padding: "9px 14px", borderTop: "1px solid var(--border-main)", borderBottom: "1px solid var(--border-main)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--accent)" }}>{sub.code}</span>
          <span className="caps" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-primary)" }}>{sub.title}</span>
        </div>
      </td>
      <td className="mono" style={{ padding: "9px 12px 9px 8px", textAlign: "right", fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", borderTop: "1px solid var(--border-main)", borderBottom: "1px solid var(--border-main)" }}>{window.fmtNum(importe)}</td>
      <td style={{ width: 40, borderTop: "1px solid var(--border-main)", borderBottom: "1px solid var(--border-main)" }}></td>
    </tr>
  );
}

/* ---------- Tabla completa ----------------------------------------------- */
function PartidasTable({ chapter, chapterId, partidas, density, expandedRows, onToggleRow, onEdit, onMed, chapterTotal, showBars, sticky = true, onAddPartida, recursos, usage, onRec, chaptersAll, onPart }) {
  const groups = useMemo(() => {
    if (!chapter.children || !chapter.children.length) return [{ sub: null, items: partidas }];
    const used = chapter.children.map((sub) => ({ sub, items: partidas.filter((p) => p.sub === sub.id) }));
    const orphan = partidas.filter((p) => !p.sub || !chapter.children.some((s) => s.id === p.sub));
    if (orphan.length) used.unshift({ sub: null, items: orphan });
    return used.filter((g) => g.items.length > 0 || g.sub);
  }, [chapter, partidas]);

  const onEditField = (pid, field, value) => onEdit(chapterId, pid, field, value);
  const medApi = {
    edit: (pid, idx, field, value) => onMed.edit(chapterId, pid, idx, field, value),
    add: (pid) => onMed.add(chapterId, pid),
    del: (pid, idx) => onMed.del(chapterId, pid, idx),
  };
  const subTotal = (items) => items.reduce((s, p) => s + window.partidaImporte(p), 0);
  const thBase = { textAlign: "left", padding: "11px 8px" };
  const recApi = onRec ? {
    editRecurso: onRec.editRecurso,
    editRend: (pid, idx, v) => onRec.editRend(chapterId, pid, idx, v),
    del: (pid, idx) => onRec.del(chapterId, pid, idx),
    add: (pid) => onRec.add(chapterId, pid),
  } : null;
  const partApi = onPart ? {
    chapterId,
    del: (pid) => onPart.del(chapterId, pid),
    move: (pid, toCh, toSub) => onPart.move(chapterId, pid, toCh, toSub),
  } : null;

  return (
    <table className="ctable" style={{ minWidth: 720 }}>
      <thead style={sticky ? { position: "sticky", top: 0, zIndex: 10 } : null}>
        <tr>
          <th style={{ ...thBase, paddingLeft: 14, width: 124 }}>Nº · Código</th>
          <th style={thBase}>Descripción</th>
          <th style={{ ...thBase, width: 48 }}>Ud.</th>
          <th style={{ ...thBase, textAlign: "right", width: 96, paddingRight: 10 }}>Cantidad</th>
          <th style={{ ...thBase, textAlign: "right", width: 92 }}>Precio</th>
          <th style={{ ...thBase, textAlign: "right", paddingRight: 12, width: 110 }}>Importe</th>
          <th style={{ ...thBase, width: 40 }}></th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g, gi) => (
          <React.Fragment key={gi}>
            {g.sub && <SubHeaderRow sub={g.sub} importe={subTotal(g.items)} />}
            {g.items.map((p) => (
              <PartidaRow key={p.id} p={p} density={density}
                expanded={!!expandedRows[p.id]} onToggle={onToggleRow} onEditField={onEditField}
                medApi={medApi} chapterTotal={chapterTotal} showBars={showBars}
                recursos={recursos} usage={usage} recApi={recApi}
                chaptersAll={chaptersAll} partApi={partApi} />
            ))}
            {onAddPartida && (
              <tr>
                <td colSpan={7} style={{ padding: "6px 14px", borderTop: "1px solid var(--border-sub)" }}>
                  <button onClick={() => onAddPartida(chapterId, g.sub ? g.sub.id : null)} className="tcol add-partida"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 8px", borderRadius: 5,
                      fontSize: 12, fontWeight: 500, border: 0, cursor: "pointer", background: "transparent",
                      color: "var(--text-disabled)", fontFamily: "inherit" }}>
                    <TbIcon d={TB.plus} size={13} /> Añadir partida{g.sub ? " a " + g.sub.code : ""}
                  </button>
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
}

/* ---------- Tarjeta de partida (móvil) ----------------------------------- */
function PartidaCard({ p, expanded, onToggle, onEditField, medApi, recursos, usage, recApi, chaptersAll, partApi }) {
  const cantidad = window.partidaCantidad(p);
  const importe = window.partidaImporte(p);
  const Stat = ({ label, children, stop, last }) => (
    <div onClick={stop ? (e) => e.stopPropagation() : undefined}
      style={{ flex: 1, minWidth: 0, padding: "7px 10px", borderRight: last ? 0 : "1px solid var(--border-sub)" }}>
      <div className="caps" style={{ fontSize: 8.5, fontWeight: 600, color: "var(--text-disabled)", marginBottom: 2 }}>{label}</div>
      <div className="mono" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-primary)" }}>{children}</div>
    </div>
  );
  return (
    <div style={{ borderRadius: 11, border: "1px solid " + (expanded ? "color-mix(in srgb, var(--accent) 45%, var(--border-main))" : "var(--border-main)"),
      background: "var(--bg-surface)", overflow: "hidden", boxShadow: "var(--shadow-panel)" }}>
      <div onClick={() => onToggle(p.id)} style={{ cursor: "pointer", padding: "12px 13px 13px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <TbIcon d={expanded ? TB.chevronDown : TB.chevron} size={15}
            style={{ flexShrink: 0, color: expanded ? "var(--accent)" : "var(--text-disabled)" }} />
          <div style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>{p.pos}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-disabled)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.code}</span>
          </div>
          <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", flexShrink: 0 }}>{window.fmtNum(importe)}</span>
          {partApi && <span onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}><PartidaMenu p={p} chapterId={partApi.chapterId} chapters={chaptersAll || []}
            onMove={(toCh, toSub) => partApi.move(p.id, toCh, toSub)} onDelete={() => partApi.del(p.id)} /></span>}
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 9, paddingLeft: 24 }} onClick={(e) => e.stopPropagation()}>
          {p.mainType && <span style={{ marginTop: 1 }}><TBadge type={p.mainType} /></span>}
          <TText value={p.title} onCommit={(v) => onEditField(p.id, "title", v)}
            placeholder="Título de la partida…"
            style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.35, borderRadius: 3 }} />
          {p.fromBase && <span style={{ marginTop: 1 }}><BaseChip source={p.baseSource} /></span>}
          {p.contradictorio && <span style={{ marginTop: 1 }}><TContra /></span>}
        </div>
        <div style={{ display: "flex", alignItems: "stretch", marginTop: 11, marginLeft: 24,
          border: "1px solid var(--border-sub)", borderRadius: 8, background: "var(--bg-primary)", overflow: "hidden" }}>
          <Stat label="Ud.">{p.ud}</Stat>
          <Stat label="Cantidad">{window.fmtNum(cantidad)}</Stat>
          <Stat label="Precio €" stop last><TEdit value={p.precio} dec={2} onCommit={(v) => onEditField(p.id, "precio", v)} /></Stat>
        </div>
      </div>
      {expanded && (
        <DetailPanel p={p} med={p.med || []} compact
          onEditField={onEditField}
          onMedEdit={medApi.edit} onMedAdd={medApi.add} onMedDel={medApi.del}
          recursos={recursos} usage={usage} recApi={recApi} />
      )}
    </div>
  );
}

/* ---------- Lista de partidas en tarjetas (móvil) ------------------------ */
function PartidasCards({ chapter, chapterId, partidas, expandedRows, onToggleRow, onEdit, onMed, onAddPartida, recursos, usage, onRec, chaptersAll, onPart }) {
  const groups = useMemo(() => {
    if (!chapter.children || !chapter.children.length) return [{ sub: null, items: partidas }];
    const used = chapter.children.map((sub) => ({ sub, items: partidas.filter((p) => p.sub === sub.id) }));
    const orphan = partidas.filter((p) => !p.sub || !chapter.children.some((s) => s.id === p.sub));
    if (orphan.length) used.unshift({ sub: null, items: orphan });
    return used.filter((g) => g.items.length > 0 || g.sub);
  }, [chapter, partidas]);

  const onEditField = (pid, field, value) => onEdit(chapterId, pid, field, value);
  const medApi = {
    edit: (pid, idx, field, value) => onMed.edit(chapterId, pid, idx, field, value),
    add: (pid) => onMed.add(chapterId, pid),
    del: (pid, idx) => onMed.del(chapterId, pid, idx),
  };
  const subTotal = (items) => items.reduce((s, p) => s + window.partidaImporte(p), 0);
  const recApi = onRec ? {
    editRecurso: onRec.editRecurso,
    editRend: (pid, idx, v) => onRec.editRend(chapterId, pid, idx, v),
    del: (pid, idx) => onRec.del(chapterId, pid, idx),
    add: (pid) => onRec.add(chapterId, pid),
  } : null;
  const partApi = onPart ? {
    chapterId,
    del: (pid) => onPart.del(chapterId, pid),
    move: (pid, toCh, toSub) => onPart.move(chapterId, pid, toCh, toSub),
  } : null;

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      {groups.map((g, gi) => (
        <React.Fragment key={gi}>
          {g.sub && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: gi === 0 ? "2px 2px 0" : "10px 2px 0" }}>
              <span className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--accent)" }}>{g.sub.code}</span>
              <span className="caps" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.sub.title}</span>
              <span className="mono" style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "var(--text-disabled)" }}>{window.fmtNum(subTotal(g.items))}</span>
            </div>
          )}
          {g.items.map((p) => (
            <PartidaCard key={p.id} p={p} expanded={!!expandedRows[p.id]}
              onToggle={onToggleRow} onEditField={onEditField} medApi={medApi}
              recursos={recursos} usage={usage} recApi={recApi}
              chaptersAll={chaptersAll} partApi={partApi} />
          ))}
          {onAddPartida && (
            <button onClick={() => onAddPartida(chapterId, g.sub ? g.sub.id : null)} className="tcol"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, height: 40, borderRadius: 9,
                border: "1px dashed var(--border-main)", cursor: "pointer", background: "transparent",
                color: "var(--accent)", fontSize: 13, fontWeight: 500, fontFamily: "inherit" }}>
              <TbIcon d={TB.plus} size={15} /> Añadir partida{g.sub ? " a " + g.sub.code : ""}
            </button>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ---------- Wrapper: tabla (desktop/tablet) o tarjetas (móvil) ----------- */
function Partidas({ compact, ...props }) {
  return compact ? <PartidasCards {...props} /> : <PartidasTable {...props} />;
}

window.MedTable = { PartidasTable, Partidas };

/* ===========================================================================
   Concreta · Mediciones — Certificaciones (avance de obra, con histórico)
   Histórico de certificaciones; cada una guarda la ejecución a origen.
   Por partida: ofertada · ejecutada (a origen) · % · precio · a abonar.
   Resumen: PEM certificado, GG+BI, retención (editable), IVA, líquido.
   =========================================================================== */
const { Icon: CtIcon, ICONS: CT } = window.MedIcons;
const { Badge: CBadge, EditableNum: CEdit, EditableText: CText, IvaSelect: CIva, ContraChip: CContra } = window.MedUI;

/* ---------- cálculo por partida ----------------------------------------- */
function certCalc(p, curData, prevData) {
  const ofertada = window.partidaCantidad(p);
  const ejecutada = curData[p.id] || 0;
  const prev = prevData[p.id] || 0;
  const precio = p.precio || 0;
  const pct = ofertada > 0 ? (ejecutada / ofertada) * 100 : 0;
  const aOrigen = window.round2(ejecutada * precio);
  const anterior = window.round2(prev * precio);
  const estaCert = window.round2(aOrigen - anterior);
  return { ofertada, ejecutada, prev, precio, pct, aOrigen, anterior, estaCert };
}

/* ---------- totales económicos de una certificación --------------------- */
function computeTotals(partidas, curData, prevData, retencion) {
  let budgetPEM = 0, certPEM = 0, prevPEM = 0;
  for (const ch in partidas) for (const p of partidas[ch]) {
    const k = certCalc(p, curData, prevData);
    budgetPEM += window.partidaImporte(p);
    certPEM += k.aOrigen;
    prevPEM += k.anterior;
  }
  budgetPEM = window.round2(budgetPEM); certPEM = window.round2(certPEM); prevPEM = window.round2(prevPEM);
  const pctGlobal = budgetPEM > 0 ? (certPEM / budgetPEM) * 100 : 0;
  const ggbiOrigen = window.round2(certPEM * window.GGBI_RATE);
  const pecOrigen = window.round2(certPEM + ggbiOrigen);
  const pecPrev = window.round2(prevPEM * (1 + window.GGBI_RATE));
  const pecEsta = window.round2(pecOrigen - pecPrev);
  const ret = window.round2(pecEsta * retencion);
  const base = window.round2(pecEsta - ret);
  const iva = window.round2(base * window.IVA_RATE);
  const liquido = window.round2(base + iva);
  return { budgetPEM, certPEM, prevPEM, pctGlobal, ggbiOrigen, pecOrigen, pecPrev, pecEsta, retencion: ret, base, iva, liquido };
}

/* ---------- barra de avance --------------------------------------------- */
function PctBar({ pct }) {
  const full = pct >= 99.5;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
      <div style={{ width: 52, height: 4, borderRadius: 999, overflow: "hidden", background: "var(--border-main)", flexShrink: 0 }}>
        <div style={{ height: "100%", borderRadius: 999, width: Math.max(2, Math.min(100, pct)) + "%",
          background: full ? "var(--state-ok)" : "var(--accent)" }} />
      </div>
      <span className="mono" style={{ fontSize: 11.5, width: 42, textAlign: "right",
        color: full ? "var(--state-ok)" : "var(--text-secondary)" }}>{window.fmtNum(pct, 1)}%</span>
    </div>
  );
}

/* ===========================================================================
   Selector de certificación (histórico + nueva)
   =========================================================================== */
function CertSelector({ certs, curIndex, partidas, onSelect, onAdd, compact }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const cur = certs[curIndex];
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} className="tcol"
        style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 34, padding: "0 12px", borderRadius: 8,
          border: "1px solid var(--border-main)", background: "var(--bg-surface)", cursor: "pointer", fontFamily: "inherit" }}>
        <CtIcon d={CT.clipboardCheck} size={15} style={{ color: "var(--accent)" }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Certificación nº {cur.num}</span>
        <CtIcon d={CT.chevronDown} size={14} style={{ color: "var(--text-disabled)" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: 40, left: 0, width: 300, zIndex: 200, padding: 6,
          borderRadius: 11, background: "var(--bg-surface)", border: "1px solid var(--border-main)", boxShadow: "var(--shadow-float)" }}>
          <div className="sec-head" style={{ padding: "6px 10px 6px" }}>Histórico de certificaciones</div>
          {certs.map((c, i) => {
            const prevData = i > 0 ? certs[i - 1].data : {};
            const tot = computeTotals(partidas, c.data, prevData, c.retencion);
            const on = i === curIndex;
            return (
              <button key={c.id} onClick={() => { onSelect(i); setOpen(false); }} className="tcol export-item"
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "8px 10px", borderRadius: 8,
                  border: 0, cursor: "pointer", background: on ? "var(--accent-soft)" : "transparent", textAlign: "left", fontFamily: "inherit" }}>
                <span style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: on ? "var(--accent)" : "var(--bg-elevated)", color: on ? "var(--on-accent)" : "var(--text-secondary)" }}>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{c.num}</span>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: on ? "var(--accent)" : "var(--text-primary)" }}>Certificación nº {c.num}</span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--text-disabled)" }}>{c.period} · {window.fmtNum(tot.pctGlobal, 0)}% ejecución</span>
                </span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, flexShrink: 0, color: on ? "var(--accent)" : "var(--text-secondary)" }}>{window.fmtEur(tot.liquido)}</span>
              </button>
            );
          })}
          <div style={{ height: 1, background: "var(--border-sub)", margin: "5px 8px" }} />
          <button onClick={() => { onAdd(); setOpen(false); }} className="tcol export-item"
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "9px 10px", borderRadius: 8,
              border: 0, cursor: "pointer", background: "transparent", textAlign: "left", fontFamily: "inherit", color: "var(--accent)" }}>
            <span style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: "var(--accent-soft)" }}>
              <CtIcon d={CT.plus} size={16} />
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>Nueva certificación</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ===========================================================================
   Fila de partida (desktop)
   =========================================================================== */
function CertRow({ p, curData, prevData, onCertEdit, mode, onEditP }) {
  const k = certCalc(p, curData, prevData);
  const [hover, setHover] = React.useState(false);
  const contra = !!p.contradictorio;
  const cell = { padding: "10px 8px", verticalAlign: "middle", borderTop: "1px solid var(--border-sub)",
    background: contra ? "color-mix(in srgb, var(--state-warn) 6%, transparent)" : (hover ? "color-mix(in srgb, var(--accent) 4%, transparent)" : "transparent") };
  const abono = mode === "origen" ? k.aOrigen : k.estaCert;
  return (
    <tr onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <td style={{ ...cell, paddingLeft: 14, width: 116, boxShadow: contra ? "inset 3px 0 0 var(--state-warn)" : "none" }}>
        <div className="mono" style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{p.pos}</div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--text-disabled)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.code}</div>
      </td>
      <td style={{ ...cell, paddingRight: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {p.mainType && <CBadge type={p.mainType} />}
          {contra && onEditP
            ? <CText value={p.title} onCommit={(v) => onEditP(p.id, "title", v)} placeholder="Concepto del precio contradictorio…" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.35, borderRadius: 3 }} />
            : <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.35 }}>{p.title}</span>}
          {contra && <CContra />}
        </div>
      </td>
      <td className="mono" style={{ ...cell, fontSize: 12, color: "var(--text-secondary)", width: 44 }}>
        {contra && onEditP ? <CText value={p.ud} onCommit={(v) => onEditP(p.id, "ud", v)} style={{ fontSize: 12, color: "var(--text-secondary)", borderRadius: 3 }} /> : p.ud}
      </td>
      <td className="mono" style={{ ...cell, textAlign: "right", width: 92, color: "var(--text-secondary)", paddingLeft: 4, paddingRight: 4 }}>
        {contra && onEditP ? <CEdit value={k.ofertada} dec={2} onCommit={(v) => onEditP(p.id, "cantidad", v)} /> : window.fmtNum(k.ofertada)}
      </td>
      <td style={{ ...cell, width: 96, paddingLeft: 4, paddingRight: 4 }}>
        <CEdit value={mode === "origen" ? k.ejecutada : window.round2(k.ejecutada - k.prev)} dec={2} accent
          onCommit={(v) => onCertEdit(p.id, mode === "origen" ? v : window.round2(Math.max(0, k.prev + v)))} />
      </td>
      <td style={{ ...cell, width: 116, paddingRight: 12 }}>{k.ofertada > 0 ? <PctBar pct={k.pct} /> : <span style={{ display: "block", textAlign: "right", paddingRight: 10, fontSize: 11.5, color: "var(--text-disabled)" }}>—</span>}</td>
      <td className="mono" style={{ ...cell, textAlign: "right", width: 84, color: "var(--text-secondary)", paddingLeft: 4, paddingRight: 4 }}>
        {contra && onEditP ? <CEdit value={k.precio} dec={2} onCommit={(v) => onEditP(p.id, "precio", v)} /> : window.fmtNum(k.precio)}
      </td>
      <td className="mono" style={{ ...cell, textAlign: "right", width: 116, paddingRight: 20, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{window.fmtNum(abono)}</td>
    </tr>
  );
}

function CertSubHeader({ sub, total }) {
  return (
    <tr style={{ background: "var(--bg-elevated)" }}>
      <td colSpan={7} style={{ padding: "9px 14px", borderTop: "1px solid var(--border-main)", borderBottom: "1px solid var(--border-main)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--accent)" }}>{sub.code}</span>
          <span className="caps" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-primary)" }}>{sub.title}</span>
        </div>
      </td>
      <td className="mono" style={{ padding: "9px 20px 9px 8px", textAlign: "right", fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", borderTop: "1px solid var(--border-main)", borderBottom: "1px solid var(--border-main)" }}>{window.fmtNum(total)}</td>
    </tr>
  );
}

/* ---------- tabla de un capítulo (desktop) ------------------------------- */
function CertChapterTable({ chapter, partidas, curData, prevData, onCertEdit, mode, onEditPartida }) {
  const groups = React.useMemo(() => {
    if (!chapter.children || !chapter.children.length) return [{ sub: null, items: partidas }];
    const used = chapter.children.map((sub) => ({ sub, items: partidas.filter((p) => p.sub === sub.id) }));
    const orphan = partidas.filter((p) => !p.sub || !chapter.children.some((s) => s.id === p.sub));
    if (orphan.length) used.unshift({ sub: null, items: orphan });
    return used.filter((g) => g.items.length > 0);
  }, [chapter, partidas]);
  const subTotal = (items) => items.reduce((s, p) => { const k = certCalc(p, curData, prevData); return s + (mode === "origen" ? k.aOrigen : k.estaCert); }, 0);
  const editP = onEditPartida ? (pid, field, value) => onEditPartida(chapter.id, pid, field, value) : null;

  return (
    <table className="ctable" style={{ minWidth: 880 }}>
      <tbody>
        {groups.map((g, gi) => (
          <React.Fragment key={gi}>
            {g.sub && <CertSubHeader sub={g.sub} total={subTotal(g.items)} />}
            {g.items.map((p) => <CertRow key={p.id} p={p} curData={curData} prevData={prevData} onCertEdit={onCertEdit} mode={mode} onEditP={editP} />)}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
}

/* ===========================================================================
   Tarjeta de partida (móvil)
   =========================================================================== */
function CertCard({ p, curData, prevData, onCertEdit, mode, onEditP }) {
  const k = certCalc(p, curData, prevData);
  const abono = mode === "origen" ? k.aOrigen : k.estaCert;
  const contra = !!p.contradictorio;
  const Stat = ({ label, children, last }) => (
    <div style={{ flex: 1, minWidth: 0, padding: "7px 10px", borderRight: last ? 0 : "1px solid var(--border-sub)" }}>
      <div className="caps" style={{ fontSize: 8.5, fontWeight: 600, color: "var(--text-disabled)", marginBottom: 2 }}>{label}</div>
      <div className="mono" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-primary)" }}>{children}</div>
    </div>
  );
  return (
    <div style={{ borderRadius: 11, border: "1px solid " + (contra ? "color-mix(in srgb, var(--state-warn) 45%, var(--border-main))" : "var(--border-main)"),
      background: "var(--bg-surface)", overflow: "hidden", boxShadow: "var(--shadow-panel)" }}>
      <div style={{ padding: "11px 13px 12px", borderLeft: contra ? "3px solid var(--state-warn)" : "0" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{p.pos}</span>
          {contra && <CContra small />}
          <span className="mono" style={{ fontSize: 10.5, color: "var(--text-disabled)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{p.code}</span>
          <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{window.fmtNum(abono)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 7 }}>
          {p.mainType && <span style={{ marginTop: 1 }}><CBadge type={p.mainType} /></span>}
          {contra && onEditP
            ? <CText value={p.title} onCommit={(v) => onEditP(p.id, "title", v)} placeholder="Concepto del precio contradictorio…" style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.35, borderRadius: 3 }} />
            : <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.35 }}>{p.title}</span>}
        </div>
        <div style={{ marginTop: 10, marginBottom: 9 }}>{k.ofertada > 0 ? <PctBar pct={k.pct} /> : <div style={{ textAlign: "right", fontSize: 11, color: "var(--text-disabled)" }}>sin cantidad ofertada</div>}</div>
        <div style={{ display: "flex", alignItems: "stretch", border: "1px solid var(--border-sub)", borderRadius: 8, background: "var(--bg-primary)", overflow: "hidden" }}>
          <div style={{ flex: 1, minWidth: 0, padding: "5px 8px", borderRight: "1px solid var(--border-sub)" }}>
            <div className="caps" style={{ fontSize: 8.5, fontWeight: 600, color: "var(--text-disabled)", marginBottom: 1 }}>Ofert. {p.ud}</div>
            {contra && onEditP ? <CEdit value={k.ofertada} dec={2} onCommit={(v) => onEditP(p.id, "cantidad", v)} /> : <span className="mono" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-primary)" }}>{window.fmtNum(k.ofertada)}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0, padding: "5px 8px", borderRight: "1px solid var(--border-sub)" }}>
            <div className="caps" style={{ fontSize: 8.5, fontWeight: 600, color: "var(--text-disabled)", marginBottom: 1 }}>{mode === "origen" ? "Ejec. origen" : "Ejec. esta cert."}</div>
            <CEdit value={mode === "origen" ? k.ejecutada : window.round2(k.ejecutada - k.prev)} dec={2} accent
              onCommit={(v) => onCertEdit(p.id, mode === "origen" ? v : window.round2(Math.max(0, k.prev + v)))} />
          </div>
          <div style={{ flex: 1, minWidth: 0, padding: "5px 8px" }}>
            <div className="caps" style={{ fontSize: 8.5, fontWeight: 600, color: "var(--text-disabled)", marginBottom: 1 }}>Precio €</div>
            {contra && onEditP ? <CEdit value={k.precio} dec={2} onCommit={(v) => onEditP(p.id, "precio", v)} /> : <span className="mono" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-primary)" }}>{window.fmtNum(k.precio)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===========================================================================
   Resumen económico de la certificación (retención editable)
   =========================================================================== */
function CertSummary({ totals, retencion, onRetencion, ivaRate, onSetIva }) {
  const Row = ({ label, value, color, strong, accent, hint }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: strong ? 600 : 400, whiteSpace: "nowrap",
        color: strong ? "var(--text-primary)" : "var(--text-secondary)" }}>
        {color && <span style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: color }} />}
        {label}{hint && <span style={{ color: "var(--text-disabled)", fontWeight: 400 }}>{hint}</span>}
      </span>
      <span className="mono" style={{ fontSize: 12.5, fontWeight: strong ? 600 : 500, flexShrink: 0,
        color: accent ? "var(--accent)" : (strong ? "var(--text-primary)" : "var(--text-secondary)") }}>{window.fmtEur(value)}</span>
    </div>
  );
  const div = <div style={{ height: 1, background: "var(--border-main)", margin: "3px 0" }} />;
  return (
    <div style={{ borderRadius: 11, border: "1px solid var(--border-main)", background: "var(--bg-elevated)", padding: 16, boxShadow: "var(--shadow-panel)" }}>
      <div className="sec-head" style={{ marginBottom: 12 }}>Resumen de la certificación</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <Row label="PEM presupuesto" value={totals.budgetPEM} />
        <Row label="PEM certificado a origen" value={totals.certPEM} accent />
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "2px 0 4px" }}>
          <div style={{ flex: 1, height: 6, borderRadius: 999, overflow: "hidden", background: "var(--border-main)" }}>
            <div style={{ height: "100%", borderRadius: 999, width: Math.min(100, totals.pctGlobal) + "%", background: "var(--accent)" }} />
          </div>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 600 }}>{window.fmtNum(totals.pctGlobal, 1)}%</span>
        </div>
      </div>

      {div}
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <Row label={"GG + BI (" + Math.round(window.GGBI_RATE * 100) + "%)"} value={totals.ggbiOrigen} color="color-mix(in srgb, var(--accent) 45%, var(--bg-elevated))" />
        <Row label="PEC a origen" value={totals.pecOrigen} strong />
        <Row label="Certificación anterior" value={totals.pecPrev} color="var(--text-disabled)" />
        <Row label="Importe esta certificación" value={totals.pecEsta} strong />
      </div>

      {div}
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {/* retención editable */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: "var(--state-warn)" }} />
            Retención garantía
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, padding: "1px 4px", borderRadius: 5, background: "var(--bg-surface)", border: "1px solid var(--border-main)" }}>
              <span style={{ width: 40 }}>
                <CEdit value={retencion * 100} dec={1} accent onCommit={(v) => onRetencion(window.round2((v || 0) / 100))} />
              </span>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-disabled)" }}>%</span>
            </span>
          </span>
          <span className="mono" style={{ fontSize: 12.5, fontWeight: 500, flexShrink: 0, color: "var(--state-warn)" }}>− {window.fmtEur(totals.retencion)}</span>
        </div>
        <Row label="Base imponible" value={totals.base} strong />
        {onSetIva ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: "var(--text-disabled)" }} />
              <CIva rate={ivaRate != null ? ivaRate : window.IVA_RATE} onChange={onSetIva} />
            </span>
            <span className="mono" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)" }}>{window.fmtEur(totals.iva)}</span>
          </div>
        ) : (
          <Row label={"IVA (" + Math.round(window.IVA_RATE * 100) + "%)"} value={totals.iva} color="var(--text-disabled)" />
        )}
      </div>

      <div style={{ marginTop: 13, paddingTop: 13, borderTop: "1px solid var(--border-main)", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div className="caps" style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-disabled)" }}>Líquido a abonar</div>
          <div style={{ fontSize: 11.5, color: "var(--text-disabled)", marginTop: 2 }}>esta certificación</div>
        </div>
        <span className="mono" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>{window.fmtEur(totals.liquido)}</span>
      </div>
    </div>
  );
}

/* ---------- resumen por capítulos ---------------------------------------- */
function CertChapterSummary({ rows }) {
  return (
    <div style={{ borderRadius: 11, border: "1px solid var(--border-main)", background: "var(--bg-surface)", overflow: "hidden" }}>
      <div className="sec-head" style={{ padding: "13px 16px 10px" }}>Resumen por capítulos</div>
      <div>
        {rows.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: "1px solid var(--border-sub)" }}>
            <span className="mono" style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "var(--bg-elevated)", border: "1px solid var(--border-main)", color: "var(--text-secondary)", flexShrink: 0 }}>{r.code}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
              <div style={{ marginTop: 5, height: 4, borderRadius: 999, overflow: "hidden", background: "var(--border-main)" }}>
                <div style={{ height: "100%", borderRadius: 999, width: Math.min(100, r.pct) + "%", background: r.pct >= 99.5 ? "var(--state-ok)" : "var(--accent)" }} />
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, width: 116 }}>
              <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{window.fmtNum(r.cert)}</div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--text-disabled)" }}>de {window.fmtNum(r.budget)}</div>
            </div>
            <span className="mono" style={{ fontSize: 12, fontWeight: 600, width: 48, textAlign: "right", flexShrink: 0,
              color: r.pct >= 99.5 ? "var(--state-ok)" : "var(--accent)" }}>{window.fmtNum(r.pct, 0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===========================================================================
   Vista completa de Certificaciones
   =========================================================================== */
function CertificacionesView({ chapters, partidas, certs, curIndex, onSelectCert, onCertEdit, onCertField, onAddCert, compact, ivaRate, onSetIva, onEditPartida, onAddContradictorio }) {
  const [mode, setMode] = React.useState("origen"); // origen | esta
  const cur = certs[curIndex];
  const curData = cur.data;
  const prevData = curIndex > 0 ? certs[curIndex - 1].data : {};

  const totals = React.useMemo(() => computeTotals(partidas, curData, prevData, cur.retencion),
    [partidas, curData, prevData, cur.retencion]);

  const chapterRows = React.useMemo(() => chapters.map((ch) => {
    const ps = partidas[ch.id] || [];
    let budget = 0, c = 0;
    for (const p of ps) { budget += window.partidaImporte(p); c += certCalc(p, curData, prevData).aOrigen; }
    budget = window.round2(budget); c = window.round2(c);
    return { id: ch.id, code: ch.code, title: ch.title, budget, cert: c, pct: budget > 0 ? (c / budget) * 100 : 0 };
  }).filter((r) => r.budget > 0), [chapters, partidas, curData, prevData]);

  const ModeToggle = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 3, padding: 3, borderRadius: 9, background: "var(--bg-primary)", border: "1px solid var(--border-main)" }}>
      {[["origen", "A origen"], ["esta", "Esta certificación"]].map(([k, label]) => {
        const on = mode === k;
        return (
          <button key={k} onClick={() => setMode(k)} className="tcol"
            style={{ height: 28, padding: "0 12px", borderRadius: 7, border: 0, cursor: "pointer", fontFamily: "inherit",
              fontSize: 12, fontWeight: on ? 600 : 500, background: on ? "var(--bg-surface)" : "transparent",
              color: on ? "var(--text-primary)" : "var(--text-secondary)", boxShadow: on ? "var(--shadow-panel)" : "none" }}>
            {label}
          </button>
        );
      })}
    </div>
  );

  /* -------- cabecera con selector + campos editables -------- */
  const Header = (
    <div style={{ padding: compact ? "12px 16px 12px" : "14px 24px 14px", borderBottom: "1px solid var(--border-main)", background: "var(--bg-surface)",
      position: "sticky", top: 0, zIndex: 30 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flexWrap: "wrap" }}>
          <CertSelector certs={certs} curIndex={curIndex} partidas={partidas} onSelect={onSelectCert} onAdd={onAddCert} compact={compact} />
          {/* periodo editable */}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)" }}>
            <CtIcon d={CT.doc} size={14} style={{ color: "var(--text-disabled)" }} />
            <CText value={cur.period} onCommit={(v) => onCertField("period", v)} placeholder="Periodo…"
              style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", borderRadius: 4 }} />
          </span>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className="caps" style={{ fontSize: 10, fontWeight: 600, color: "var(--text-disabled)", whiteSpace: "nowrap" }}>Líquido a abonar</div>
          <div className="mono" style={{ fontSize: compact ? 19 : 24, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1, marginTop: 5 }}>{window.fmtEur(totals.liquido)}</div>
        </div>
      </div>
      {!compact && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <ModeToggle />
          <span style={{ fontSize: 12, color: "var(--text-disabled)" }}>
            Ejecución global <span className="mono" style={{ color: "var(--accent)", fontWeight: 600 }}>{window.fmtNum(totals.pctGlobal, 1)}%</span>
          </span>
        </div>
      )}
    </div>
  );

  /* -------- desktop -------- */
  if (!compact) {
    return (
      <div style={{ flex: 1, overflow: "auto" }}>
        {Header}
        <table className="ctable" style={{ minWidth: 880 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
            <tr>
              <th style={{ textAlign: "left", padding: "11px 8px", paddingLeft: 14, width: 116 }}>Nº · Código</th>
              <th style={{ textAlign: "left", padding: "11px 8px" }}>Descripción</th>
              <th style={{ textAlign: "left", padding: "11px 8px", width: 44 }}>Ud.</th>
              <th style={{ textAlign: "right", padding: "11px 8px", width: 92 }}>Ofertada</th>
              <th style={{ textAlign: "right", padding: "11px 8px", width: 96 }}>{mode === "origen" ? "Ejec. a origen" : "Ejec. esta cert."}</th>
              <th style={{ textAlign: "right", padding: "11px 8px", width: 116, paddingRight: 12 }}>% avance</th>
              <th style={{ textAlign: "right", padding: "11px 8px", width: 84 }}>Precio</th>
              <th style={{ textAlign: "right", padding: "11px 8px", width: 116, paddingRight: 20 }}>{mode === "origen" ? "A origen" : "Esta cert."}</th>
            </tr>
          </thead>
        </table>
        {chapters.map((ch) => {
          const ps = partidas[ch.id] || [];
          if (!ps.length) return null;
          const row = chapterRows.find((r) => r.id === ch.id) || { pct: 0 };
          const total = ps.reduce((s, p) => { const k = certCalc(p, curData, prevData); return s + (mode === "origen" ? k.aOrigen : k.estaCert); }, 0);
          return (
            <section key={ch.id} data-screen-label={"Cert. capítulo " + ch.code}>
              <div style={{ padding: "10px 24px", background: "var(--bg-elevated)", borderTop: "1px solid var(--border-main)", borderBottom: "1px solid var(--border-main)", display: "flex", alignItems: "center", gap: 12 }}>
                <span className="mono" style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: "var(--bg-surface)", border: "1px solid var(--border-main)", color: "var(--text-secondary)", flexShrink: 0 }}>{ch.code}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.title}</span>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                  <span className="mono" style={{ fontSize: 11, color: row.pct >= 99.5 ? "var(--state-ok)" : "var(--text-disabled)" }}>{window.fmtNum(row.pct, 1)}% ejec.</span>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{window.fmtEur(window.round2(total))}</span>
                </div>
              </div>
              <CertChapterTable chapter={ch} partidas={ps} curData={curData} prevData={prevData} onCertEdit={onCertEdit} mode={mode} onEditPartida={onEditPartida} />
              {onAddContradictorio && (
                <div style={{ padding: "6px 24px 10px", borderBottom: "1px solid var(--border-sub)" }}>
                  <button onClick={() => onAddContradictorio(ch.id, null)} className="tcol"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 9px", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "1px dashed color-mix(in srgb, var(--state-warn) 50%, var(--border-main))", cursor: "pointer", background: "transparent", color: "var(--state-warn)", fontFamily: "inherit" }}>
                    <CtIcon d={CT.plus} size={13} /> Añadir precio contradictorio
                  </button>
                </div>
              )}
            </section>
          );
        })}
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16, padding: "20px 24px 40px", alignItems: "start" }}>
          <CertChapterSummary rows={chapterRows} />
          <CertSummary totals={totals} retencion={cur.retencion} onRetencion={(v) => onCertField("retencion", v)} ivaRate={ivaRate} onSetIva={onSetIva} />
        </div>
      </div>
    );
  }

  /* -------- móvil -------- */
  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      {Header}
      <div style={{ padding: "12px 12px 0" }}><ModeToggle /></div>
      {chapters.map((ch) => {
        const ps = partidas[ch.id] || [];
        if (!ps.length) return null;
        const total = ps.reduce((s, p) => { const k = certCalc(p, curData, prevData); return s + (mode === "origen" ? k.aOrigen : k.estaCert); }, 0);
        return (
          <section key={ch.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 6px" }}>
              <span className="mono" style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "var(--bg-elevated)", border: "1px solid var(--border-main)", color: "var(--text-secondary)" }}>{ch.code}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.title}</span>
              <span className="mono" style={{ marginLeft: "auto", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{window.fmtNum(window.round2(total))}</span>
            </div>
            <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 10 }}>
              {ps.map((p) => <CertCard key={p.id} p={p} curData={curData} prevData={prevData} onCertEdit={onCertEdit} mode={mode}
                onEditP={onEditPartida ? (pid, field, value) => onEditPartida(ch.id, pid, field, value) : null} />)}
              {onAddContradictorio && (
                <button onClick={() => onAddContradictorio(ch.id, null)} className="tcol"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, height: 38, borderRadius: 9, border: "1px dashed color-mix(in srgb, var(--state-warn) 50%, var(--border-main))", cursor: "pointer", background: "transparent", color: "var(--state-warn)", fontSize: 12.5, fontWeight: 500, fontFamily: "inherit" }}>
                  <CtIcon d={CT.plus} size={14} /> Añadir precio contradictorio
                </button>
              )}
            </div>
          </section>
        );
      })}
      <div style={{ padding: "18px 12px 8px", display: "flex", flexDirection: "column", gap: 14 }}>
        <CertChapterSummary rows={chapterRows} />
        <CertSummary totals={totals} retencion={cur.retencion} onRetencion={(v) => onCertField("retencion", v)} ivaRate={ivaRate} onSetIva={onSetIva} />
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
}

window.MedCert = { CertificacionesView };

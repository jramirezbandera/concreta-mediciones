/* ===========================================================================
   Concreta · Mediciones — Resumen de presupuesto (hoja resumen editable)
   Desglose por capítulos + GG, BI e IVA configurables + observaciones.
   =========================================================================== */
const { Icon: RsIcon, ICONS: RsI } = window.MedIcons;
const { EditableNum: RsNum, IvaSelect: RsIva } = window.MedUI;

/* fila editable de porcentaje (GG / BI) */
function PctRow({ label, sublabel, rate, onChange, value, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: "1px solid var(--border-sub)" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {color && <span style={{ width: 9, height: 9, borderRadius: 2, flexShrink: 0, background: color }} />}
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2, padding: "1px 6px 1px 4px", borderRadius: 6, background: "var(--bg-elevated)", border: "1px solid var(--border-main)" }}>
        <span style={{ width: 42 }}>
          <RsNum value={rate * 100} dec={1} accent onCommit={(v) => onChange(window.round2((v || 0) / 100))} />
        </span>
        <span className="mono" style={{ fontSize: 11.5, color: "var(--text-disabled)" }}>%</span>
      </span>
      <span className="mono" style={{ marginLeft: "auto", fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)", flexShrink: 0 }}>{window.fmtEur(value)}</span>
    </div>
  );
}

function ResumenView({ chapters, chapterTotals, pem, ggRate, biRate, ivaRate, onSetGg, onSetBi, onSetIva, notes, onNotes, projectName, compact }) {
  const gg = window.round2(pem * ggRate);
  const bi = window.round2(pem * biRate);
  const pec = window.round2(pem + gg + bi);
  const iva = window.round2(pec * ivaRate);
  const total = window.round2(pec + iva);
  const pad = compact ? "16px" : "24px 32px";

  const TotalRow = ({ label, value, strong, big }) => (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: big ? "14px 0 2px" : "9px 0",
      borderTop: strong || big ? "1px solid var(--border-main)" : "1px solid var(--border-sub)" }}>
      <span style={{ fontSize: big ? 15 : 13, fontWeight: strong || big ? 600 : 400, color: strong || big ? "var(--text-primary)" : "var(--text-secondary)" }}>{label}</span>
      <span className="mono" style={{ fontSize: big ? 22 : 14, fontWeight: strong || big ? 600 : 500, color: "var(--text-primary)", letterSpacing: big ? "-0.01em" : 0 }}>{window.fmtEur(value)}</span>
    </div>
  );

  return (
    <div className="dot-grid" style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: pad }}>
        {/* cabecera */}
        <div style={{ marginBottom: 18 }}>
          <div className="caps" style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".11em", color: "var(--accent)", marginBottom: 6 }}>Resumen de presupuesto</div>
          <h1 style={{ fontSize: compact ? 20 : 25, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>{projectName}</h1>
        </div>

        {/* hoja resumen */}
        <div style={{ borderRadius: 12, border: "1px solid var(--border-main)", background: "var(--bg-surface)", padding: compact ? "16px 16px" : "22px 26px", boxShadow: "var(--shadow-panel)" }}>
          {/* desglose por capítulos */}
          <div className="sec-head" style={{ marginBottom: 4 }}>Desglose por capítulos</div>
          <div>
            {chapters.map((ch) => {
              const imp = chapterTotals[ch.id] || 0;
              const pct = pem ? (imp / pem) * 100 : 0;
              return (
                <div key={ch.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border-sub)" }}>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--text-disabled)", width: 24, flexShrink: 0 }}>{ch.code}</span>
                  <span style={{ fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0, maxWidth: "52%" }}>{ch.title}</span>
                  <span style={{ flex: 1, borderBottom: "1px dotted var(--border-main)", margin: "0 4px", transform: "translateY(-3px)" }} />
                  {!compact && <span className="mono" style={{ fontSize: 11, color: "var(--text-disabled)", flexShrink: 0, width: 44, textAlign: "right" }}>{window.fmtNum(pct, 1)}%</span>}
                  <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", flexShrink: 0, width: 104, textAlign: "right" }}>{window.fmtNum(imp)}</span>
                </div>
              );
            })}
          </div>

          {/* totales */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "10px 0", borderTop: "2px solid var(--border-main)" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>Presupuesto de Ejecución Material (PEM)</span>
              <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{window.fmtEur(pem)}</span>
            </div>
            <PctRow label="Gastos generales" rate={ggRate} onChange={onSetGg} value={gg} color="color-mix(in srgb, var(--accent) 45%, var(--bg-elevated))" />
            <PctRow label="Beneficio industrial" rate={biRate} onChange={onSetBi} value={bi} color="color-mix(in srgb, var(--accent) 25%, var(--bg-elevated))" />
            <TotalRow label="Presupuesto de Ejecución por Contrata (s/ IVA)" value={pec} strong />
            {/* IVA con selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: "1px solid var(--border-sub)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, flexShrink: 0, background: "var(--text-disabled)" }} />
                <RsIva rate={ivaRate} onChange={onSetIva} />
              </span>
              <span className="mono" style={{ marginLeft: "auto", fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{window.fmtEur(iva)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "14px 0 2px", borderTop: "1px solid var(--border-main)" }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Presupuesto base de licitación</span>
              <span className="mono" style={{ fontSize: 23, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{window.fmtEur(total)}</span>
            </div>
          </div>
        </div>

        {/* observaciones */}
        <div style={{ marginTop: 16, borderRadius: 12, border: "1px solid var(--border-main)", background: "var(--bg-surface)", padding: compact ? "14px 16px" : "18px 22px", boxShadow: "var(--shadow-panel)" }}>
          <div className="sec-head" style={{ marginBottom: 10 }}>Observaciones y notas</div>
          <textarea value={notes} onChange={(e) => onNotes(e.target.value)}
            placeholder="Condiciones, plazos, notas de la propiedad, exclusiones, criterios de revisión de precios…"
            style={{ width: "100%", minHeight: 130, resize: "vertical", borderRadius: 8, padding: "11px 13px", outline: "none",
              fontSize: 13, lineHeight: 1.6, color: "var(--text-primary)", background: "var(--bg-primary)",
              border: "1px solid var(--border-main)", fontFamily: "inherit", boxSizing: "border-box" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--accent) 22%, transparent)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-main)"; e.currentTarget.style.boxShadow = "none"; }} />
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

window.MedResumen = { ResumenView };

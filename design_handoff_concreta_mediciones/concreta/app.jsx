/* ===========================================================================
   Concreta · Mediciones — App (chrome Concreta: topbar, tabs, status, tema)
   =========================================================================== */
const { Icon: ApIcon, ICONS: AP } = window.MedIcons;
const { GhostBtn } = window.MedUI;
const { Sidebar } = window.MedSidebar;
const { Partidas } = window.MedTable;
const { CertificacionesView } = window.MedCert;
const { ReferencePanel } = window.MedRef;
const useBreakpoint = window.useBreakpoint;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "accent": "#0284c7",
  "density": "regular",
  "showChapterTotals": true,
  "showBars": true,
  "dotGrid": false
}/*EDITMODE-END*/;

/* ---------- Botón de exportar (abre el modal de listados) --------------- */
function ExportButton({ onExport, compact }) {
  return (
    <button onClick={onExport} className="t150" title="Exportar listados"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
        height: 32, width: compact ? 36 : "auto", padding: compact ? 0 : "0 13px", borderRadius: 6,
        fontSize: 12.5, fontWeight: 600, color: "var(--on-accent)", background: "var(--accent)", border: 0, cursor: "pointer", fontFamily: "inherit" }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-hover)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "var(--accent)"}>
      <ApIcon d={AP.download} size={compact ? 16 : 14} />
      {!compact && "Exportar"}
    </button>
  );
}

/* ---------- Modal de exportación: elige listado y formato ---------------- */
const FORMAT_META = {
  PDF: { label: "PDF", color: "var(--state-warn)" },
  DOCX: { label: "Word", color: "var(--accent)" },
  RTF: { label: "RTF", color: "var(--state-neutral)" },
  XLSX: { label: "Excel", color: "var(--state-ok)" },
  BC3: { label: "BC3", color: "var(--state-mq)" },
};
const LISTADOS = [
  ["Presupuesto y mediciones", "Documento completo con descomposición de precios", "doc", ["PDF", "DOCX", "XLSX"]],
  ["Cuadro de precios nº 1", "Precios unitarios en letra y cifra", "list", ["PDF", "DOCX", "XLSX"]],
  ["Cuadro de precios nº 2", "Precios descompuestos por partida", "list", ["PDF", "DOCX", "XLSX"]],
  ["Resumen de presupuesto", "Importes y porcentajes por capítulo", "list", ["PDF", "DOCX", "XLSX"]],
  ["Justificación de precios", "Mano de obra, maquinaria y materiales", "doc", ["PDF", "DOCX", "XLSX"]],
  ["Mediciones detalladas", "Líneas de medición por partida", "list", ["PDF", "DOCX", "XLSX"]],
];
function ExportModal({ open, onClose, onExportPdf, compact, certs }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const doExport = (listado, fmt) => { onClose(); if (fmt === "PDF") onExportPdf(); };
  return (
    <div className="no-print" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(3,8,20,.5)",
      display: "flex", alignItems: compact ? "flex-end" : "center", justifyContent: "center", padding: compact ? 0 : 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: compact ? "100%" : 560, maxHeight: compact ? "88vh" : "84vh", display: "flex", flexDirection: "column",
        background: "var(--bg-surface)", border: "1px solid var(--border-main)", borderRadius: compact ? "16px 16px 0 0" : 14, boxShadow: "var(--shadow-float)", overflow: "hidden" }}>
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "15px 18px", borderBottom: "1px solid var(--border-main)" }}>
          <span style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 8, background: "var(--accent-soft)", color: "var(--accent)" }}>
            <ApIcon d={AP.download} size={17} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Exportar</div>
            <div style={{ fontSize: 12, color: "var(--text-disabled)" }}>Elige el listado y el formato</div>
          </div>
          <button onClick={() => doExport("BC3 obra completa", "BC3")} title="Exportar toda la obra a BC3 (FIEBDC-3)" className="t150"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 32, padding: "0 12px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
              border: "1px solid color-mix(in srgb, var(--state-mq) 45%, var(--border-main))", background: "color-mix(in srgb, var(--state-mq) 12%, transparent)", color: "var(--state-mq)", fontSize: 12, fontWeight: 600 }}
            onMouseEnter={(e) => e.currentTarget.style.background = "color-mix(in srgb, var(--state-mq) 20%, transparent)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "color-mix(in srgb, var(--state-mq) 12%, transparent)"}>
            <ApIcon d={AP.layers} size={14} /> {compact ? "BC3" : "BC3 · obra completa"}
          </button>
          <button onClick={onClose} className="tcol icon-btn" style={{ width: 30, height: 30 }}><ApIcon d={AP.x} size={17} /></button>
        </div>
        <div className="scroll-thin" style={{ overflowY: "auto", padding: 8 }}>
          {LISTADOS.map(([name, desc, icon, fmts], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 10px", borderRadius: 9, borderBottom: i < LISTADOS.length - 1 ? "1px solid var(--border-sub)" : 0 }}>
              <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
                <ApIcon d={AP[icon]} size={17} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{name}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-disabled)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{desc}</div>
              </div>
              <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                {fmts.map((f) => {
                  const m = FORMAT_META[f];
                  return (
                    <button key={f} onClick={() => doExport(name, f)} title={"Exportar a " + m.label} className="tcol fmt-chip"
                      style={{ display: "inline-flex", alignItems: "center", height: 26, padding: "0 9px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                        border: "1px solid var(--border-main)", background: "transparent", fontSize: 11, fontWeight: 600,
                        color: "var(--text-secondary)", "--chip": m.color }}>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {/* certificaciones generadas: una opción por cada una */}
          {certs && certs.length > 0 && (
            <React.Fragment>
              <div className="sec-head" style={{ padding: "12px 10px 6px" }}>Certificaciones de obra</div>
              {certs.map((c, i) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 10px", borderRadius: 9, borderBottom: i < certs.length - 1 ? "1px solid var(--border-sub)" : 0 }}>
                  <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: "var(--accent-soft)", color: "var(--accent)" }}>
                    <ApIcon d={AP.clipboardCheck} size={17} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>Certificación nº {c.num}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-disabled)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.period} · certificación a origen</div>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    {["PDF", "DOCX", "XLSX"].map((f) => {
                      const m = FORMAT_META[f];
                      return (
                        <button key={f} onClick={() => doExport("Certificación nº " + c.num, f)} title={"Exportar a " + m.label} className="tcol fmt-chip"
                          style={{ display: "inline-flex", alignItems: "center", height: 26, padding: "0 9px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                            border: "1px solid var(--border-main)", background: "transparent", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", "--chip": m.color }}>
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </React.Fragment>
          )}
        </div>
        <div style={{ flexShrink: 0, padding: "11px 18px", borderTop: "1px solid var(--border-main)", background: "var(--bg-elevated)", fontSize: 11.5, color: "var(--text-disabled)" }}>
          PDF imprimible al instante · Word, Excel y BC3 (FIEBDC-3) generan el archivo descargable.
        </div>
      </div>
    </div>
  );
}

/* ---------- Modal: datos generales de la obra --------------------------- */
const OBRA_SECTIONS = [
  ["Obra", "building", [["denominacion", "Denominación", true], ["direccion", "Emplazamiento", true], ["localidad", "Localidad"], ["provincia", "Provincia"], ["refCatastral", "Ref. catastral"], ["expediente", "Expediente nº"]]],
  ["Promotor (Propiedad)", "idcard", [["promotor.nombre", "Nombre / razón social", true], ["promotor.nif", "NIF / CIF"], ["promotor.telefono", "Teléfono"], ["promotor.email", "Email"], ["promotor.direccion", "Dirección", true]]],
  ["Empresa constructora", "hardhat", [["constructor.nombre", "Empresa", true], ["constructor.cif", "CIF"], ["constructor.jefe", "Jefe de obra"], ["constructor.telefono", "Teléfono"], ["constructor.direccion", "Dirección", true]]],
  ["Dirección facultativa", "compass", [["redactor.nombre", "Técnico redactor"], ["redactor.colegiado", "Nº colegiado"], ["lugar", "Lugar de firma"], ["fecha", "Fecha del documento"]]],
];
function ObraModal({ open, onClose, obra, onChange, compact }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const get = (path) => path.split(".").reduce((o, k) => (o ? o[k] : ""), obra) || "";
  const Field = ({ path, label, full }) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: full ? "1 / -1" : "auto", minWidth: 0 }}>
      <span className="caps" style={{ fontSize: 9, fontWeight: 600, color: "var(--text-disabled)" }}>{label}</span>
      <input value={get(path)} onChange={(e) => onChange(path, e.target.value)}
        style={{ height: 34, borderRadius: 7, padding: "0 10px", outline: "none", fontSize: 13, color: "var(--text-primary)",
          background: "var(--bg-primary)", border: "1px solid var(--border-main)", fontFamily: "inherit", boxSizing: "border-box", width: "100%" }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-main)"; e.currentTarget.style.boxShadow = "none"; }} />
    </label>
  );
  return (
    <div className="no-print" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(3,8,20,.5)",
      display: "flex", alignItems: compact ? "flex-end" : "center", justifyContent: "center", padding: compact ? 0 : 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: compact ? "100%" : 620, maxHeight: compact ? "92vh" : "86vh", display: "flex", flexDirection: "column",
        background: "var(--bg-surface)", border: "1px solid var(--border-main)", borderRadius: compact ? "16px 16px 0 0" : 14, boxShadow: "var(--shadow-float)", overflow: "hidden" }}>
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "15px 18px", borderBottom: "1px solid var(--border-main)" }}>
          <span style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 8, background: "var(--accent-soft)", color: "var(--accent)" }}>
            <ApIcon d={AP.building} size={17} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Datos de la obra</div>
            <div style={{ fontSize: 12, color: "var(--text-disabled)" }}>Personalizan los documentos exportados</div>
          </div>
          <button onClick={onClose} className="tcol icon-btn" style={{ width: 30, height: 30 }}><ApIcon d={AP.x} size={17} /></button>
        </div>
        <div className="scroll-thin" style={{ overflowY: "auto", padding: compact ? "14px 16px" : "18px 22px" }}>
          {OBRA_SECTIONS.map(([title, icon, fields], si) => (
            <div key={si} style={{ marginBottom: si < OBRA_SECTIONS.length - 1 ? 20 : 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
                <ApIcon d={AP[icon]} size={15} style={{ color: "var(--accent)" }} />
                <span className="sec-head" style={{ color: "var(--text-secondary)" }}>{title}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: 11 }}>
                {fields.map(([path, label, full]) => <Field key={path} path={path} label={label} full={full && !compact} />)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ flexShrink: 0, display: "flex", justifyContent: "flex-end", gap: 8, padding: "11px 18px", borderTop: "1px solid var(--border-main)", background: "var(--bg-elevated)" }}>
          <button onClick={onClose} className="t150"
            style={{ height: 34, padding: "0 16px", borderRadius: 7, border: 0, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--on-accent)", background: "var(--accent)", fontFamily: "inherit" }}>
            Hecho
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Barra superior (lockup de marca Concreta) -------------------- */
function TopBar({ view, onView, onExport, theme, onToggleTheme, bp, onMenu, refOpen, onToggleRef, onObra, obraName }) {
  const { isMobile, isCompact } = bp;
  const tabs = [
    { k: "import", label: "Importar" },
    { k: "presupuesto", label: "Presupuesto" },
    { k: "resumen", label: "Resumen" },
    { k: "certificaciones", label: "Certificaciones" },
  ];
  const sep = <span style={{ width: 1, height: 18, background: "var(--border-main)", margin: "0 4px" }} />;
  return (
    <header style={{ height: 48, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: isMobile ? "0 10px" : "0 14px", gap: 8, background: "var(--bg-surface)", borderBottom: "1px solid var(--border-main)" }}>
      {/* marca */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, flex: isMobile ? 1 : "0 1 auto" }}>
        {isCompact && (
          <button onClick={onMenu} title="Capítulos" className="tcol icon-btn" style={{ marginLeft: -4, flexShrink: 0 }}>
            <ApIcon d={AP.menu} size={18} />
          </button>
        )}
        <img src="public/favicon.svg" width="21" height="21" style={{ borderRadius: 5, flexShrink: 0 }} alt="" />
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>Concreta</span>
        {!isMobile && sep}
        <span className="mono caps hide-md" style={{ fontSize: 11, color: "var(--text-disabled)" }}>Mediciones</span>
        <span className="hide-sm" style={{ color: "var(--text-disabled)" }}>/</span>
        <span className="hide-sm" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Presupuesto</span>
        <span style={{ color: "var(--text-disabled)", fontSize: 13 }} className="hide-lg">·</span>
        <button onClick={onObra} title="Datos de la obra" className="tcol hide-lg"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, border: 0, background: "transparent", cursor: "pointer", padding: "2px 6px", borderRadius: 5, fontFamily: "inherit",
            fontSize: 13, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}>
          {obraName}<ApIcon d={AP.pencil} size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
        </button>
      </div>

      {/* tabs centrales (oculto en móvil → barra inferior) */}
      {!isMobile && (
        <nav style={{ display: "flex", alignItems: "stretch", height: "100%", gap: 2 }}>
          {tabs.map((t) => {
            const active = view === t.k;
            return (
              <button key={t.k} onClick={() => onView(t.k)} className="tcol"
                style={{ position: "relative", background: "none", border: 0, cursor: "pointer", padding: "0 13px",
                  fontSize: 13, fontWeight: 500, height: 48, fontFamily: "inherit", whiteSpace: "nowrap",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)" }}>
                {t.label}
                {active && <span style={{ position: "absolute", left: 10, right: 10, bottom: 0, height: 2, background: "var(--accent)", borderRadius: "2px 2px 0 0" }} />}
              </button>
            );
          })}
        </nav>
      )}

      {/* acciones */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", flexShrink: 0 }}>
        <button title="Datos de la obra" onClick={onObra} className="tcol icon-btn">
          <ApIcon d={AP.building} size={16} />
        </button>
        <button title={theme === "dark" ? "Modo claro" : "Modo oscuro"} onClick={onToggleTheme} className="tcol icon-btn">
          <ApIcon d={theme === "dark" ? AP.sun : AP.moon} size={15} />
        </button>
        {isMobile ? (
          <button onClick={onToggleRef} title="Modo referencia" className="tcol icon-btn"
            style={{ background: refOpen ? "var(--accent-soft)" : undefined, color: refOpen ? "var(--accent)" : undefined }}>
            <ApIcon d={AP.split} size={16} />
          </button>
        ) : (
          <button onClick={onToggleRef} title="Abrir base de precios u otro presupuesto" className="tcol"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 11px", borderRadius: 6, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 500,
              background: refOpen ? "var(--accent-soft)" : "transparent", color: refOpen ? "var(--accent)" : "var(--text-secondary)" }}
            onMouseEnter={(e) => { if (!refOpen) { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; } }}
            onMouseLeave={(e) => { if (!refOpen) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; } }}>
            <ApIcon d={AP.split} size={15} /> Referencia
          </button>
        )}
        {!isMobile && sep}
        <ExportButton onExport={onExport} compact={isMobile} />
      </div>
    </header>
  );
}

/* ---------- Barra de pestañas inferior (móvil) --------------------------- */
function BottomTabBar({ view, onView }) {
  const tabs = [
    { k: "import", label: "Importar", icon: "upload" },
    { k: "presupuesto", label: "Presup.", icon: "list" },
    { k: "resumen", label: "Resumen", icon: "grid" },
    { k: "certificaciones", label: "Certif.", icon: "clipboardCheck" },
  ];
  return (
    <nav className="no-print" style={{ flexShrink: 0, display: "flex", borderTop: "1px solid var(--border-main)",
      background: "var(--bg-surface)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {tabs.map((t) => {
        const active = view === t.k;
        return (
          <button key={t.k} onClick={() => onView(t.k)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
              height: 54, border: 0, cursor: "pointer", background: "transparent", fontFamily: "inherit",
              color: active ? "var(--accent)" : "var(--text-disabled)" }}>
            <ApIcon d={AP[t.icon]} size={19} sw={active ? 2 : 1.7} />
            <span style={{ fontSize: 10.5, fontWeight: active ? 600 : 500 }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ---------- Barra de estado inferior (24px, mono) ------------------------ */
function StatusBar({ counts, pem, pec }) {
  const dim = { color: "var(--text-disabled)" };
  return (
    <footer className="mono no-print" style={{ height: 24, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 14px", background: "var(--bg-surface)", borderTop: "1px solid var(--border-main)", fontSize: 11, color: "var(--text-secondary)" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span><span style={{ color: "var(--text-primary)" }}>{counts.chapters}</span> capítulos</span>
        <span style={dim}>·</span>
        <span><span style={{ color: "var(--text-primary)" }}>{counts.partidas}</span> partidas</span>
        <span style={dim}>·</span>
        <span><span style={{ color: "var(--text-primary)" }}>{counts.lineas}</span> líneas de medición</span>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", ...dim }}>
        <span><span style={{ color: "var(--text-secondary)" }}>PEM</span> {window.fmtEur(pem)}</span>
        <span>·</span>
        <span><span style={{ color: "var(--text-secondary)" }}>PEC</span> {window.fmtEur(pec)}</span>
      </div>
    </footer>
  );
}

/* ---------- Cabecera del panel de capítulo ------------------------------- */
function ChapterHeader({ chapter, importe, count, pem, compact }) {
  const pct = pem ? (importe / pem) * 100 : 0;
  return (
    <div style={{ padding: compact ? "13px 16px 12px" : "18px 24px 16px", borderBottom: "1px solid var(--border-main)", background: "var(--bg-surface)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: compact ? 12 : 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, flexWrap: "wrap" }}>
            <span className="mono" style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-main)" }}>{chapter.code}</span>
            <span style={{ fontSize: 12, color: "var(--text-disabled)" }}>{count} {count === 1 ? "partida" : "partidas"}</span>
            <span style={{ color: "var(--border-main)" }}>·</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--text-disabled)" }}>{window.fmtNum(pct, 1)}% del PEM</span>
          </div>
          <h1 style={{ fontSize: compact ? 18 : 23, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1.15, margin: 0, textWrap: "balance" }}>{chapter.title}</h1>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className="caps" style={{ fontSize: 10, fontWeight: 600, color: "var(--text-disabled)", whiteSpace: "nowrap" }}>Importe</div>
          <div className="mono" style={{ fontSize: compact ? 19 : 25, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1, marginTop: 6 }}>{window.fmtEur(importe)}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Estado vacío -------------------------------------------------- */
function EmptyChapter({ chapter, onAddPartida }) {
  return (
    <div className="dot-grid" style={{ flex: 1, display: "grid", placeItems: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 320 }}>
        <div style={{ margin: "0 auto 12px", width: 48, height: 48, borderRadius: 12, background: "var(--bg-elevated)", border: "1px solid var(--border-main)", display: "grid", placeItems: "center", color: "var(--text-disabled)" }}>
          <ApIcon d={AP.folder} size={24} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>Capítulo sin partidas</div>
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>
          «{chapter.title}» aún no tiene partidas medidas. Añade la primera partida o crea un subcapítulo desde el árbol.
        </p>
        <button onClick={() => onAddPartida(chapter.id, null)}
          style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 6, fontSize: 13, fontWeight: 500, border: 0, cursor: "pointer", color: "var(--on-accent)", background: "var(--accent)", fontFamily: "inherit" }}>
          <ApIcon d={AP.plus} size={15} /> Añadir partida
        </button>
      </div>
    </div>
  );
}

/* ---------- Vista: Toda la obra ------------------------------------------ */
function AllChapters({ chapters, partidas, chapterTotals, pem, density, expandedRows, onToggleRow, onEdit, onMed, showBars, onAddPartida, compact, recursos, usage, onRec, onPart }) {
  const ggbi = window.round2(pem * window.GGBI_RATE);
  const total = window.round2((pem + ggbi) * (1 + window.IVA_RATE));
  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <div style={{ padding: compact ? "13px 16px 12px" : "18px 24px 16px", borderBottom: "1px solid var(--border-main)", background: "var(--bg-surface)", position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: compact ? 12 : 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <span className="mono caps" style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 4, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-main)" }}>Obra completa</span>
            <span style={{ fontSize: 12, color: "var(--text-disabled)" }}>{chapters.length} capítulos</span>
          </div>
          <h1 style={{ fontSize: compact ? 18 : 23, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1.15, margin: 0 }}>Reforma vivienda C/ Mayor 14</h1>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className="caps" style={{ fontSize: 10, fontWeight: 600, color: "var(--text-disabled)", whiteSpace: "nowrap" }}>{compact ? "Total c/ IVA" : "PEM · Total c/ IVA"}</div>
          {!compact && <div className="mono" style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>{window.fmtEur(pem)}</div>}
          <div className="mono" style={{ fontSize: compact ? 19 : 25, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1, marginTop: compact ? 5 : 0 }}>{window.fmtEur(total)}</div>
        </div>
      </div>
      {chapters.map((ch) => {
        const ps = partidas[ch.id] || [];
        const imp = chapterTotals[ch.id] || 0;
        const pct = pem ? (imp / pem) * 100 : 0;
        return (
          <section key={ch.id} data-screen-label={"Capítulo " + ch.code}>
            <div style={{ padding: compact ? "9px 16px" : "10px 24px", background: "var(--bg-elevated)", borderTop: "1px solid var(--border-main)", borderBottom: "1px solid var(--border-main)", display: "flex", alignItems: "center", gap: 12 }}>
              <span className="mono" style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: "var(--bg-surface)", border: "1px solid var(--border-main)", color: "var(--text-secondary)", flexShrink: 0 }}>{ch.code}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.title}</span>
              {!compact && <span style={{ fontSize: 12, color: "var(--text-disabled)", flexShrink: 0 }}>{ps.length} {ps.length === 1 ? "partida" : "partidas"}</span>}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                {!compact && <span className="mono" style={{ fontSize: 11, color: "var(--text-disabled)" }}>{window.fmtNum(pct, 1)}% PEM</span>}
                <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{window.fmtEur(imp)}</span>
              </div>
            </div>
            {ps.length > 0 ? (
              <Partidas compact={compact} chapter={ch} chapterId={ch.id} partidas={ps} density={density}
                expandedRows={expandedRows} onToggleRow={onToggleRow} onEdit={onEdit} onMed={onMed}
                chapterTotal={imp} showBars={showBars} sticky={false} onAddPartida={onAddPartida}
                recursos={recursos} usage={usage} onRec={onRec} chaptersAll={chapters} onPart={onPart} />
            ) : (
              <div style={{ padding: compact ? "10px 16px" : "10px 24px", borderBottom: "1px solid var(--border-sub)" }}>
                <button onClick={() => onAddPartida(ch.id, null)} className="tcol add-partida"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 8px", borderRadius: 5, fontSize: 12, fontWeight: 500, border: 0, cursor: "pointer", background: "transparent", color: "var(--text-disabled)", fontFamily: "inherit" }}>
                  <ApIcon d={AP.plus} size={13} /> Añadir primera partida
                </button>
              </div>
            )}
          </section>
        );
      })}
      <div style={{ height: 56 }} />
    </div>
  );
}

/* ---------- Vista: Listados ---------------------------------------------- */
function ListadosView({ compact }) {
  const listados = [
    ["Presupuesto y mediciones", "Documento completo con descomposición de precios", "doc"],
    ["Cuadro de precios nº 1", "Precios unitarios en letra y cifra", "list"],
    ["Cuadro de precios nº 2", "Precios descompuestos por partida", "list"],
    ["Resumen por capítulos", "Importes y porcentajes sobre el PEM", "list"],
    ["Justificación de precios", "Mano de obra, maquinaria y materiales", "doc"],
    ["Mediciones detalladas", "Líneas de medición por partida", "list"],
  ];
  return (
    <div className="dot-grid" style={{ flex: 1, overflowY: "auto", padding: compact ? 16 : 24 }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px" }}>Listados</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 20px" }}>Genera la documentación del proyecto en PDF o Excel.</p>
        <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: 12 }}>
          {listados.map(([t, d, ic], i) => (
            <button key={i} className="t150 listado-card"
              style={{ textAlign: "left", borderRadius: 9, border: "1px solid var(--border-main)", background: "var(--bg-surface)", padding: 16, cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 8, background: "var(--bg-elevated)", display: "grid", placeItems: "center", color: "var(--text-secondary)" }}>
                  <ApIcon d={AP[ic]} size={18} />
                </span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{t}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.4 }}>{d}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Vista: Importar ---------------------------------------------- */
function ImportView({ compact }) {
  return (
    <div className="dot-grid" style={{ flex: 1, overflowY: "auto", padding: compact ? 16 : 24 }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px" }}>Importar BC3</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 20px" }}>Formato estándar de intercambio FIEBDC-3 (.bc3) de bancos de precios y presupuestos.</p>
        <div style={{ borderRadius: 12, border: "2px dashed var(--border-main)", background: "var(--bg-surface)", padding: compact ? "28px 18px" : 40, textAlign: "center" }}>
          <div style={{ margin: "0 auto 16px", width: 56, height: 56, borderRadius: 16, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
            <ApIcon d={AP.upload} size={26} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>Arrastra aquí tu archivo .bc3</div>
          <div style={{ fontSize: 12.5, color: "var(--text-disabled)", marginTop: 4 }}>o</div>
          <button style={{ marginTop: 12, display: "inline-flex", alignItems: "center", height: 36, padding: "0 16px", borderRadius: 6, fontSize: 13, fontWeight: 600, border: 0, cursor: "pointer", color: "var(--on-accent)", background: "var(--accent)", fontFamily: "inherit" }}>Seleccionar archivo</button>
          <div style={{ fontSize: 11.5, color: "var(--text-disabled)", marginTop: 16 }}>Compatible con Presto, Arquímedes, Generador de Precios CYPE y bancos BDC autonómicos.</div>
        </div>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr 1fr", gap: 12, textAlign: "center" }}>
          {[["Base BDT Andalucía", "2024"], ["BPC Cataluña ITeC", "2025"], ["Generador CYPE", "2025"]].map(([t, y], i) => (
            <div key={i} style={{ borderRadius: 8, border: "1px solid var(--border-main)", background: "var(--bg-surface)", padding: "12px 0" }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)" }}>{t}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 2 }}>{y}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- App ----------------------------------------------------------- */
function App() {
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = useState("presupuesto");
  const [active, setActive] = useState("01");
  const [expanded, setExpanded] = useState({ "01": true });
  const [expandedRows, setExpandedRows] = useState({ p111: true });
  const [partidas, setPartidas] = useState(() => JSON.parse(JSON.stringify(window.PARTIDAS)));
  const [chapters, setChapters] = useState(() => JSON.parse(JSON.stringify(window.CHAPTERS)));
  const [recursos, setRecursos] = useState(() => window.buildRecursos(window.PARTIDAS));
  const usage = useMemo(() => window.recursoUsage(partidas), [partidas]);
  // Banco de recursos compartido: editar un concepto (por código) afecta a todas las partidas.
  function editRecurso(code, field, value) {
    setRecursos((prev) => ({ ...prev, [code]: { ...(prev[code] || {}), [field]: value } }));
  }
  function recEditRend(chapterId, pid, idx, value) {
    setPartidas((prev) => {
      const next = { ...prev };
      next[chapterId] = (next[chapterId] || []).map((p) => p.id !== pid ? p
        : { ...p, fromBase: false, items: (p.items || []).map((it, i) => i === idx ? { ...it, cantidad: value } : it) });
      return next;
    });
  }
  function recDel(chapterId, pid, idx) {
    setPartidas((prev) => {
      const next = { ...prev };
      next[chapterId] = (next[chapterId] || []).map((p) => p.id !== pid ? p
        : { ...p, fromBase: false, items: (p.items || []).filter((_, i) => i !== idx) });
      return next;
    });
  }
  function recAdd(chapterId, pid) {
    const code = "r" + Date.now().toString().slice(-7);
    setRecursos((prev) => ({ ...prev, [code]: { type: "MAT", desc: "", ud: "ud", precio: 0 } }));
    setPartidas((prev) => {
      const next = { ...prev };
      next[chapterId] = (next[chapterId] || []).map((p) => p.id !== pid ? p
        : { ...p, fromBase: false, items: [...(p.items || []), { code, type: "MAT", cantidad: 1 }] });
      return next;
    });
  }
  const onRec = { editRecurso, editRend: recEditRend, del: recDel, add: recAdd };

  // ---- borrar / mover partidas, capítulos y subcapítulos ----
  function renumberChapter(ch, list) {
    const counts = {};
    return list.map((p) => {
      const key = p.sub || "_";
      counts[key] = (counts[key] || 0) + 1;
      const sub = ch && ch.children && p.sub ? ch.children.find((s) => s.id === p.sub) : null;
      const base = sub ? sub.code : (ch ? ch.code : "");
      return { ...p, pos: base + "." + counts[key] };
    });
  }
  function deletePartida(chId, pid) {
    setPartidas((prev) => {
      const ch = chapters.find((c) => c.id === chId);
      const list = (prev[chId] || []).filter((p) => p.id !== pid);
      return { ...prev, [chId]: ch ? renumberChapter(ch, list) : list };
    });
  }
  function movePartida(fromCh, pid, toCh, toSub) {
    setPartidas((prev) => {
      const moving = (prev[fromCh] || []).find((p) => p.id === pid);
      if (!moving) return prev;
      const fromList = (prev[fromCh] || []).filter((p) => p.id !== pid);
      const updated = { ...moving, sub: toSub || undefined, fromBase: false };
      const next = { ...prev };
      const chFrom = chapters.find((c) => c.id === fromCh);
      const chTo = chapters.find((c) => c.id === toCh);
      if (fromCh === toCh) {
        next[toCh] = renumberChapter(chTo, [...fromList, updated]);
      } else {
        next[fromCh] = renumberChapter(chFrom, fromList);
        next[toCh] = renumberChapter(chTo, [...(prev[toCh] || []), updated]);
      }
      return next;
    });
    setExpanded((e) => ({ ...e, [toCh]: true }));
  }
  function deleteChapter(chId) {
    const ch = chapters.find((c) => c.id === chId);
    const affectsActive = active === chId || (ch && ch.children && ch.children.some((s) => s.id === active));
    setChapters((chs) => chs.filter((c) => c.id !== chId));
    setPartidas((prev) => { const n = { ...prev }; delete n[chId]; return n; });
    if (affectsActive) setActive("__ALL__");
  }
  function deleteSubchapter(chId, subId) {
    setChapters((chs) => chs.map((c) => c.id === chId ? { ...c, children: (c.children || []).filter((s) => s.id !== subId) } : c));
    setPartidas((prev) => {
      const ch = chapters.find((c) => c.id === chId);
      const list = (prev[chId] || []).map((p) => p.sub === subId ? { ...p, sub: undefined } : p);
      const newCh = ch ? { ...ch, children: (ch.children || []).filter((s) => s.id !== subId) } : ch;
      return { ...prev, [chId]: newCh ? renumberChapter(newCh, list) : list };
    });
    if (active === subId) setActive(chId);
  }
  const onPart = { del: deletePartida, move: movePartida };

  // ---- Modo Referencia (split) ----
  const [refOpen, setRefOpen] = useState(false);
  const [refSourceId, setRefSourceId] = useState(() => (window.REF_SOURCES[0] || {}).id);
  const [refWidth, setRefWidth] = useState(400);

  // destino de copia: capítulo/subcapítulo activo
  const copyTarget = useMemo(() => {
    if (active !== "__ALL__") {
      for (const ch of chapters) {
        if (ch.id === active) return { chId: ch.id, subId: null, label: ch.code + " · " + ch.title };
        if (ch.children) for (const s of ch.children) if (s.id === active) return { chId: ch.id, subId: s.id, label: s.code + " · " + s.title };
      }
    }
    const c = chapters[0] || { id: null, code: "", title: "" };
    return { chId: c.id, subId: null, label: c.code + " · " + c.title };
  }, [active, chapters]);

  function copyRefItems(items, dropChId, dropSubId, contra) {
    if (!items || !items.length) return;
    const chId = dropChId || copyTarget.chId;
    const subId = dropChId !== undefined && dropChId !== null ? (dropSubId || null) : copyTarget.subId;
    if (!chId) return;
    // 1) recursos al banco (sin pisar los existentes → coherencia)
    setRecursos((prev) => {
      const next = { ...prev };
      for (const it of items) for (const r of it.partida.items || []) {
        if (r.type === "%CI") continue;
        if (!next[r.code]) next[r.code] = { type: r.type, desc: r.desc, ud: r.ud, precio: r.precio };
      }
      return next;
    });
    // 2) partidas nuevas (marcadas fromBase)
    setPartidas((prev) => {
      const next = { ...prev };
      const list = [...(next[chId] || [])];
      const ch = chapters.find((c) => c.id === chId);
      const sub = subId && ch && ch.children ? ch.children.find((s) => s.id === subId) : null;
      const posBase = sub ? sub.code : (ch ? ch.code : chId);
      items.forEach((it, idx) => {
        const p = it.partida;
        const sameSub = list.filter((x) => (subId ? x.sub === subId : !x.sub)).length;
        const items2 = (p.items || []).map((r) => r.type === "%CI"
          ? { code: "%CI", type: "%CI", cantidad: r.cantidad }
          : { code: r.code, type: r.type, cantidad: r.cantidad });
        list.push({ id: "p" + Date.now() + "_" + idx, sub: subId || undefined,
          pos: posBase + "." + (sameSub + 1), code: p.code, title: p.title, ud: p.ud, precio: p.precio,
          mainType: p.mainType, desc: (window.REF_DESC && window.REF_DESC[p.code]) || p.desc || "", med: [], items: items2,
          fromBase: !contra, contradictorio: !!contra, baseSource: it.sourceName });
      });
      next[chId] = list;
      return next;
    });
    setExpanded((e) => ({ ...e, [chId]: true }));
  }

  // redimensionar el panel de referencia
  function startResize(e) {
    e.preventDefault();
    const onMove = (ev) => {
      const x = ev.clientX != null ? ev.clientX : (ev.touches && ev.touches[0] ? ev.touches[0].clientX : 0);
      setRefWidth(Math.max(320, Math.min(640, window.innerWidth - x)));
    };
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  const [certs, setCerts] = useState(() => window.makeCertsInit(window.PARTIDAS));
  const [curCert, setCurCert] = useState(() => window.makeCertsInit(window.PARTIDAS).length - 1);
  function onCertEdit(pid, value) {
    setCerts((prev) => prev.map((c, i) => i === curCert ? { ...c, data: { ...c.data, [pid]: value } } : c));
  }
  function onCertField(field, value) {
    setCerts((prev) => prev.map((c, i) => i === curCert ? { ...c, [field]: value } : c));
  }
  function onAddCert() {
    setCerts((prev) => {
      const last = prev[prev.length - 1];
      const num = prev.reduce((m, c) => Math.max(m, parseInt(c.num, 10) || 0), 0) + 1;
      const nueva = { id: "c" + Date.now(), num, period: "Nueva certificación", retencion: last ? last.retencion : 0.05, data: { ...(last ? last.data : {}) } };
      return [...prev, nueva];
    });
    setCurCert((prev) => certs.length); // nueva queda al final
  }

  // tema + acento + dot-grid → tokens
  useEffect(() => { document.documentElement.setAttribute("data-theme", t.theme); }, [t.theme]);
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", t.accent);
  }, [t.accent]);

  const chapterTotals = useMemo(() => {
    const out = {};
    for (const id in partidas) out[id] = partidas[id].reduce((s, p) => s + window.partidaImporte(p), 0);
    return out;
  }, [partidas]);

  const pem = useMemo(() => {
    let sum = window.BASE_PEM;
    for (const id in chapterTotals) sum += chapterTotals[id];
    return window.round2(sum);
  }, [chapterTotals]);
  const pec = useMemo(() => window.round2(pem * (1 + window.GGBI_RATE)), [pem]);

  const counts = useMemo(() => {
    let np = 0, nl = 0;
    for (const id in partidas) {
      np += partidas[id].length;
      for (const p of partidas[id]) nl += (p.med ? p.med.length : 0);
    }
    return { chapters: chapters.length, partidas: np, lineas: nl };
  }, [partidas, chapters]);

  const activeChapter = useMemo(() => {
    for (const ch of chapters) {
      if (ch.id === active) return ch;
      if (ch.children) for (const c of ch.children) if (c.id === active) return ch;
    }
    return chapters[0];
  }, [active, chapters]);

  const activePartidas = partidas[activeChapter.id] || [];

  function onSelect(id) {
    setActive(id);
    setView("presupuesto");
    if (id === "__ALL__") return;
    const ch = chapters.find((c) => c.id === id);
    if (ch && ch.children && ch.children.length) setExpanded((e) => ({ ...e, [id]: true }));
  }
  function onToggle(id, force) { setExpanded((e) => ({ ...e, [id]: force !== undefined ? force : !e[id] })); }
  function onToggleRow(id) { setExpandedRows((r) => ({ ...r, [id]: !r[id] })); }
  function onEdit(chapterId, pid, field, value) {
    setPartidas((prev) => {
      const next = { ...prev };
      next[chapterId] = (next[chapterId] || []).map((p) => p.id === pid ? { ...p, fromBase: false, [field]: value } : p);
      return next;
    });
  }

  // ---- edición de líneas de medición ----
  function medEdit(chapterId, pid, idx, field, value) {
    setPartidas((prev) => {
      const next = { ...prev };
      next[chapterId] = (next[chapterId] || []).map((p) => {
        if (p.id !== pid) return p;
        const med = (p.med || []).map((l, i) => i === idx ? { ...l, [field]: value } : l);
        return { ...p, fromBase: false, med };
      });
      return next;
    });
  }
  function medAdd(chapterId, pid) {
    setPartidas((prev) => {
      const next = { ...prev };
      next[chapterId] = (next[chapterId] || []).map((p) =>
        p.id === pid ? { ...p, fromBase: false, med: [...(p.med || []), { comment: "", uds: 1, largo: "", ancho: "", alto: "" }] } : p);
      return next;
    });
  }
  function medDel(chapterId, pid, idx) {
    setPartidas((prev) => {
      const next = { ...prev };
      next[chapterId] = (next[chapterId] || []).map((p) =>
        p.id === pid ? { ...p, fromBase: false, med: (p.med || []).filter((_, i) => i !== idx) } : p);
      return next;
    });
  }
  const medApi = { edit: medEdit, add: medAdd, del: medDel };

  function addChapter(title) {
    const num = chapters.reduce((m, c) => Math.max(m, parseInt(c.code, 10) || 0), 0) + 1;
    const code = String(num);
    const id = String(num).padStart(2, "0");
    setChapters((chs) => [...chs, { id, code, title, children: [] }]);
    setPartidas((p) => ({ ...p, [id]: [] }));
    setActive(id);
  }
  function addSubchapter(chapterId, title) {
    setChapters((chs) => chs.map((c) => {
      if (c.id !== chapterId) return c;
      const children = c.children || [];
      const n = children.reduce((m, s) => Math.max(m, parseInt(String(s.code).split(".")[1], 10) || 0), 0) + 1;
      const subCode = c.code + "." + n;
      const subId = c.id + "." + String(n).padStart(2, "0");
      return { ...c, children: [...children, { id: subId, code: subCode, title }] };
    }));
    setExpanded((e) => ({ ...e, [chapterId]: true }));
  }
  function addPartida(chapterId, subId) {
    const id = "p" + Date.now();
    setPartidas((prev) => {
      const list = prev[chapterId] || [];
      const sameSub = list.filter((p) => (subId ? p.sub === subId : !p.sub));
      const ch = chapters.find((c) => c.id === chapterId);
      const sub = subId && ch && ch.children ? ch.children.find((s) => s.id === subId) : null;
      const base = sub ? sub.code : (ch ? ch.code : chapterId);
      const pos = base + "." + (sameSub.length + 1);
      const nueva = { id, sub: subId || undefined, pos, code: "——", title: "", ud: "ud", precio: 0, desc: "", med: [], items: [] };
      return { ...prev, [chapterId]: [...list, nueva] };
    });
    setExpandedRows((r) => ({ ...r, [id]: true }));
  }
  // Precio contradictorio: partida no prevista en el presupuesto inicial.
  function addContradictorio(chapterId, subId) {
    const id = "pc" + Date.now();
    setPartidas((prev) => {
      const list = prev[chapterId] || [];
      const sameSub = list.filter((p) => (subId ? p.sub === subId : !p.sub));
      const ch = chapters.find((c) => c.id === chapterId);
      const sub = subId && ch && ch.children ? ch.children.find((s) => s.id === subId) : null;
      const base = sub ? sub.code : (ch ? ch.code : chapterId);
      const pos = "C" + base + "." + (sameSub.length + 1);
      const nueva = { id, sub: subId || undefined, pos, code: "P.C.", title: "", ud: "ud", cantidad: 0, precio: 0, desc: "", med: [], items: [], contradictorio: true };
      return { ...prev, [chapterId]: [...list, nueva] };
    });
    setExpandedRows((r) => ({ ...r, [id]: true }));
    return id;
  }

  const density = t.density;
  // IVA elegible desde la UI: reforma 10% / obra nueva 21%. Se aplica de forma
  // síncrona para que todos los componentes hijos lean el valor vigente.
  const [ivaRate, setIvaRate] = useState(0.10);
  const [ggRate, setGgRate] = useState(0.13);
  const [biRate, setBiRate] = useState(0.06);
  const [notes, setNotes] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [obraOpen, setObraOpen] = useState(false);
  const [obra, setObra] = useState({
    denominacion: "Reforma vivienda C/ Mayor 14", direccion: "Calle Mayor 14, 3º B", localidad: "Madrid", provincia: "Madrid",
    refCatastral: "1234567 VK4713C 0001 AB", expediente: "2026/047",
    promotor: { nombre: "Comunidad de Propietarios C/ Mayor 14", nif: "H-12345678", telefono: "600 123 456", email: "", direccion: "Calle Mayor 14, 28013 Madrid" },
    constructor: { nombre: "Construcciones Concreta S.L.", cif: "B-87654321", jefe: "Juan Pérez Gómez", telefono: "915 000 000", direccion: "Pol. Ind. Las Mercedes, nave 7, Madrid" },
    redactor: { nombre: "Arq. Ana López Ruiz", colegiado: "COAM 12.345" }, lugar: "Madrid", fecha: "Junio 2026",
  });
  function setObraPath(path, value) {
    setObra((prev) => {
      const keys = path.split(".");
      if (keys.length === 1) return { ...prev, [keys[0]]: value };
      return { ...prev, [keys[0]]: { ...prev[keys[0]], [keys[1]]: value } };
    });
  }
  window.IVA_RATE = ivaRate;
  window.GGBI_RATE = window.round2(ggRate + biRate);
  const toggleTheme = () => setTweak("theme", t.theme === "dark" ? "light" : "dark");
  const canvasBg = t.dotGrid ? "dot-grid" : "";
  const bp = useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => { if (bp.isDesktop) setDrawerOpen(false); }, [bp.isDesktop]);

  // ancho efectivo del área de presupuesto (descontando sidebar y panel de referencia en split)
  const splitOpen = refOpen && bp.w >= 1100;
  const mainW = bp.w - (bp.isDesktop ? 286 : 0) - (splitOpen ? refWidth + 6 : 0);
  const budgetCompact = bp.isMobile || mainW < 780;

  const sidebarProps = {
    active, expanded, onSelect, onToggle,
    pem, chapterTotals: t.showChapterTotals ? chapterTotals : {},
    chapters, onAddChapter: addChapter, onAddSubchapter: addSubchapter,
    refOpen, onDropRef: copyRefItems,
    onDeleteChapter: deleteChapter, onDeleteSub: deleteSubchapter,
    ivaRate, onSetIva: setIvaRate,
  };

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--bg-primary)", color: "var(--text-primary)", overflow: "hidden" }}>
      <TopBar view={view} onView={(v) => { setView(v); setDrawerOpen(false); }} onExport={() => setExportOpen(true)}
        theme={t.theme} onToggleTheme={toggleTheme} bp={bp} onMenu={() => setDrawerOpen(true)}
        refOpen={refOpen} onToggleRef={() => setRefOpen((o) => !o)} onObra={() => setObraOpen(true)} obraName={obra.denominacion} />
      <div style={{ flex: 1, display: "flex", minHeight: 0, position: "relative" }}>
        {/* Sidebar: fijo en desktop, drawer en móvil/tablet */}
        {bp.isDesktop ? (
          <Sidebar {...sidebarProps} />
        ) : (drawerOpen && (
          <React.Fragment>
            <div onClick={() => setDrawerOpen(false)} className="no-print drawer-overlay"
              style={{ position: "absolute", inset: 0, zIndex: 60 }} />
            <div className="drawer-panel" style={{ position: "absolute", top: 0, bottom: 0, left: 0, zIndex: 70, display: "flex", boxShadow: "var(--shadow-float)" }}>
              <Sidebar {...sidebarProps} drawer onAfterSelect={() => setDrawerOpen(false)} />
            </div>
          </React.Fragment>
        ))}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--bg-primary)" }}
          onDragOver={refOpen ? (e) => { if (window.__refDrag) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } } : undefined}
          onDrop={refOpen ? (e) => { const it = window.__refDrag; if (it) { e.preventDefault(); window.__refDrag = null; copyRefItems(it, undefined, undefined, window.__refContra); } } : undefined}>
          {view === "presupuesto" && active === "__ALL__" && (
            <AllChapters chapters={chapters} partidas={partidas} chapterTotals={chapterTotals}
              pem={pem} density={density} expandedRows={expandedRows} onToggleRow={onToggleRow}
              onEdit={onEdit} onMed={medApi} showBars={t.showBars} onAddPartida={addPartida} compact={budgetCompact}
              recursos={recursos} usage={usage} onRec={onRec} onPart={onPart} />
          )}
          {view === "presupuesto" && active !== "__ALL__" && (
            <React.Fragment>
              <ChapterHeader chapter={activeChapter} importe={chapterTotals[activeChapter.id] || 0}
                count={activePartidas.length} pem={pem} compact={budgetCompact} />
              {activePartidas.length > 0 ? (
                <div className={canvasBg} style={{ flex: 1, overflow: "auto" }}>
                  <Partidas compact={budgetCompact} chapter={activeChapter} chapterId={activeChapter.id} partidas={activePartidas} density={density}
                    expandedRows={expandedRows} onToggleRow={onToggleRow} onEdit={onEdit} onMed={medApi}
                    chapterTotal={chapterTotals[activeChapter.id] || 0} showBars={t.showBars} onAddPartida={addPartida}
                    recursos={recursos} usage={usage} onRec={onRec} chaptersAll={chapters} onPart={onPart} />
                </div>
              ) : (
                <EmptyChapter chapter={activeChapter} onAddPartida={addPartida} />
              )}
            </React.Fragment>
          )}
          {view === "import" && <ImportView compact={bp.isMobile} />}
          {view === "resumen" && (
            <window.MedResumen.ResumenView chapters={chapters} chapterTotals={chapterTotals} pem={pem}
              ggRate={ggRate} biRate={biRate} ivaRate={ivaRate}
              onSetGg={setGgRate} onSetBi={setBiRate} onSetIva={setIvaRate}
              notes={notes} onNotes={setNotes} projectName={obra.denominacion} compact={bp.isMobile} />
          )}
          {view === "certificaciones" && (
            <CertificacionesView chapters={chapters} partidas={partidas} certs={certs} curIndex={curCert}
              onSelectCert={setCurCert} onCertEdit={onCertEdit} onCertField={onCertField} onAddCert={onAddCert} compact={bp.isMobile}
              ivaRate={ivaRate} onSetIva={setIvaRate}
              onEditPartida={onEdit} onAddContradictorio={addContradictorio} expandedRows={expandedRows} onToggleRow={onToggleRow} />
          )}
        </main>
        {/* Panel de Referencia (split si hay sitio, overlay si no) */}
        {refOpen && bp.w >= 1100 && (
          <React.Fragment>
            <div onPointerDown={startResize} className="split-divider no-print"
              style={{ width: 6, flexShrink: 0, cursor: "col-resize", background: "var(--border-main)" }} />
            <aside style={{ width: refWidth, flexShrink: 0, minWidth: 0, borderLeft: "1px solid var(--border-main)" }}>
              <ReferencePanel sources={window.REF_SOURCES} curSourceId={refSourceId} onSelectSource={setRefSourceId}
                onCopy={(items, contra) => copyRefItems(items, undefined, undefined, contra)} activeChapterLabel={copyTarget.label} onClose={() => setRefOpen(false)}
                onImport={() => { setView("import"); setRefOpen(false); }} />
            </aside>
          </React.Fragment>
        )}
        {refOpen && bp.w < 1100 && (
          <div className="no-print" style={{ position: "absolute", inset: 0, zIndex: 80, background: "var(--bg-surface)", boxShadow: "var(--shadow-float)" }}>
            <ReferencePanel sources={window.REF_SOURCES} curSourceId={refSourceId} onSelectSource={setRefSourceId}
              onCopy={(items, contra) => copyRefItems(items, undefined, undefined, contra)} activeChapterLabel={copyTarget.label} onClose={() => setRefOpen(false)}
              onImport={() => { setView("import"); setRefOpen(false); }} compact />
          </div>
        )}
      </div>

      {!bp.isMobile && <StatusBar counts={counts} pem={pem} pec={pec} />}
      {bp.isMobile && <BottomTabBar view={view} onView={(v) => { setView(v); setDrawerOpen(false); }} />}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} onExportPdf={() => window.print()} compact={bp.isMobile} certs={certs} />
      <ObraModal open={obraOpen} onClose={() => setObraOpen(false)} obra={obra} onChange={setObraPath} compact={bp.isMobile} />

      {/* Tweaks */}
      <window.TweaksPanel>
        <window.TweakSection label="Tema" />
        <window.TweakRadio label="Modo" value={t.theme}
          options={[{ value: "dark", label: "Oscuro" }, { value: "light", label: "Claro" }]}
          onChange={(v) => setTweak("theme", v)} />
        <window.TweakColor label="Acento" value={t.accent}
          options={["#0284c7", "#0d9488", "#7c3aed", "#ea580c", "#0ea5e9"]}
          onChange={(v) => setTweak("accent", v)} />
        <window.TweakToggle label="Fondo dot-grid" value={t.dotGrid}
          onChange={(v) => setTweak("dotGrid", v)} />
        <window.TweakSection label="Tabla" />
        <window.TweakRadio label="Densidad" value={t.density}
          options={["compact", "regular", "comfy"]}
          onChange={(v) => setTweak("density", v)} />
        <window.TweakToggle label="Importes en el árbol" value={t.showChapterTotals}
          onChange={(v) => setTweak("showChapterTotals", v)} />
        <window.TweakToggle label="Barras de peso" value={t.showBars}
          onChange={(v) => setTweak("showBars", v)} />
      </window.TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

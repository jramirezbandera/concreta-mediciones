/* ===========================================================================
   Concreta · Mediciones — Justificación de precios EDITABLE
   Los conceptos se comparten por código (banco de recursos): editar precio,
   descripción o ud de un concepto afecta a todas las partidas que lo usan.
   El rendimiento (cantidad) es propio de cada partida.
   =========================================================================== */
const { Icon: JIcon, ICONS: JI } = window.MedIcons;
const { Badge: JBadge, EditableNum: JNum, EditableText: JText } = window.MedUI;

/* indicador de concepto compartido */
function SharedChip({ n }) {
  if (!n || n < 2) return null;
  return (
    <span title={"Compartido: editar este concepto afecta a " + n + " partidas"}
      style={{ display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0, padding: "1px 6px 1px 4px", borderRadius: 20,
        fontSize: 10, fontWeight: 600, background: "var(--accent-soft)", color: "var(--accent)" }}>
      <JIcon d={JI.layers} size={10} /> {n}
    </span>
  );
}

/* ===========================================================================
   Desktop — tabla editable
   =========================================================================== */
function PriceJustifFull({ p, recursos, usage, recApi }) {
  const items = p.items || [];
  const base = window.recursoBase(items, recursos);
  const td = { padding: "7px 10px", borderTop: "1px solid var(--border-sub)", verticalAlign: "middle" };
  return (
    <div style={{ borderRadius: 9, border: "1px solid var(--border-main)", background: "var(--bg-surface)", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--bg-elevated)" }}>
            {[["Tipo", 58, "left"], ["Código", 116, "left"], ["Concepto", "auto", "left"], ["Ud", 56, "left"], ["Rendim.", 96, "right"], ["Precio", 96, "right"], ["Importe", 104, "right"], ["", 40, "center"]].map(([h, w, a], i) => (
              <th key={i} style={{ width: w, textAlign: a, padding: "9px 10px", fontSize: 9.5, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-disabled)", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const isCI = it.type === "%CI";
            const rec = recursos[it.code] || {};
            const precio = isCI ? base : (rec.precio != null ? rec.precio : it.precio);
            const desc = isCI ? (it.desc || "Costes indirectos") : (rec.desc != null ? rec.desc : it.desc);
            const ud = isCI ? "%" : (rec.ud != null ? rec.ud : it.ud);
            const importe = window.itemImporteRec(it, recursos, base);
            return (
              <tr key={i} className="med-row">
                <td style={{ ...td, paddingLeft: 12 }}><JBadge type={it.type} /></td>
                <td style={td}><span className="mono" style={{ fontSize: 11.5, color: "var(--text-disabled)" }}>{it.code}</span></td>
                <td style={td}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isCI ? (
                      <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{desc}</span>
                    ) : (
                      <JText value={desc} onCommit={(v) => recApi.editRecurso(it.code, "desc", v)}
                        style={{ fontSize: 12.5, color: "var(--text-secondary)", borderRadius: 3, flex: 1 }} placeholder="Concepto…" />
                    )}
                    <SharedChip n={usage[it.code]} />
                  </div>
                </td>
                <td style={td}>
                  {isCI ? <span className="mono" style={{ fontSize: 11.5, color: "var(--text-disabled)" }}>%</span>
                    : <JText value={ud} onCommit={(v) => recApi.editRecurso(it.code, "ud", v)}
                        style={{ fontSize: 11.5, color: "var(--text-disabled)", borderRadius: 3 }} placeholder="ud" />}
                </td>
                <td style={{ ...td, paddingRight: 4 }}>
                  <JNum value={it.cantidad} dec={isCI ? 2 : 3} onCommit={(v) => recApi.editRend(p.id, i, v)} />
                </td>
                <td style={{ ...td, paddingRight: 4 }}>
                  {isCI ? <span className="mono" style={{ display: "block", textAlign: "right", paddingRight: 6, fontSize: 12, color: "var(--text-disabled)" }}>{window.fmtNum(precio)}</span>
                    : <JNum value={precio} dec={2} accent onCommit={(v) => recApi.editRecurso(it.code, "precio", v)} />}
                </td>
                <td className="mono" style={{ ...td, textAlign: "right", paddingRight: 14, fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{window.fmtNum(importe)}</td>
                <td style={{ ...td, textAlign: "center", paddingRight: 8 }}>
                  <button onClick={() => recApi.del(p.id, i)} title="Eliminar concepto" className="med-del tcol"
                    style={{ display: "grid", placeItems: "center", width: 22, height: 22, borderRadius: 5, border: 0, cursor: "pointer", background: "transparent", color: "var(--text-disabled)" }}>
                    <JIcon d={JI.x} size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr><td colSpan={8} style={{ padding: "22px 16px", textAlign: "center", fontSize: 12.5, color: "var(--text-disabled)" }}>
              Sin descomposición. Añade conceptos de mano de obra, maquinaria o materiales.
            </td></tr>
          )}
        </tbody>
      </table>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 14px", borderTop: "1px solid var(--border-main)", background: "var(--bg-elevated)" }}>
        <button onClick={() => recApi.add(p.id)} className="tcol add-partida"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 11px", borderRadius: 6, fontSize: 12.5, fontWeight: 500, border: 0, cursor: "pointer", background: "transparent", color: "var(--accent)", fontFamily: "inherit" }}>
          <JIcon d={JI.plus} size={14} /> Añadir concepto
        </button>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <span className="caps" style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-disabled)" }}>Precio descompuesto</span>
          <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{window.fmtNum(window.descompUnit(items, recursos))} €</span>
        </div>
      </div>
    </div>
  );
}

/* ===========================================================================
   Móvil — tarjetas editables
   =========================================================================== */
function PriceJustifCards({ p, recursos, usage, recApi }) {
  const items = p.items || [];
  const base = window.recursoBase(items, recursos);
  const Field = ({ label, children }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="caps" style={{ fontSize: 8.5, fontWeight: 600, color: "var(--text-disabled)", marginBottom: 3 }}>{label}</div>
      <div style={{ border: "1px solid var(--border-main)", borderRadius: 7, background: "var(--bg-primary)", padding: "4px 4px" }}>{children}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {items.map((it, i) => {
        const isCI = it.type === "%CI";
        const rec = recursos[it.code] || {};
        const precio = isCI ? base : (rec.precio != null ? rec.precio : it.precio);
        const desc = isCI ? (it.desc || "Costes indirectos") : (rec.desc != null ? rec.desc : it.desc);
        const importe = window.itemImporteRec(it, recursos, base);
        return (
          <div key={i} style={{ borderRadius: 9, border: "1px solid var(--border-main)", background: "var(--bg-surface)", padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <JBadge type={it.type} />
              <span className="mono" style={{ fontSize: 11, color: "var(--text-disabled)" }}>{it.code}</span>
              <SharedChip n={usage[it.code]} />
              <span className="mono" style={{ marginLeft: "auto", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{window.fmtNum(importe)}</span>
              <button onClick={() => recApi.del(p.id, i)} title="Eliminar concepto" className="med-del tcol"
                style={{ display: "grid", placeItems: "center", width: 26, height: 26, flexShrink: 0, borderRadius: 6, border: 0, cursor: "pointer", background: "var(--bg-elevated)", color: "var(--text-disabled)" }}>
                <JIcon d={JI.x} size={14} />
              </button>
            </div>
            {isCI ? (
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 8 }}>{desc}</div>
            ) : (
              <div style={{ marginBottom: 8 }}>
                <JText value={desc} onCommit={(v) => recApi.editRecurso(it.code, "desc", v)}
                  style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", borderRadius: 4 }} placeholder="Concepto…" />
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <Field label={isCI ? "Porcentaje" : "Rendimiento"}>
                <JNum value={it.cantidad} dec={isCI ? 2 : 3} align="center" onCommit={(v) => recApi.editRend(p.id, i, v)} />
              </Field>
              <Field label="Precio €">
                {isCI ? <span className="mono" style={{ display: "block", textAlign: "center", fontSize: 12, color: "var(--text-disabled)" }}>{window.fmtNum(precio)}</span>
                  : <JNum value={precio} dec={2} align="center" accent onCommit={(v) => recApi.editRecurso(it.code, "precio", v)} />}
              </Field>
            </div>
          </div>
        );
      })}
      <button onClick={() => recApi.add(p.id)} className="tcol"
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, height: 40, borderRadius: 9,
          border: "1px dashed var(--border-main)", cursor: "pointer", background: "transparent", color: "var(--accent)", fontSize: 13, fontWeight: 500, fontFamily: "inherit" }}>
        <JIcon d={JI.plus} size={15} /> Añadir concepto
      </button>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 14px", borderRadius: 9, border: "1px solid var(--border-main)", background: "var(--bg-elevated)" }}>
        <span className="caps" style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-disabled)" }}>Precio descompuesto</span>
        <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{window.fmtNum(window.descompUnit(items, recursos))} €</span>
      </div>
    </div>
  );
}

window.MedJustif = { PriceJustifFull, PriceJustifCards };

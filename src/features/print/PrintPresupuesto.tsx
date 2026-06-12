import { Fragment } from 'react';
import type { MedLineListado, PresupuestoListado } from '../../core/listado';
import { fmtCents, fmtNum, toEur } from '../../core/money';

/** Factores no vacíos de una línea, "1 × 85,00 × 0,60" ('' = factor 1). */
function dimsOf(l: MedLineListado): string {
  return l.dims
    .filter((v) => v !== '' && v != null)
    .map((v) => fmtNum(Number(v)))
    .join(' × ');
}

/**
 * Doc "Presupuesto y mediciones" (combinado, eng-review F7 §7): cada partida
 * con su precio y sus líneas de medición debajo. Solo lectura, paginado.
 */
export function PrintPresupuesto({ data }: { data: PresupuestoListado }) {
  return (
    <div>
      {data.capitulos.map((c) => (
        <section key={c.id}>
          <div className="pd-band">
            <span className="mono pd-band-code">{c.code}</span>
            <span className="pd-band-title">{c.title}</span>
            <span className="mono pd-band-total">{fmtCents(c.total)}</span>
          </div>
          <table className="pd-table">
            <thead>
              <tr>
                <th style={{ width: 52 }}>Nº · Código</th>
                <th>Descripción y mediciones</th>
                <th style={{ width: 30 }}>Ud.</th>
                <th className="pd-num" style={{ width: 60 }}>
                  Cantidad
                </th>
                <th className="pd-num" style={{ width: 60 }}>
                  Precio
                </th>
                <th className="pd-num" style={{ width: 70 }}>
                  Importe
                </th>
              </tr>
            </thead>
            <tbody>
              {c.grupos.map((g, gi) => (
                <Fragment key={g.sub?.id ?? `orphan-${gi}`}>
                  {g.sub && (
                    <tr className="pd-sub">
                      {/* sangría por profundidad (N niveles); total ACUMULADO */}
                      <td colSpan={5} style={{ paddingLeft: 6 + (g.depth - 1) * 14 }}>
                        {g.sub.code} · {g.sub.title}
                      </td>
                      <td className="mono pd-num">{fmtNum(toEur(g.total))}</td>
                    </tr>
                  )}
                  {g.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">
                        {r.pos}
                        <br />
                        <span className="pd-code">{r.code}</span>
                      </td>
                      <td>
                        <div className="pd-title">{r.title}</div>
                        {r.desc && <div className="pd-desc">{r.desc}</div>}
                        {r.med.length > 0 && (
                          <table className="pd-med">
                            <tbody>
                              <tr>
                                <td className="pd-med-label" colSpan={2}>
                                  Mediciones
                                </td>
                                <td className="pd-med-label pd-med-parcial">Parcial</td>
                              </tr>
                              {r.med.map((l) => (
                                <tr key={l.id}>
                                  <td>{l.comment || '—'}</td>
                                  <td className="mono">{dimsOf(l) || '—'}</td>
                                  <td className="mono pd-med-parcial">{fmtNum(l.parcial)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                      <td className="mono">{r.ud}</td>
                      <td className="mono pd-num">{fmtNum(r.cantidad)}</td>
                      <td className="mono pd-num">{fmtNum(r.precio)}</td>
                      <td className="mono pd-num">{fmtNum(toEur(r.importe))}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr className="pd-chaptotal">
                <td colSpan={5}>Total capítulo {c.code} · {c.title}</td>
                <td className="mono pd-num">{fmtNum(toEur(c.total))}</td>
              </tr>
            </tbody>
          </table>
        </section>
      ))}
      <div className="pd-grand">
        <span>Presupuesto de Ejecución Material (PEM)</span>
        <span className="mono">{fmtCents(data.pem)}</span>
      </div>
    </div>
  );
}

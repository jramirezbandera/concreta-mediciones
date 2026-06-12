import { Fragment } from 'react';
import type { CertListado } from '../../core/listado';
import { fmtCents, fmtNum, toEur } from '../../core/money';

/**
 * Doc de certificación (a origen): por capítulo, partidas con ofertada,
 * ejecutada y la triple A origen / Anterior / Esta cert. (valoradas con el
 * snapshot de precios de la cert, F7.0), contradictorios P.C. incluidos, y
 * resumen económico hasta el líquido a abonar.
 */
export function PrintCert({ data }: { data: CertListado }) {
  const t = data.totals;
  return (
    <div>
      {data.capitulos.map((c) => (
        <section key={c.id}>
          <div className="pd-band">
            <span className="mono pd-band-code">{c.code}</span>
            <span className="pd-band-title">{c.title}</span>
            <span className="mono pd-band-total">{fmtNum(toEur(c.aOrigen))}</span>
          </div>
          <table className="pd-table">
            <thead>
              <tr>
                <th style={{ width: 52 }}>Nº · Código</th>
                <th>Descripción</th>
                <th style={{ width: 28 }}>Ud.</th>
                <th className="pd-num" style={{ width: 54 }}>
                  Ofertada
                </th>
                <th className="pd-num" style={{ width: 54 }}>
                  Ejecutada
                </th>
                <th className="pd-num" style={{ width: 52 }}>
                  Precio
                </th>
                <th className="pd-num" style={{ width: 64 }}>
                  A origen
                </th>
                <th className="pd-num" style={{ width: 64 }}>
                  Anterior
                </th>
                <th className="pd-num" style={{ width: 64 }}>
                  Esta cert.
                </th>
              </tr>
            </thead>
            <tbody>
              {c.grupos.map((g, gi) => (
                <Fragment key={g.sub?.id ?? `orphan-${gi}`}>
                  {g.sub && (
                    <tr className="pd-sub">
                      {/* sangría por profundidad (N niveles) */}
                      <td colSpan={9} style={{ paddingLeft: 6 + (g.depth - 1) * 14 }}>
                        {g.sub.code} · {g.sub.title}
                      </td>
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
                      </td>
                      <td className="mono">{r.ud}</td>
                      <td className="mono pd-num">{fmtNum(r.ofertada)}</td>
                      <td className="mono pd-num">{fmtNum(r.ejecutada)}</td>
                      <td className="mono pd-num">{fmtNum(r.precio)}</td>
                      <td className="mono pd-num">{fmtNum(toEur(r.aOrigen))}</td>
                      <td className="mono pd-num">{fmtNum(toEur(r.anterior))}</td>
                      <td className="mono pd-num">{fmtNum(toEur(r.estaCert))}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {c.extras.map((e) => (
                <tr key={e.id}>
                  <td className="mono">
                    {e.pos}
                    <br />
                    <span className="pd-code">P.C.</span>
                  </td>
                  <td>
                    <div className="pd-title">
                      <span className="pd-pc">P.C.</span>
                      {e.title || 'Precio contradictorio'}
                    </div>
                  </td>
                  <td className="mono">{e.ud}</td>
                  <td className="mono pd-num">—</td>
                  <td className="mono pd-num">{fmtNum(e.cantidad)}</td>
                  <td className="mono pd-num">{fmtNum(e.precio)}</td>
                  <td className="mono pd-num">{fmtNum(toEur(e.aOrigen))}</td>
                  <td className="mono pd-num">{fmtNum(toEur(e.anterior))}</td>
                  <td className="mono pd-num">{fmtNum(toEur(e.estaCert))}</td>
                </tr>
              ))}
              <tr className="pd-chaptotal">
                <td colSpan={6}>Total capítulo {c.code}</td>
                <td className="mono pd-num">{fmtNum(toEur(c.aOrigen))}</td>
                <td className="mono pd-num">{fmtNum(toEur(c.anterior))}</td>
                <td className="mono pd-num">{fmtNum(toEur(c.estaCert))}</td>
              </tr>
            </tbody>
          </table>
        </section>
      ))}

      <div className="pd-summary">
        <div className="pd-summary-row">
          <span>Ejecución material a origen</span>
          <b className="mono">{fmtCents(t.certPEM)}</b>
        </div>
        <div className="pd-summary-row">
          <span>Gastos generales y B.I.</span>
          <span className="mono">{fmtCents(t.ggbiOrigen)}</span>
        </div>
        <div className="pd-summary-row">
          <span>Ejecución por contrata a origen</span>
          <span className="mono">{fmtCents(t.pecOrigen)}</span>
        </div>
        <div className="pd-summary-row">
          <span>Certificado anterior</span>
          <span className="mono">−{fmtCents(t.pecPrev)}</span>
        </div>
        <div className="pd-summary-row">
          <span>
            <b>Esta certificación</b>
          </span>
          <b className="mono">{fmtCents(t.pecEsta)}</b>
        </div>
        <div className="pd-summary-row">
          <span>Retención ({fmtNum(data.retencion * 100, 1)}%)</span>
          <span className="mono">−{fmtCents(t.retencion)}</span>
        </div>
        <div className="pd-summary-row">
          <span>Base imponible</span>
          <span className="mono">{fmtCents(t.base)}</span>
        </div>
        <div className="pd-summary-row">
          <span>IVA</span>
          <span className="mono">{fmtCents(t.iva)}</span>
        </div>
        <div className="pd-summary-big">
          <span>Líquido a abonar</span>
          <span className="mono">{fmtCents(t.liquido)}</span>
        </div>
      </div>
    </div>
  );
}

import { Fragment } from 'react';
import { ESTADO_LIQUIDACION, LINEAS_RESUMEN_LIQUIDACION, type Liquidacion } from '../../core/liquidacion';
import { fmtCents, fmtNum, toEur } from '../../core/money';

/** «+1.234,56» / «−12,00»; «—» si es 0. */
function conSigno(c: number): string {
  if (c === 0) return '—';
  return `${c > 0 ? '+' : '−'}${fmtNum(Math.abs(toEur(c)))}`;
}

/**
 * Doc de liquidación final (docs/plan-liquidacion.md): por capítulo, cada
 * partida con lo presupuestado y lo ejecutado a origen en la última
 * certificación, la diferencia y su estado; y el resumen económico de los dos
 * lados. Las líneas sin CI no se imprimen si la obra no lleva CI.
 */
export function PrintLiquidacion({ data }: { data: Liquidacion }) {
  const lineas = LINEAS_RESUMEN_LIQUIDACION.filter((l) => data.pres.ci > 0 || data.ejec.ci > 0 || (l.k !== 'cd' && l.k !== 'ci'));
  return (
    <div>
      {data.capitulos.map((c) => (
        <section key={c.id}>
          <div className="pd-band">
            <span className="mono pd-band-code">{c.code}</span>
            <span className="pd-band-title">{c.title}</span>
            <span className="mono pd-band-total">{conSigno(c.ejec - c.pres)}</span>
          </div>
          <table className="pd-table">
            <thead>
              <tr>
                <th style={{ width: 52 }}>Nº · Código</th>
                <th>Descripción</th>
                <th style={{ width: 28 }}>Ud.</th>
                <th className="pd-num" style={{ width: 52 }}>
                  Presup.
                </th>
                <th className="pd-num" style={{ width: 64 }}>
                  Importe
                </th>
                <th className="pd-num" style={{ width: 52 }}>
                  Ejecutada
                </th>
                <th className="pd-num" style={{ width: 64 }}>
                  Importe
                </th>
                <th className="pd-num" style={{ width: 64 }}>
                  Diferencia
                </th>
                <th className="pd-num" style={{ width: 40 }}>
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {c.grupos.map((g, gi) => (
                <Fragment key={g.sub?.id ?? `g-${gi}`}>
                  {g.sub && (
                    <tr className="pd-sub">
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
                        <div className="pd-title">
                          {ESTADO_LIQUIDACION[r.estado] && <span className="pd-cerrada">{ESTADO_LIQUIDACION[r.estado]}</span>}
                          {r.title}
                        </div>
                      </td>
                      <td className="mono">{r.ud}</td>
                      <td className="mono pd-num">{r.presCant ? fmtNum(r.presCant) : '—'}</td>
                      <td className="mono pd-num">{r.presImporte ? fmtNum(toEur(r.presImporte)) : '—'}</td>
                      <td className="mono pd-num">{fmtNum(r.ejecCant)}</td>
                      <td className="mono pd-num">{fmtNum(toEur(r.ejecImporte))}</td>
                      <td className="mono pd-num">{conSigno(r.difImporte)}</td>
                      <td className="mono pd-num">{r.pct == null ? '—' : fmtNum(r.pct, 0)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr className="pd-chaptotal">
                <td colSpan={4}>Total capítulo {c.code}</td>
                <td className="mono pd-num">{fmtNum(toEur(c.pres))}</td>
                <td />
                <td className="mono pd-num">{fmtNum(toEur(c.ejec))}</td>
                <td className="mono pd-num">{conSigno(c.ejec - c.pres)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </section>
      ))}

      <table className="pd-table pd-liq-resumen">
        <thead>
          <tr>
            <th>Resumen</th>
            <th className="pd-num" style={{ width: 96 }}>
              Presupuestado
            </th>
            <th className="pd-num" style={{ width: 96 }}>
              Ejecutado
            </th>
            <th className="pd-num" style={{ width: 96 }}>
              Diferencia
            </th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l) => (
            <tr key={l.k} className={l.fuerte ? 'pd-chaptotal' : undefined}>
              <td>{l.label}</td>
              <td className="mono pd-num">{fmtCents(data.pres[l.k])}</td>
              <td className="mono pd-num">{fmtCents(data.ejec[l.k])}</td>
              <td className="mono pd-num">{conSigno(data.ejec[l.k] - data.pres[l.k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pd-summary">
        {data.retenido != null && (
          <div className="pd-summary-note">
            <span>Garantía retenida acumulada hasta la certificación nº {data.certNum}</span>
            <span className="mono">{fmtCents(data.retenido)}</span>
          </div>
        )}
        <div className="pd-summary-note">
          <span>
            {[
              data.cuenta.exceso && `${data.cuenta.exceso} con exceso`,
              data.cuenta.defecto && `${data.cuenta.defecto} con defecto`,
              data.cuenta.noEjecutada && `${data.cuenta.noEjecutada} sin ejecutar`,
              data.cuenta.contradictorio && `${data.cuenta.contradictorio} precios contradictorios`,
              data.cuenta.eliminada && `${data.cuenta.eliminada} eliminadas del presupuesto`,
            ]
              .filter(Boolean)
              .join(' · ') || 'Todo ejecutado según el presupuesto'}
          </span>
        </div>
      </div>
    </div>
  );
}

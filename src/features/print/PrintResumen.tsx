import type { ResumenListado } from '../../core/listado';
import { fmtCents, fmtNum, toEur } from '../../core/money';
import { asciendeLegal } from '../../core/numeroALetras';

/**
 * Doc «Resumen de presupuesto»: desglose por capítulos como TABLA del documento
 * (mismas reglas y escala que presupuesto y certificación) y, a la derecha, la
 * cadena [CI →] PEM → GG → BI → PEC → IVA → base de licitación en el mismo bloque
 * `pd-summary` que el resumen económico de la cert. Cierra con la fórmula legal
 * «Asciende el presupuesto…» en letras.
 *
 * En pantalla la hoja la pinta `ResumenSheet` (editable, con tarjeta y escala de
 * UI); aquí NO se reutiliza a propósito: el papel tiene otra jerarquía —el total
 * es una cifra de documento, no un titular. Los NÚMEROS son los mismos: ambos
 * consumen el `ResumenListado` del mismo selector.
 */
export function PrintResumen({ data }: { data: ResumenListado }) {
  const { rows, cd, ci, pem, gg, bi, pec, iva, total, rates } = data;
  // El CI solo IMPRIME si la obra lo lleva aparte: un «0,00 €» en el documento
  // que se firma es ruido (en pantalla sí se ve siempre, ahí es el mando).
  const conCI = ci > 0;
  return (
    <div>
      <table className="pd-table">
        <thead>
          <tr>
            <th style={{ width: 34 }}>Nº</th>
            <th>Capítulo</th>
            <th className="pd-num" style={{ width: 54 }}>
              {conCI ? '% s/ C.D.' : '% s/ PEM'}
            </th>
            <th className="pd-num" style={{ width: 90 }}>
              Importe
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="mono pd-code">{r.code}</td>
              <td className="pd-title">{r.title}</td>
              <td className="mono pd-num pd-res-pct">{fmtNum(r.pct, 1)}%</td>
              <td className="mono pd-num">{fmtNum(toEur(r.importe))}</td>
            </tr>
          ))}
          {conCI && (
            <tr className="pd-chaptotal">
              <td colSpan={3}>Costes directos (suma de capítulos)</td>
              <td className="mono pd-num">{fmtNum(toEur(cd))}</td>
            </tr>
          )}
          {conCI && (
            <tr>
              <td colSpan={3}>Costes indirectos ({fmtNum(rates.ci * 100, 1)} %)</td>
              <td className="mono pd-num">{fmtNum(toEur(ci))}</td>
            </tr>
          )}
          <tr className="pd-chaptotal">
            <td colSpan={3}>Presupuesto de Ejecución Material (PEM)</td>
            <td className="mono pd-num">{fmtNum(toEur(pem))}</td>
          </tr>
        </tbody>
      </table>

      <div className="pd-summary">
        {conCI && (
          <div className="pd-summary-row">
            <span>Costes directos</span>
            <span className="mono">{fmtCents(cd)}</span>
          </div>
        )}
        {conCI && (
          <div className="pd-summary-row">
            <span>Costes indirectos ({fmtNum(rates.ci * 100, 1)} %)</span>
            <span className="mono">{fmtCents(ci)}</span>
          </div>
        )}
        <div className="pd-summary-row">
          <span>Ejecución material</span>
          <span className="mono">{fmtCents(pem)}</span>
        </div>
        <div className="pd-summary-row">
          <span>Gastos generales ({fmtNum(rates.gg * 100, 1)} %)</span>
          <span className="mono">{fmtCents(gg)}</span>
        </div>
        <div className="pd-summary-row">
          <span>Beneficio industrial ({fmtNum(rates.bi * 100, 1)} %)</span>
          <span className="mono">{fmtCents(bi)}</span>
        </div>
        <div className="pd-summary-row">
          <span>
            <b>Presupuesto de Ejecución por Contrata (s/ IVA)</b>
          </span>
          <b className="mono">{fmtCents(pec)}</b>
        </div>
        <div className="pd-summary-row">
          <span>IVA ({fmtNum(rates.iva * 100, 1)} %)</span>
          <span className="mono">{fmtCents(iva)}</span>
        </div>
        <div className="pd-summary-big">
          <span>Presupuesto base de licitación</span>
          <span className="mono">{fmtCents(total)}</span>
        </div>
      </div>

      <p className="pd-legal">{asciendeLegal(total)}</p>
    </div>
  );
}

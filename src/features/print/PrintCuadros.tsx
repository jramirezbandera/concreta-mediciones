import { Fragment, type ReactNode } from 'react';
import type { CuadroCapitulo, CuadroPartidaRow, CuadrosPrecios } from '../../core/cuadrosPrecios';
import { fmtNum, toEur } from '../../core/money';

/** Capítulos del cuadro con sus subcapítulos; `fila` pinta cada partida. */
function Capitulos({
  data,
  cabecera,
  fila,
  cols,
}: {
  data: CuadrosPrecios;
  cabecera: ReactNode;
  fila: (r: CuadroPartidaRow) => ReactNode;
  cols: number;
}) {
  return (
    <div>
      {data.capitulos.map((c: CuadroCapitulo) => (
        <section key={c.id}>
          <div className="pd-band">
            <span className="mono pd-band-code">{c.code}</span>
            <span className="pd-band-title">{c.title}</span>
          </div>
          <table className="pd-table">
            <thead>{cabecera}</thead>
            <tbody>
              {c.grupos.map((g, gi) => (
                <Fragment key={g.sub?.id ?? `orphan-${gi}`}>
                  {g.sub && (
                    <tr className="pd-sub">
                      <td colSpan={cols} style={{ paddingLeft: 6 + (g.depth - 1) * 14 }}>
                        {g.sub.code} · {g.sub.title}
                      </td>
                    </tr>
                  )}
                  {g.rows.map(fila)}
                </Fragment>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

/** Nº, código y designación (ud + título + texto) de una partida; `children`
 *  va debajo del texto (la descomposición del cuadro nº 2). */
function Designacion({ r, children }: { r: CuadroPartidaRow; children?: ReactNode }) {
  return (
    <>
      <td className="mono">
        {r.pos}
        <br />
        <span className="pd-code">{r.code}</span>
      </td>
      <td>
        <div className="pd-title">
          <span className="mono">{r.ud}</span> {r.title}
        </div>
        {r.desc && <div className="pd-desc">{r.desc}</div>}
        {children}
      </td>
    </>
  );
}

/** Cuadro de precios nº 1: el precio de cada partida en cifra y en letra. */
export function PrintCuadro1({ data }: { data: CuadrosPrecios }) {
  return (
    <Capitulos
      data={data}
      cols={4}
      cabecera={
        <tr>
          <th style={{ width: 52 }}>Nº · Código</th>
          <th>Designación</th>
          <th className="pd-num" style={{ width: 60 }}>
            En cifra (€)
          </th>
          <th style={{ width: '30%' }}>En letra (€)</th>
        </tr>
      }
      fila={(r) => (
        <tr key={r.id}>
          <Designacion r={r} />
          <td className="mono pd-num">{fmtNum(toEur(r.precio))}</td>
          <td className="pd-letra">{r.letras}</td>
        </tr>
      )}
    />
  );
}

/** Cuadro de precios nº 2: el precio de cada partida descompuesto. */
export function PrintCuadro2({ data }: { data: CuadrosPrecios }) {
  return (
    <Capitulos
      data={data}
      cols={3}
      cabecera={
        <tr>
          <th style={{ width: 52 }}>Nº · Código</th>
          <th>Designación y descomposición</th>
          <th className="pd-num" style={{ width: 60 }}>
            Precio (€)
          </th>
        </tr>
      }
      fila={(r) => (
        <tr key={r.id}>
          <Designacion r={r}>
            <table className="pd-med pd-cp">
              <tbody>
                {r.lineas.map((l) => (
                  <tr key={l.concepto}>
                    <td>{l.concepto}</td>
                    <td className="mono pd-med-parcial">{fmtNum(toEur(l.importe))}</td>
                  </tr>
                ))}
                <tr className="pd-cp-total">
                  <td>Total</td>
                  <td className="mono pd-med-parcial">{fmtNum(toEur(r.precio))}</td>
                </tr>
              </tbody>
            </table>
          </Designacion>
          <td className="mono pd-num pd-title">{fmtNum(toEur(r.precio))}</td>
        </tr>
      )}
    />
  );
}

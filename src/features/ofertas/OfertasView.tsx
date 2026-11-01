import { Fragment, useMemo, useRef, useState } from 'react';
import { EmptyAction, EmptyState, Icon } from '../../components';
import { fmtCents, fmtNum, toEur } from '../../core/money';
import { compararOfertas, type CeldaOferta, type Oferta, type ResumenOferta } from '../../core/ofertas';
import { useObraStore, useToastStore } from '../../store';
import { getDomainRevision, undo } from '../../store/temporal';
import { ofertaDesdeFichero } from './importarOferta';
import styles from './Ofertas.module.css';

/** «+3,2 %» / «−1,0 %»; vacío si no hay desviación que dar. */
function fmtDesv(d: number | null): string {
  if (d == null) return '';
  const s = fmtNum(Math.abs(d), 1);
  return `${d > 0 ? '+' : d < 0 ? '−' : ''}${s} %`;
}

function desvClass(d: number | null): string {
  if (d == null || Math.abs(d) < 0.05) return '';
  return (d > 0 ? styles.caro : styles.barato) ?? '';
}

/** Plural sencillo: «1 partida», «3 partidas». */
const n = (k: number, una: string, varias: string) => `${k} ${k === 1 ? una : varias}`;

/**
 * Vista «Ofertas» (docs/plan-ofertas.md, O2): las ofertas que devuelven las
 * constructoras, casadas con las partidas, frente al presupuesto. Todo en
 * ejecución material y con NUESTRAS cantidades; lo que la oferta trae distinto
 * (cantidades, partidas que no son nuestras, partidas sin precio) se avisa.
 */
export function OfertasView({ compact, onGoPresupuesto }: { compact: boolean; onGoPresupuesto: () => void }) {
  const chapters = useObraStore((s) => s.chapters);
  const partidas = useObraStore((s) => s.partidas);
  const coefK = useObraStore((s) => s.rates.coefK);
  const ofertas = useObraStore((s) => s.ofertas);
  const obraName = useObraStore((s) => s.obra.denominacion);
  const addOferta = useObraStore((s) => s.addOferta);
  const hayPartidas = Object.values(partidas).some((ps) => (ps ?? []).length > 0);
  const input = useRef<HTMLInputElement>(null);
  const [leyendo, setLeyendo] = useState(false);

  const lista = useMemo(() => ofertas ?? [], [ofertas]);
  const cmp = useMemo(() => compararOfertas(chapters, partidas, lista, coefK), [chapters, partidas, lista, coefK]);

  const elegir = () => input.current?.click();
  const alElegir = async (files: FileList | null) => {
    if (!files?.length) return;
    setLeyendo(true);
    try {
      for (const file of Array.from(files)) {
        try {
          const { oferta, casamiento } = await ofertaDesdeFichero(file, useObraStore.getState());
          addOferta(oferta);
          const avisos = [
            casamiento.sinCasar.length ? n(casamiento.sinCasar.length, 'partida que no es del presupuesto', 'partidas que no son del presupuesto') : '',
            casamiento.sinPrecio ? n(casamiento.sinPrecio, 'sin precio', 'sin precio') : '',
          ].filter(Boolean);
          useToastStore
            .getState()
            .show(
              `Oferta de ${oferta.empresa}: ${n(casamiento.casadas, 'partida con precio', 'partidas con precio')}${avisos.length ? ` · ${avisos.join(' · ')}` : ''}`,
              { label: 'Deshacer', run: () => undo() },
              { rev: getDomainRevision(), tone: casamiento.casadas ? 'ok' : 'warn' },
            );
        } catch (e) {
          useToastStore
            .getState()
            .show(`No se pudo leer «${file.name}»: ${e instanceof Error ? e.message : 'fichero no válido'}`, undefined, { tone: 'error' });
        }
      }
    } finally {
      setLeyendo(false);
      if (input.current) input.current.value = '';
    }
  };

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept=".bc3"
      multiple
      hidden
      aria-label="Elegir ficheros de oferta"
      onChange={(e) => void alElegir(e.target.files)}
    />
  );

  if (!hayPartidas) {
    return (
      <EmptyState icon="send" title="Aún no hay presupuesto que comparar" text="Las ofertas se casan con las partidas del presupuesto: primero hace falta tenerlo.">
        <EmptyAction primary onClick={onGoPresupuesto}>
          <Icon name="list" size={15} /> Ir al presupuesto
        </EmptyAction>
      </EmptyState>
    );
  }

  if (lista.length === 0) {
    return (
      <EmptyState
        icon="send"
        title="Comparativo de ofertas"
        text={
          <>
            Exporta las <b>Mediciones sin precios</b> (Exportar → Excel o BC3) y mándalas a las constructoras. Lo que te
            devuelva cada una, añádelo aquí: se casa con tus partidas y ves dónde se desvía cada oferta.
          </>
        }
      >
        <EmptyAction primary onClick={elegir}>
          <Icon name="upload" size={15} /> {leyendo ? 'Leyendo…' : 'Añadir oferta (.bc3)'}
        </EmptyAction>
        {fileInput}
      </EmptyState>
    );
  }

  return (
    <div className={`fadeUp dot-grid ${styles.view} ${compact ? styles.compact : ''}`}>
      <div className={styles.page}>
        <div className={styles.head}>
          <div>
            <div className={`caps ${styles.kicker}`}>Comparativo de ofertas</div>
            <h1 className={styles.title}>{obraName}</h1>
            <p className={styles.sub}>Ejecución material, con las cantidades de tu presupuesto.</p>
          </div>
          <button type="button" className={styles.primary} onClick={elegir} disabled={leyendo}>
            <Icon name="upload" size={15} /> {leyendo ? 'Leyendo…' : 'Añadir oferta'}
          </button>
          {fileInput}
        </div>

        <div className={styles.cards}>
          <div className={`${styles.card} ${styles.cardPres}`}>
            <div className={`caps ${styles.cardKicker}`}>Presupuesto</div>
            <div className={`mono ${styles.cardTotal}`}>{fmtCents(cmp.pem)}</div>
            <div className={styles.cardMeta}>PEM</div>
          </div>
          {cmp.ofertas.map((r, i) => (
            <TarjetaOferta key={r.id} r={r} oferta={lista[i]!} />
          ))}
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colDesc} rowSpan={2}>
                  Partida
                </th>
                <th className={styles.colNum} rowSpan={2}>
                  Cantidad
                </th>
                <th className={styles.grupoHead} colSpan={2}>
                  Presupuesto
                </th>
                {cmp.ofertas.map((r) => (
                  <th key={r.id} className={styles.grupoHead} colSpan={3} title={r.empresa}>
                    {r.empresa}
                  </th>
                ))}
              </tr>
              <tr>
                <th className={styles.colNum}>Precio</th>
                <th className={styles.colNum}>Importe</th>
                {cmp.ofertas.map((r) => (
                  <Fragment key={r.id}>
                    <th className={`${styles.colNum} ${styles.sep}`}>Precio</th>
                    <th className={styles.colNum}>Importe</th>
                    <th className={styles.colNum}>Desv.</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {cmp.capitulos.map((c) => (
                <Fragment key={c.id}>
                  <tr className={styles.capRow}>
                    <td colSpan={2}>
                      <span className="mono">{c.code}</span> {c.title}
                    </td>
                    <td />
                    <td className={`mono ${styles.num}`}>{fmtNum(toEur(c.total))}</td>
                    {c.totales.map((t, i) => (
                      <Fragment key={cmp.ofertas[i]!.id}>
                        <td className={styles.sep} />
                        <td className={`mono ${styles.num}`}>{fmtNum(toEur(t))}</td>
                        <td />
                      </Fragment>
                    ))}
                  </tr>
                  {c.grupos.map((g, gi) => (
                    <Fragment key={g.sub?.id ?? `g-${gi}`}>
                      {g.sub && (
                        <tr className={styles.subRow}>
                          <td colSpan={4 + 3 * cmp.ofertas.length} style={{ paddingLeft: 10 + (g.depth - 1) * 14 }}>
                            {g.sub.code} · {g.sub.title}
                          </td>
                        </tr>
                      )}
                      {g.rows.map((r) => (
                        <tr key={r.id}>
                          <td className={styles.colDesc}>
                            <span className={`mono ${styles.pos}`}>{r.pos}</span> {r.title}
                          </td>
                          <td className={`mono ${styles.num}`}>
                            {fmtNum(r.cantidad)} <span className={styles.ud}>{r.ud}</span>
                          </td>
                          <td className={`mono ${styles.num}`}>{fmtNum(r.precio)}</td>
                          <td className={`mono ${styles.num}`}>{fmtNum(toEur(r.importe))}</td>
                          {r.ofertas.map((o, i) => (
                            <Celda key={cmp.ofertas[i]!.id} o={o} ud={r.ud} />
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total ejecución material</td>
                <td className={`mono ${styles.num}`}>{fmtNum(toEur(cmp.pem))}</td>
                {cmp.ofertas.map((r) => (
                  <Fragment key={r.id}>
                    <td className={styles.sep} />
                    <td className={`mono ${styles.num}`}>{fmtNum(toEur(r.total))}</td>
                    <td className={`mono ${styles.num} ${desvClass(r.desviacion)}`}>{fmtDesv(r.desviacion)}</td>
                  </Fragment>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        {lista.some((o) => o.sinCasar.length > 0) && (
          <div className={styles.sinCasar}>
            <div className="sec-head">Partidas de las ofertas que no son del presupuesto</div>
            <p className={styles.sub}>No entran en el total de la oferta. Si alguna es una de tus partidas con otro código o título, la constructora la ha cambiado.</p>
            {lista
              .filter((o) => o.sinCasar.length > 0)
              .map((o) => (
                <details key={o.id} className={styles.detalle}>
                  <summary>
                    {o.empresa} · {n(o.sinCasar.length, 'partida', 'partidas')}
                  </summary>
                  <ul>
                    {o.sinCasar.map((f, i) => (
                      <li key={`${f.code}-${i}`}>
                        <span className="mono">{f.code}</span> {f.title}{' '}
                        <span className={`mono ${styles.ud}`}>
                          {fmtNum(f.cantidad)} {f.ud} × {fmtNum(f.precio)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
          </div>
        )}
        <div className={styles.spacer} />
      </div>
    </div>
  );
}

function Celda({ o, ud }: { o: CeldaOferta | null; ud: string }) {
  if (!o)
    return (
      <>
        <td className={`${styles.num} ${styles.sep} ${styles.falta}`} colSpan={3}>
          sin precio
        </td>
      </>
    );
  return (
    <>
      <td className={`mono ${styles.num} ${styles.sep} ${o.minima ? styles.minima : ''}`}>{fmtNum(o.precio)}</td>
      <td className={`mono ${styles.num} ${o.minima ? styles.minima : ''}`}>
        {fmtNum(toEur(o.importe))}
        {o.cantidadOferta != null && (
          <span className={styles.otraCant} title={`La oferta trae ${fmtNum(o.cantidadOferta)} ${ud}; aquí se compara con tu cantidad`}>
            <Icon name="alert" size={12} /> {fmtNum(o.cantidadOferta)}
          </span>
        )}
      </td>
      <td className={`mono ${styles.num} ${desvClass(o.desviacion)}`}>{fmtDesv(o.desviacion)}</td>
    </>
  );
}

function TarjetaOferta({ r, oferta }: { r: ResumenOferta; oferta: Oferta }) {
  const renombrar = useObraStore((s) => s.renombrarOferta);
  const quitar = useObraStore((s) => s.quitarOferta);
  const avisos = [
    r.sinPrecio ? n(r.sinPrecio, 'partida sin precio', 'partidas sin precio') : '',
    r.cantidadesDistintas ? n(r.cantidadesDistintas, 'cantidad distinta', 'cantidades distintas') : '',
    r.sinCasar ? n(r.sinCasar, 'partida que no es tuya', 'partidas que no son tuyas') : '',
  ].filter(Boolean);
  return (
    <div className={`${styles.card} ${r.mejor ? styles.cardMejor : ''}`}>
      <div className={styles.cardTop}>
        <input
          className={styles.empresa}
          value={r.empresa}
          aria-label="Nombre de la constructora"
          onChange={(e) => renombrar(r.id, e.target.value)}
        />
        <button
          type="button"
          className={styles.quitar}
          aria-label={`Quitar la oferta de ${r.empresa}`}
          title="Quitar la oferta"
          onClick={() => {
            quitar(r.id);
            useToastStore.getState().show(`Oferta de ${r.empresa} quitada`, { label: 'Deshacer', run: () => undo() }, { rev: getDomainRevision() });
          }}
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
      <div className={`mono ${styles.cardTotal}`}>{fmtCents(r.total)}</div>
      <div className={styles.cardMeta}>
        {r.mejor && <span className={styles.mejor}>La más baja</span>}
        {r.desviacion != null && <span className={desvClass(r.desviacion)}>{fmtDesv(r.desviacion)} sobre el PEM</span>}
        {r.sinPrecio > 0 && <span>Incompleta: suma solo lo que trae precio</span>}
      </div>
      {avisos.length > 0 && (
        <ul className={styles.avisos}>
          {avisos.map((a) => (
            <li key={a}>
              <Icon name="alert" size={12} /> {a}
            </li>
          ))}
          {r.cantidadesDistintas > 0 && r.totalSusCantidades !== r.total && (
            <li>Con sus cantidades: {fmtCents(r.totalSusCantidades)}</li>
          )}
        </ul>
      )}
      <div className={styles.fichero} title={oferta.fichero}>
        {oferta.fichero} · {new Date(oferta.fecha).toLocaleDateString('es-ES')}
      </div>
    </div>
  );
}

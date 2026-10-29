import { Fragment, useState } from 'react';
import { Icon } from '../../components';
import { fmtCents, fmtNum } from '../../core/money';
import { lerConAsterisco, todasLasOperaciones, type EstudioRcd, type EstudioRcdDatos } from '../../core/rcd';
import { flattenContainers } from '../../core/tree';
import { useObraStore, useToastStore } from '../../store';
import { getDomainRevision, undo } from '../../store/temporal';
import { CAPACIDADES_CONTENEDOR, partidasGestion } from '../../core/rcd/capitulo';
import { CampoNum, CampoTexto } from './Campos';
import styles from './Residuos.module.css';

const t3 = (n: number) => fmtNum(n, 3);
const m3 = (n: number | null) => (n == null ? '—' : fmtNum(n, 3));

/** 1.º, 3.º, 4.º, inventario, 7.º y fianza, con lo editable de cada uno. */
export function Estimacion({ r, datos }: { r: EstudioRcd; datos: EstudioRcdDatos }) {
  const setEstudio = useObraStore((s) => s.setEstudioRcd);
  const crearCapitulo = useObraStore((s) => s.crearCapituloGestionRcd);
  const [capacidad, setCapacidad] = useState(7);
  const chapters = useObraStore((s) => s.chapters);
  const [abierto, setAbierto] = useState<string | null>(null);
  // Códigos con el gestor desplegado aunque aún esté vacío (el gestor es opcional).
  const [conGestor, setConGestor] = useState<Set<string>>(new Set());
  const setDestino = (ler: string, patch: Partial<EstudioRcdDatos['destinos'][string]>) =>
    setEstudio({ destinos: { ...datos.destinos, [ler]: { ...datos.destinos[ler], ...patch } } });
  const contenedores = chapters.flatMap((ch) => [
    { id: ch.id, label: `${ch.code} · ${ch.title}` },
    ...flattenContainers(ch).map((f) => ({ id: f.sub.id, label: `${'  '.repeat(f.depth)}${f.sub.code} · ${f.sub.title}` })),
  ]);

  return (
    <>
      {r.avisos.length > 0 && (
        <div className={styles.avisos}>
          {r.avisos.map((a) => (
            <div key={a.id} className={styles.aviso}>
              <Icon name="alert" size={15} />
              <span>{a.texto}</span>
            </div>
          ))}
        </div>
      )}

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>1.º Estimación de la cantidad</div>
          <div className={styles.cita}>RD 105/2008, art. 4.1 a) 1.º</div>
        </div>
        {r.porCodigo.length === 0 ? (
          <p className={styles.nota}>Aún no hay residuos: confirma las propuestas de las partidas o, en obra nueva, elige los ratios en «Datos».</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={`ctable ${styles.table}`}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Residuo</th>
                  <th className={styles.r}>t</th>
                  <th className={styles.r} title="Volumen del escombro suelto (contenedor)">m³ aparentes</th>
                  <th className={styles.r} title="Volumen del material colocado">m³ en obra</th>
                </tr>
              </thead>
              <tbody>
                {r.porCodigo.map((f) => (
                  <Fragment key={f.ler}>
                    <tr>
                      <td className="mono">
                        <button
                          type="button"
                          className={styles.link}
                          aria-expanded={abierto === f.ler}
                          onClick={() => setAbierto(abierto === f.ler ? null : f.ler)}
                        >
                          {lerConAsterisco({ codigo: f.ler, peligroso: f.peligroso })}
                        </button>
                      </td>
                      <td>
                        {f.descripcion}
                        {f.incompleta && <span className={styles.peligroso}> · incompleta</span>}
                      </td>
                      <td className={`${styles.r} mono`}>{t3(f.t)}</td>
                      <td className={`${styles.r} mono`}>{m3(f.m3Aparente)}</td>
                      <td className={`${styles.r} mono`}>{m3(f.m3EnObra)}</td>
                    </tr>
                    {abierto === f.ler && (
                      <tr>
                        <td />
                        <td colSpan={4}>
                          <ul className={styles.origen}>
                            {f.origen.map((o, i) => (
                              <li key={i} className="mono">
                                {o.kind === 'partida' ? `${o.code} · ${o.formula}` : `${o.fuente}: ${o.formula}`}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total</td>
                  <td className={`${styles.r} mono`}>{t3(r.totales.t)}</td>
                  <td className={`${styles.r} mono`}>{m3(r.totales.m3Aparente)}</td>
                  <td className={`${styles.r} mono`}>{m3(r.totales.m3EnObra)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className={styles.nota}>Pulsa un código para ver de qué partidas o ratios sale cada tonelada.</p>
      </section>

      {r.porCodigo.length > 0 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>3.º Destino de cada residuo</div>
            <div className={styles.cita}>Ley 7/2022, anexos II y III · Decreto 73/2012, art. 86</div>
          </div>
          <div className={styles.tableWrap}>
            <table className={`ctable ${styles.table}`}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Operación</th>
                  <th>Destino</th>
                  <th title="Lo designa el contratista en su plan de gestión (RD 105/2008, art. 5); el estudio no lo exige">Gestor (opcional)</th>
                </tr>
              </thead>
              <tbody>
                {r.destinos.map((d) => (
                  <tr key={d.ler}>
                    <td className="mono">{lerConAsterisco({ codigo: d.ler, peligroso: d.peligroso })}</td>
                    <td>
                      <select
                        className={styles.select}
                        aria-label={`Operación para ${d.ler}`}
                        value={d.operacion ?? ''}
                        onChange={(e) => setDestino(d.ler, { operacion: e.target.value || null })}
                      >
                        <option value="">La indica el gestor</option>
                        {todasLasOperaciones().map((o) => (
                          <option key={o.codigo} value={o.codigo} title={o.nombre}>
                            {o.codigo} · {o.nombre.length > 48 ? `${o.nombre.slice(0, 46)}…` : o.nombre}
                          </option>
                        ))}
                      </select>
                      {d.porDefecto && <div className={styles.sub}>Propuesta por defecto</div>}
                    </td>
                    <td>
                      <CampoTexto ariaLabel={`Destino de ${d.ler}`} className={styles.wide} value={d.destino} onCommit={(v) => setDestino(d.ler, { destino: v })} />
                    </td>
                    <td>
                      {d.gestor || conGestor.has(d.ler) ? (
                        <div className={styles.pila}>
                          <CampoTexto
                            ariaLabel={`Gestor de ${d.ler}`}
                            placeholder="Nombre del gestor"
                            value={d.gestor?.nombre}
                            onCommit={(v) => setDestino(d.ler, { gestor: { nombre: v, autorizacion: d.gestor?.autorizacion ?? '' } })}
                          />
                          <CampoTexto
                            ariaLabel={`Autorización del gestor de ${d.ler}`}
                            placeholder="Nº de autorización"
                            value={d.gestor?.autorizacion}
                            onCommit={(v) => setDestino(d.ler, { gestor: { nombre: d.gestor?.nombre ?? '', autorizacion: v } })}
                          />
                        </div>
                      ) : (
                        <button type="button" className={`${styles.link} ${styles.sub}`} onClick={() => setConGestor(new Set(conGestor).add(d.ler))}>
                          + Añadir gestor
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {r.separacion.length > 0 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>4.º Separación en obra</div>
            <div className={styles.cita}>Ley 7/2022, art. 30 · RD 105/2008, art. 5.5</div>
          </div>
          <table className={`ctable ${styles.table}`}>
            <thead>
              <tr>
                <th>Fracción</th>
                <th className={styles.r}>t</th>
                <th>Se separa</th>
                <th>Por qué</th>
              </tr>
            </thead>
            <tbody>
              {r.separacion.map((s) => (
                <tr key={s.fraccion}>
                  <td>{s.nombre}</td>
                  <td className={`${styles.r} mono`}>{t3(s.t)}</td>
                  <td>{s.obligatoria ? 'Obligatoria' : 'No obligatoria'}</td>
                  <td>
                    {s.motivo} <span className={styles.sub}>({s.cita})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {r.alcance.inventario && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Inventario de residuos peligrosos</div>
            <div className={styles.cita}>RD 105/2008, art. 4.1 b)</div>
          </div>
          {r.inventario.length === 0 ? (
            <p className={styles.nota}>No se prevén residuos peligrosos en las partidas confirmadas.</p>
          ) : (
            <table className={`ctable ${styles.table}`}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Residuo</th>
                  <th>Elemento</th>
                  <th className={styles.r}>t</th>
                </tr>
              </thead>
              <tbody>
                {r.inventario.map((x) => (
                  <tr key={x.ler}>
                    <td className="mono">{x.ler}*</td>
                    <td>{x.descripcion}</td>
                    <td>{x.elemento}</td>
                    <td className={`${styles.r} mono`}>{t3(x.t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>7.º Valoración del coste de la gestión</div>
          <div className={styles.cita}>RD 105/2008, art. 4.1 a) 7.º: capítulo independiente del presupuesto</div>
        </div>
        <label className={styles.field}>
          Capítulo de gestión de residuos del presupuesto
          <select
            className={`${styles.select} ${styles.wide}`}
            value={datos.capituloGestion ?? ''}
            onChange={(e) => setEstudio({ capituloGestion: e.target.value || null })}
          >
            <option value="">Ninguno (precios por código)</option>
            {contenedores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {r.coste.modo === 'capitulo' ? (
          <table className={`ctable ${styles.table}`} style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Código</th>
                <th>Partida</th>
                <th className={styles.r}>Cantidad</th>
                <th className={styles.r}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {r.coste.partidas.map((x) => (
                <tr key={x.id}>
                  <td className="mono">{x.code}</td>
                  <td>{x.title}</td>
                  <td className={`${styles.r} mono`}>
                    {fmtNum(x.cantidad, 2)} {x.ud}
                  </td>
                  <td className={`${styles.r} mono`}>{fmtCents(x.importe)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total{r.coste.pctPem != null ? ` · ${fmtNum(r.coste.pctPem, 2)} % del PEM` : ''}</td>
                <td className={`${styles.r} mono`}>{fmtCents(r.coste.importe ?? 0)}</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <>
            {r.porCodigo.length > 0 && (
              <table className={`ctable ${styles.table}`} style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th className={styles.r}>t</th>
                    <th className={styles.r}>Precio de gestión</th>
                  </tr>
                </thead>
                <tbody>
                  {r.porCodigo.map((f) => (
                    <tr key={f.ler}>
                      <td className="mono">{f.ler}</td>
                      <td className={`${styles.r} mono`}>{t3(f.t)}</td>
                      <td className={styles.r}>
                        <CampoNum
                          ariaLabel={`Precio de gestión de ${f.ler}`}
                          unidad="€/t"
                          dec={2}
                          min={-10000}
                          value={datos.precios[f.ler]?.eurPorT ?? null}
                          onCommit={(v) => setEstudio({ precios: { ...datos.precios, [f.ler]: { eurPorT: v } } })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className={styles.nota}>
              {r.coste.modo === 'precios' && r.coste.importe != null
                ? `Total: ${fmtCents(r.coste.importe)}${r.coste.pctPem != null ? ` (${fmtNum(r.coste.pctPem, 2)} % del PEM)` : ''}.`
                : 'Enlaza el capítulo de gestión de residuos del presupuesto para que el estudio y el presupuesto digan lo mismo, o pon el precio de cada código.'}
            </p>
            {r.porCodigo.some((f) => f.t > 0) && (
              <div className={styles.btnRow} style={{ marginTop: 10 }}>
                <label className={styles.check}>
                  Contenedores de
                  <select
                    className={styles.select}
                    aria-label="Capacidad del contenedor"
                    value={capacidad}
                    onChange={(e) => setCapacidad(Number(e.target.value))}
                  >
                    {CAPACIDADES_CONTENEDOR.map((c) => (
                      <option key={c} value={c}>
                        {c} m³
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={`tcol ${styles.btn}`}
                  title="Por cada fracción que se separa, sus contenedores (m³ aparentes ÷ capacidad) y la entrega al gestor por código, en t. El transporte sale a 0 €: pon tú el precio. Cambia el PEM."
                  onClick={() => {
                    const { partidas, sinM3 } = partidasGestion(r, datos, capacidad);
                    const n = crearCapitulo(partidas);
                    const falta = sinM3.length ? `; sin m³ aparentes en ${sinM3.join(', ')}: sus contenedores van a 0` : '';
                    useToastStore
                      .getState()
                      .show(
                        `Capítulo «Gestión de residuos» creado con ${n} partida${n === 1 ? '' : 's'}: pon los precios del transporte, cambian el PEM${falta}`,
                        { label: 'Deshacer', run: () => undo() },
                        { rev: getDomainRevision(), tone: 'warn' },
                      );
                  }}
                >
                  <Icon name="plus" size={14} /> Crear el capítulo de gestión con estas cantidades
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Fianza</div>
          <div className={styles.cita}>RD 105/2008, art. 6.3 · Decreto 73/2012, arts. 80, 81 y 89</div>
        </div>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            Base del estudio (art. 6.3)
            <span className="mono">{r.fianza.baseEstudio != null ? fmtCents(r.fianza.baseEstudio) : '—'}</span>
          </div>
          <label className={styles.field}>
            PEM de toda la obra
            {/* Vacío = el del presupuesto; en un básico sin mediciones el presupuesto solo trae la gestión. */}
            <CampoNum
              ariaLabel="PEM de toda la obra"
              unidad="€"
              dec={2}
              min={0}
              placeholder={r.fianza.pemObra != null ? fmtNum(r.fianza.pemPresupuesto / 100, 2) : 'falta'}
              value={datos.pemObra ?? null}
              onCommit={(v) => setEstudio({ pemObra: v })}
            />
            <span className={styles.sub}>
              {r.fianza.pemDeclarado
                ? `Declarado. El presupuesto suma ${fmtCents(r.fianza.pemPresupuesto)}.`
                : r.fianza.pemObra != null
                  ? 'El del presupuesto. Escríbelo si el presupuesto no tiene toda la obra.'
                  : 'El presupuesto solo tiene la gestión: escribe el PEM de la obra (p. ej. el del proyecto básico).'}
            </span>
          </label>
          {r.fianza.minimoAndalucia && (
            <div className={styles.field}>
              Mínimo en Andalucía (art. 81.1)
              <span className="mono">{fmtCents(r.fianza.minimoAndalucia.importe)}</span>
              <span className={styles.sub}>
                {r.fianza.minimoAndalucia.reparto
                  .map((x) => `${x.pct} % de ${fmtCents(x.base)} (${x.supuesto === 'derribo' ? 'derribo' : x.supuesto === 'excavacion' ? 'excavación' : 'obra nueva'})`)
                  .join(' + ')}
              </span>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={!!datos.repartoFianza?.confirmado}
                  onChange={(e) => setEstudio({ repartoFianza: { confirmado: e.target.checked } })}
                />
                Reparto revisado
              </label>
            </div>
          )}
          <label className={styles.field}>
            Importe de la fianza
            <CampoNum
              ariaLabel="Importe de la fianza"
              unidad="€"
              dec={2}
              min={0}
              value={datos.fianza?.importe ?? null}
              onCommit={(v) => setEstudio({ fianza: { importe: v, criterio: datos.fianza?.criterio ?? '' } })}
            />
          </label>
          <label className={styles.field}>
            Criterio
            <CampoTexto
              ariaLabel="Criterio de la fianza"
              placeholder="Según la ordenanza municipal…"
              value={datos.fianza?.criterio}
              onCommit={(v) => setEstudio({ fianza: { importe: datos.fianza?.importe ?? null, criterio: v } })}
            />
          </label>
          <label className={styles.field}>
            Ordenanza municipal
            <CampoTexto
              ariaLabel="Ordenanza municipal de residuos"
              value={datos.ordenanza?.nombre}
              onCommit={(v) => setEstudio({ ordenanza: { nombre: v, articuloFianza: datos.ordenanza?.articuloFianza ?? '' } })}
            />
          </label>
          <label className={styles.field}>
            Artículo de la fianza
            <CampoTexto
              ariaLabel="Artículo de la fianza en la ordenanza"
              value={datos.ordenanza?.articuloFianza}
              onCommit={(v) => setEstudio({ ordenanza: { nombre: datos.ordenanza?.nombre ?? '', articuloFianza: v } })}
            />
          </label>
        </div>
      </section>
    </>
  );
}

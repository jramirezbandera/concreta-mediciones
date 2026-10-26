import { useState } from 'react';
import { Icon } from '../../components';
import { fmtCents, fmtNum } from '../../core/money';
import { calcularPlanCalidad } from '../../core/pcc/calculo';
import { tomarPrecios } from '../../core/pcc/precios';
import type { FilaValoracion, PlanCalidad, PlanCalidadDatos, PrecioCopiado } from '../../core/pcc/tipos';
import { flattenContainers } from '../../core/tree';
import { useSessionStore } from '../../persist';
import { useObraStore, useToastStore } from '../../store';
import { getDomainRevision, undo } from '../../store/temporal';
import { loadObraRefSource } from '../referencia/obraSource';
import { CampoNum } from '../residuos/Campos';
import { hoyIso } from '../residuos/formato';
import { QUIEN } from './nombres';
import styles from '../residuos/Residuos.module.css';
import c from './Calidad.module.css';

interface Previa {
  banco: string;
  precios: Record<string, PrecioCopiado>;
  /** Filas de la valoración con precio del banco / sin código en él. */
  con: number;
  sin: number;
  antes: number;
  despues: number;
}

/** De dónde sale el precio (§8): sin coeficientes ocultos (K-PCC.67). */
function Fuente({ f }: { f: FilaValoracion }) {
  const p = f.precio;
  const txt =
    p.fuente === 'banco'
      ? `${p.banco ?? 'Banco'}${p.codigo ? ` · ${p.codigo}` : ''}${p.fecha ? ` · ${p.fecha}` : ''}`
      : p.fuente === 'junta'
        ? `Hoja de la Junta${p.fecha ? `, ${p.fecha}` : ''}`
        : p.fuente === 'manual'
          ? 'Tecleado'
          : 'Pendiente';
  return <span className={`${c.fuente} ${p.fuente === 'pendiente' ? c.pendiente : ''}`}>{txt}</span>;
}

/** Valoración económica del plan: lo que paga la propiedad, con la fuente de cada precio. */
export function Valoracion({ r, datos }: { r: PlanCalidad; datos: PlanCalidadDatos }) {
  const set = useObraStore((s) => s.setPlanCalidad);
  const tomar = useObraStore((s) => s.tomarPreciosPlan);
  const chapters = useObraStore((s) => s.chapters);
  const obras = useSessionStore((s) => s.obras);
  const activa = useSessionStore((s) => s.activeId);
  const bancos = obras.filter((o) => o.kind === 'reference' && o.id !== activa);
  const [bancoId, setBancoId] = useState('');
  const [cargando, setCargando] = useState(false);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const contenedores = chapters.flatMap((ch) => [
    { id: ch.id, label: `${ch.code} · ${ch.title}` },
    ...flattenContainers(ch).map((f) => ({ id: f.sub.id, label: `${'  '.repeat(f.depth)}${f.sub.code} · ${f.sub.title}` })),
  ]);
  const elegido = bancos.find((b) => b.id === bancoId) ?? bancos[0];

  const cargar = async () => {
    if (!elegido) return;
    setCargando(true);
    setPrevia(null);
    try {
      const fuente = await loadObraRefSource(elegido.id, elegido.name);
      if (!fuente || fuente === 'mas-nueva') {
        useToastStore.getState().show(fuente === 'mas-nueva' ? 'El banco se guardó con una versión más nueva: recarga la página.' : 'No se pudo cargar el banco.', undefined, { tone: 'error' });
        return;
      }
      // Los ensayos del plan, también los no marcados: si se marcan después, ya tienen su precio.
      const ensayos = [...new Set([...r.recepcion.flatMap((b) => b.ensayos), ...r.obraTerminada.flatMap((o) => o.filas)].map((f) => f.ensayo))];
      const { precios } = tomarPrecios(fuente, hoyIso(), ensayos);
      // El cálculo no lee bancos (A1): el total con los precios nuevos se calcula aparte, sin aplicarlos.
      const s = useObraStore.getState();
      const plan = { ...datos, precios: { ...(datos.precios ?? {}), ...precios } };
      const nuevo = calcularPlanCalidad({ chapters: s.chapters, partidas: s.partidas, banco: s.recursos, rates: s.rates, obra: s.obra, plan, hoy: hoyIso() });
      const con = r.valoracion.filter((v) => precios[v.ensayo]).length;
      setPrevia({ banco: fuente.name, precios, con, sin: r.valoracion.length - con, antes: r.total, despues: nuevo.total });
    } catch {
      useToastStore.getState().show('No se pudo cargar el banco.', undefined, { tone: 'error' });
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Valoración económica</div>
          <div className={styles.cita}>CTE parte I, anejo I: el presupuesto incluirá la valoración del control</div>
        </div>

        <div className={styles.btnRow}>
          {bancos.length > 0 ? (
            <>
              <label className={styles.field}>
                Banco de precios
                <select className={`${styles.select} ${styles.wide}`} value={elegido?.id ?? ''} onChange={(e) => setBancoId(e.target.value)}>
                  {bancos.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className={`tcol ${styles.btn}`} disabled={cargando} onClick={() => void cargar()} style={{ alignSelf: 'flex-end' }}>
                <Icon name={cargando ? 'loader' : 'download'} size={14} /> Tomar precios de un banco
              </button>
            </>
          ) : (
            <p className={styles.nota}>
              Sin bancos de referencia cargados: los precios salen de la hoja de la Junta o los tecleas. Añade la BCCA desde el panel Referencia para copiar sus precios.
            </p>
          )}
        </div>
        {previa && (
          <div className={c.preview} role="status">
            <span>
              Con «{previa.banco}» el total pasaría de <span className="mono">{fmtCents(previa.antes)}</span> a{' '}
              <span className="mono">{fmtCents(previa.despues)}</span>: {previa.con} {previa.con === 1 ? 'precio' : 'precios'} del banco
              {previa.sin > 0 ? `; ${previa.sin} sin código en el banco siguen con su fuente` : ''}.
            </span>
            <span className={styles.btnRow}>
              <button
                type="button"
                className={`tcol ${styles.btnPrimary}`}
                onClick={() => {
                  tomar(previa.precios);
                  setPrevia(null);
                  useToastStore.getState().show(`Precios de «${previa.banco}» copiados al plan`, { label: 'Deshacer', run: () => undo() }, { rev: getDomainRevision() });
                }}
              >
                <Icon name="check" size={14} /> Aplicar
              </button>
              <button type="button" className={`tcol ${styles.btn}`} onClick={() => setPrevia(null)}>
                Cancelar
              </button>
            </span>
          </div>
        )}

        {r.valoracion.length === 0 ? (
          <p className={styles.nota}>Ningún ensayo a cargo de la propiedad todavía.</p>
        ) : (
          <div className={styles.tableWrap} style={{ marginTop: 12 }}>
            <table className={`ctable ${styles.table}`}>
              <thead>
                <tr>
                  <th>Ensayo</th>
                  <th className={styles.r}>Cantidad</th>
                  <th className={styles.r}>Precio</th>
                  <th className={styles.r}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {r.valoracion.map((v) => {
                  const editable = v.precio.fuente === 'manual' || v.precio.fuente === 'pendiente';
                  return (
                    <tr key={v.ensayo}>
                      <td>
                        {v.descripcion}
                        <span className={c.regla}>
                          {v.norma ? `${v.norma} · ` : ''}
                          {v.regla}
                        </span>
                      </td>
                      <td className={`mono ${styles.r}`}>
                        {v.cantidad} {v.unidad}
                        {v.precios !== v.cantidad && <span className={c.fuente}>{v.precios} precios</span>}
                      </td>
                      <td className={styles.r}>
                        {editable ? (
                          <CampoNum
                            ariaLabel={`Precio de ${v.descripcion}`}
                            className={c.num}
                            unidad="€"
                            dec={2}
                            min={0}
                            value={datos.preciosManuales?.[v.ensayo]}
                            onCommit={(n) => {
                              const m = { ...(datos.preciosManuales ?? {}) };
                              if (n == null) delete m[v.ensayo];
                              else m[v.ensayo] = n;
                              set({ preciosManuales: m });
                            }}
                          />
                        ) : (
                          <span className="mono">{fmtNum(v.precio.valor, 2)} €</span>
                        )}
                        <Fuente f={v} />
                      </td>
                      <td className={`mono ${styles.r}`}>{v.importe == null ? '—' : fmtCents(v.importe)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total{r.totalCompleto ? '' : ' (faltan precios)'}</td>
                  <td className={`mono ${styles.r}`}>{fmtCents(r.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {r.porcentaje && (
          <p className={styles.nota}>
            {fmtNum(r.porcentaje.valor, 2)} % del PEM sin el capítulo de control ({fmtCents(r.porcentaje.basePem)}). Es un dato: ninguna norma fija un mínimo.
          </p>
        )}
      </section>

      {r.aCargoDeOtros.length > 0 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>A cargo de otros agentes</div>
            <div className={styles.cita}>Se listan sin coste: no van en la valoración</div>
          </div>
          <div className={styles.tableWrap}>
            <table className={`ctable ${styles.table}`}>
              <tbody>
                {r.aCargoDeOtros.map((f) => (
                  <tr key={`${f.ensayo}:${f.prueba ?? ''}`}>
                    <td>
                      {f.descripcion}
                      <span className={c.regla}>
                        {QUIEN[f.quien]}
                        {f.cita ? ` · ${f.cita}` : ''}
                      </span>
                    </td>
                    <td className={`mono ${styles.r}`}>
                      {f.cantidad} {f.unidad}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Capítulo de control del presupuesto</div>
          <div className={styles.cita}>Sus partidas no disparan control y no cuentan en la base del %</div>
        </div>
        <label className={styles.field}>
          Capítulo de control de calidad
          <select
            className={`${styles.select} ${styles.wide}`}
            value={datos.capituloControl ?? ''}
            onChange={(e) => set({ capituloControl: e.target.value || null })}
          >
            <option value="">Ninguno</option>
            {contenedores.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
      </section>
    </>
  );
}

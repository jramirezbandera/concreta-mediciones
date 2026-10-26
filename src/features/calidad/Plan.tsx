import type { FilaControl, PlanCalidad, PlanCalidadDatos, PruebaObraTerminada } from '../../core/pcc/tipos';
import { useObraStore } from '../../store';
import { QUIEN } from './nombres';
import styles from '../residuos/Residuos.module.css';
import c from './Calidad.module.css';

const OBLIG: Record<PruebaObraTerminada['oblig'], string> = {
  R: 'Obligatoria por reglamento',
  P: 'A criterio del proyecto',
  C: 'Según un dato de la obra',
};

/** El plan: recepción, ejecución y obra terminada por familia (CTE I, art. 7). */
export function Plan({ r, datos }: { r: PlanCalidad; datos: PlanCalidadDatos }) {
  const set = useObraStore((s) => s.setPlanCalidad);
  const marcar = (id: string, v: boolean) => set({ marcados: { ...(datos.marcados ?? {}), [id]: v } });
  const aCargo = (id: string, v: 'laboratorio' | 'instalador') => set({ aCargo: { ...(datos.aCargo ?? {}), [id]: v } });

  if (!r.recepcion.length && !r.obraTerminada.length)
    return (
      <section className={styles.card}>
        <div className={styles.cardTitle}>El plan está vacío</div>
        <p className={styles.nota}>Confirma el control de las partidas en «Partidas»: cada familia confirmada trae su recepción, su ejecución y sus pruebas.</p>
      </section>
    );

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Control de recepción</div>
          <div className={styles.cita}>CTE parte I, art. 7.2</div>
        </div>
        {r.recepcion.map((b) => (
          <div key={b.familia} className={c.bloque}>
            <div className={c.bloqueHead}>
              <span className={c.bloqueTitle}>{b.nombre}</span>
              {b.partidas.length > 0 && (
                <span className={styles.sub} title={b.partidas.map((p) => `${p.code} ${p.title}`).join('\n')}>
                  {b.partidas.length} {b.partidas.length === 1 ? 'partida' : 'partidas'}
                </span>
              )}
            </div>
            <details>
              <summary className={styles.sub}>Recepción documental ({b.documental.length})</summary>
              <ul className={c.documental}>
                {b.documental.map((d, i) => (
                  <li key={i}>
                    {d.texto} <span className={styles.sub}>({d.cita})</span>
                  </li>
                ))}
              </ul>
            </details>
            {b.ensayos.length > 0 && <TablaEnsayos filas={b.ensayos} onMarcar={marcar} />}
          </div>
        ))}
      </section>

      {r.ejecucion.length > 0 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Control de ejecución</div>
            <div className={styles.cita}>CTE parte I, art. 7.3</div>
          </div>
          {r.ejecucion.map((b) => (
            <div key={b.familia} className={c.bloque}>
              <div className={c.bloqueTitle}>{b.nombre}</div>
              <div className={styles.tableWrap}>
                <table className={`ctable ${styles.table}`}>
                  <tbody>
                    {b.inspecciones.map((i) => (
                      <tr key={i.id}>
                        <td>
                          {i.fase}: {i.comprobacion}
                          <span className={c.regla}>{i.cuenta}</span>
                        </td>
                        <td className={`mono ${styles.r} ${i.cantidad == null ? c.pendiente : ''}`}>{i.cantidad ?? 'falta'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      )}

      {r.obraTerminada.length > 0 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Control de la obra terminada</div>
            <div className={styles.cita}>CTE parte I, art. 7.4</div>
          </div>
          {r.obraTerminada.map((o) => {
            const deInstalador = o.quien === 'INST' || datos.aCargo?.[o.id] === 'laboratorio';
            return (
              <div key={o.id} className={c.bloque}>
                <div className={c.bloqueHead}>
                  {o.oblig === 'P' ? (
                    <label className={styles.check}>
                      <input type="checkbox" checked={o.incluida} onChange={(e) => marcar(o.id, e.target.checked)} />
                      <span className={c.bloqueTitle}>{o.nombre}</span>
                    </label>
                  ) : (
                    <span className={c.bloqueTitle}>{o.nombre}</span>
                  )}
                  <span className={styles.sub}>
                    {OBLIG[o.oblig]} · {o.cita}
                  </span>
                </div>
                {deInstalador && o.incluida && (
                  <div className={styles.btnRow}>
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        checked={o.quien === 'LAB'}
                        onChange={(e) => aCargo(o.id, e.target.checked ? 'laboratorio' : 'instalador')}
                      />
                      La hace un laboratorio y va en la valoración
                    </label>
                    {o.quien === 'INST' && <span className={styles.sub}>A cargo de la empresa instaladora, sin coste en la valoración.</span>}
                  </div>
                )}
                {o.incluida ? (
                  <TablaEnsayos filas={o.filas} />
                ) : (
                  <p className={styles.nota}>{o.oblig === 'C' ? 'No aplica con los datos de la obra.' : 'No incluida: márcala para añadirla al plan.'}</p>
                )}
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

/** Ensayos con su cuenta; los de nivel 2 y 3 (y las alternativas) a casilla (D8). */
function TablaEnsayos({ filas, onMarcar }: { filas: FilaControl[]; onMarcar?: (id: string, v: boolean) => void }) {
  return (
    <div className={styles.tableWrap}>
      <table className={`ctable ${styles.table}`}>
        <tbody>
          {filas.map((f) => {
            const fuera = f.estado === 'noMarcado';
            return (
              <tr key={`${f.ensayo}:${f.prueba ?? ''}`} className={fuera ? c.apagada : undefined}>
                {onMarcar && (
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Incluir ${f.descripcion}`}
                      checked={f.estado === 'incluido'}
                      disabled={f.estado === 'aCriterio'}
                      onChange={(e) => onMarcar(f.ensayo, e.target.checked)}
                    />
                  </td>
                )}
                <td>
                  {f.descripcion}
                  <span className={c.regla}>
                    {[f.norma, f.nivel ? `nivel ${f.nivel}` : null, f.estado === 'aCriterio' ? QUIEN.DF : f.estado === 'aCargoDeOtros' ? QUIEN[f.quien] : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {!fuera && f.estado !== 'aCriterio' && <span className={c.regla}>{f.regla}</span>}
                </td>
                <td className={`mono ${styles.r}`}>{f.estado === 'aCriterio' ? '—' : `${f.cantidad} ${f.unidad}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

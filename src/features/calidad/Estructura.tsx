import { fmtNum } from '../../core/money';
import type { DatosGrupo, GrupoHormigon, OrigenDato, PlanCalidad, PlanCalidadDatos } from '../../core/pcc/tipos';
import { useObraStore } from '../../store';
import { CampoNum } from '../residuos/Campos';
import { NOMBRE_FILA } from './nombres';
import styles from '../residuos/Residuos.module.css';
import c from './Calidad.module.css';

const ORIGEN: Record<NonNullable<OrigenDato>, string> = {
  grupo: 'del grupo',
  obra: 'de la obra',
  partidas: 'de las partidas',
};

const NOMBRE_CONTROL = { ferralla: 'Ferralla armada (art. 59.2)', barras: 'Barras elaboradas en obra (art. 58)', mallas: 'Mallas electrosoldadas (59.1.4.2)' };
const NOMBRE_EJECUCION = { cimentacion: 'Cimentación', flexion: 'Elementos a flexión', pilares_muros: 'Pilares y muros' };
const NOMBRE_ENSAYO: Record<string, string> = {
  traccion: 'tracción',
  doblado: 'doblado',
  masaMetro: 'masa por metro',
  geometria: 'geometría',
  despegue: 'despegue',
  dimensiones: 'dimensiones',
  quimica: 'química',
};

/** Estructura: lotes de hormigón por grupo, durabilidad, armaduras y ejecución (§5). */
export function Estructura({ r, datos }: { r: PlanCalidad; datos: PlanCalidadDatos }) {
  const set = useObraStore((s) => s.setPlanCalidad);
  const e = r.estructura;
  const setGrupo = (clave: string, patch: Partial<DatosGrupo>) =>
    set({ grupos: { ...(datos.grupos ?? {}), [clave]: { ...(datos.grupos?.[clave] ?? {}), ...patch } } });
  const hormigon = datos.hormigon ?? {};
  const acero = datos.acero ?? {};
  const ejecucion = datos.ejecucion ?? {};

  if (!e.grupos.length && !e.armaduras.length && !e.ejecucion.lotes.length)
    return (
      <section className={styles.card}>
        <div className={styles.cardTitle}>Sin estructura de hormigón</div>
        <p className={styles.nota}>
          Ninguna partida confirmada es de hormigón estructural ni de acero para armar. Confírmalas en «Partidas» y sus lotes salen aquí.
        </p>
      </section>
    );

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Hormigón</div>
          <div className={styles.cita}>Código Estructural, art. 57.5.4 y tabla 57.5.4.1</div>
        </div>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            Distintivo de calidad
            <select
              className={styles.select}
              value={hormigon.distintivo ?? 'sin'}
              onChange={(ev) => set({ hormigon: { ...hormigon, distintivo: ev.target.value as 'sin' | 'con' | 'dispersion' } })}
            >
              <option value="sin">Sin distintivo (lo más exigente)</option>
              <option value="con">Con distintivo oficialmente reconocido</option>
              <option value="dispersion">Con dispersión certificada</option>
            </select>
          </label>
          <label className={styles.field}>
            Control de la resistencia
            <select
              className={styles.select}
              value={hormigon.modalidad ?? 'estadistico'}
              onChange={(ev) => set({ hormigon: { ...hormigon, modalidad: ev.target.value as 'estadistico' | 'cien' } })}
            >
              <option value="estadistico">Estadístico, por lotes</option>
              <option value="cien">Al 100 % (todas las amasadas)</option>
            </select>
          </label>
          <label className={styles.field}>
            Volumen de la cuba
            <CampoNum ariaLabel="Volumen de la cuba" unidad="m³" value={hormigon.cubaM3} min={1} max={15} placeholder="—" onCommit={(v) => set({ hormigon: { ...hormigon, cubaM3: v } })} />
          </label>
        </div>

        <div className={styles.tableWrap}>
          <table className={`ctable ${styles.table}`}>
            <thead>
              <tr>
                <th>Grupo</th>
                <th className={styles.r}>Volumen</th>
                <th>Superficie</th>
                <th>Plantas</th>
                <th>Semanas</th>
                <th className={styles.r}>Lotes</th>
                <th className={styles.r}>Amasadas</th>
              </tr>
            </thead>
            <tbody>
              {e.grupos.map((g) => (
                <FilaGrupo key={g.clave} g={g} datos={datos.grupos?.[g.clave] ?? {}} onPatch={(patch) => setGrupo(g.clave, patch)} />
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className={`mono ${styles.r}`}>{fmtNum(e.grupos.reduce((s, g) => s + g.volumen, 0), 2)} m³</td>
                <td colSpan={3} />
                <td className={`mono ${styles.r}`}>{e.totales.lotes}</td>
                <td className={`mono ${styles.r}`}>{e.totales.amasadas}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className={styles.nota}>
          {e.totales.probetas} probetas. Superficie y plantas se toman de la obra (en «Datos») si el grupo no dice otra cosa; el dato del grupo manda.
        </p>
        <p className={styles.nota}>{e.indirecto.motivo}</p>
      </section>

      {e.durabilidad.length > 0 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Durabilidad</div>
            <div className={styles.cita}>Código Estructural, art. 57.5.3</div>
          </div>
          <div className={styles.tableWrap}>
            <table className={`ctable ${styles.table}`}>
              <thead>
                <tr>
                  <th>Dosificación</th>
                  <th>Meses de suministro</th>
                  <th className={styles.r}>Penetración de agua</th>
                  <th className={styles.r}>Aire ocluido</th>
                </tr>
              </thead>
              <tbody>
                {e.durabilidad.map((d) => (
                  <tr key={d.dosificacion}>
                    <td>
                      <span className="mono">{d.designacion}</span>
                      <span className={c.regla}>{d.cuenta}</span>
                    </td>
                    <td>
                      <CampoNum
                        ariaLabel={`Meses de suministro de ${d.dosificacion}`}
                        className={c.num}
                        value={datos.dosificaciones?.[d.dosificacion]?.meses}
                        min={0}
                        onCommit={(v) => set({ dosificaciones: { ...(datos.dosificaciones ?? {}), [d.dosificacion]: { meses: v } } })}
                      />
                    </td>
                    <td className={`mono ${styles.r}`}>{d.penetracion}</td>
                    <td className={`mono ${styles.r}`}>{d.aireOcluido}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {e.armaduras.length > 0 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Armaduras</div>
            <div className={styles.cita}>Código Estructural, arts. 58 y 59</div>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              Ferralla
              <select
                className={styles.select}
                value={acero.procedencia ?? 'taller'}
                onChange={(ev) => set({ acero: { ...acero, procedencia: ev.target.value as 'taller' | 'obra' } })}
              >
                <option value="taller">De taller (art. 59.2)</option>
                <option value="obra">Elaborada en obra (art. 58)</option>
              </select>
            </label>
            <label className={styles.field}>
              Soldadura
              <select
                className={styles.select}
                value={acero.soldadura ?? 'no'}
                onChange={(ev) => set({ acero: { ...acero, soldadura: ev.target.value as 'no' | 'noResistente' | 'resistente' } })}
              >
                <option value="no">Sin soldadura</option>
                <option value="noResistente">Soldadura no resistente</option>
                <option value="resistente">Soldadura resistente</option>
              </select>
            </label>
            <div className={`${styles.field} ${styles.fullRow}`}>
              <div className={styles.checks}>
                <label className={styles.check}>
                  <input type="checkbox" checked={!!acero.enderezado} onChange={(ev) => set({ acero: { ...acero, enderezado: ev.target.checked } })} />
                  Con enderezado
                </label>
                {(['barras', 'mallas', 'ferralla'] as const).map((k) => (
                  <label key={k} className={styles.check}>
                    <input
                      type="checkbox"
                      checked={!!acero.distintivos?.[k]}
                      onChange={(ev) => set({ acero: { ...acero, distintivos: { ...(acero.distintivos ?? {}), [k]: ev.target.checked } } })}
                    />
                    {k === 'barras' ? 'Barras' : k === 'mallas' ? 'Mallas' : 'Ferralla'} con distintivo
                  </label>
                ))}
              </div>
            </div>
          </div>
          {e.armaduras.map((a) => (
            <div key={a.control} className={c.bloque}>
              <div className={c.bloqueHead}>
                <span className={c.bloqueTitle}>{NOMBRE_CONTROL[a.control]}</span>
                <span className="mono">
                  {fmtNum(a.kg, 0)} kg · {a.lotes} {a.lotes === 1 ? 'lote' : 'lotes'}
                </span>
              </div>
              <div className={styles.sub}>
                {a.distintivo
                  ? 'Con distintivo: solo la documentación.'
                  : Object.entries(a.ensayos)
                      .filter(([, n]) => n)
                      .map(([k, n]) => `${n} de ${NOMBRE_ENSAYO[k] ?? k}`)
                      .join(' · ')}
              </div>
              <span className={c.regla}>{a.cuenta}</span>
              {a.notas.map((n) => (
                <span key={n} className={c.regla}>
                  {n}
                </span>
              ))}
            </div>
          ))}
        </section>
      )}

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Control de ejecución</div>
          <div className={styles.cita}>Código Estructural, arts. 17 y 64 y anejo 15</div>
        </div>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            Nivel
            <select
              className={styles.select}
              value={ejecucion.nivel ?? 'normal'}
              onChange={(ev) => set({ ejecucion: { ...ejecucion, nivel: ev.target.value as 'normal' | 'intenso' } })}
            >
              <option value="normal">Normal</option>
              <option value="intenso">Intenso</option>
            </select>
          </label>
          <label className={styles.field}>
            Opción del art. 17
            <select
              className={styles.select}
              value={ejecucion.opcion ?? 'A'}
              onChange={(ev) => set({ ejecucion: { ...ejecucion, opcion: ev.target.value as 'A' | 'B' } })}
            >
              <option value="A">A: control del constructor</option>
              <option value="B">B: contraste de la dirección facultativa</option>
            </select>
          </label>
        </div>
        {e.ejecucion.lotes.length === 0 ? (
          <p className={styles.nota}>Sin lotes de ejecución.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={`ctable ${styles.table}`}>
              <tbody>
                {e.ejecucion.lotes.map((l) => (
                  <tr key={l.fila}>
                    <td>
                      {NOMBRE_EJECUCION[l.fila]}
                      <span className={c.regla}>{l.cuenta}</span>
                    </td>
                    <td className={`mono ${styles.r}`}>
                      {l.lotes} {l.lotes === 1 ? 'lote' : 'lotes'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/** Un grupo de hormigón con sus datos editables en la propia fila y su cuenta en vivo. */
function FilaGrupo({ g, datos, onPatch }: { g: GrupoHormigon; datos: DatosGrupo; onPatch: (patch: Partial<DatosGrupo>) => void }) {
  const cimentacion = g.fila === 'cim_superficial' || g.fila === 'cim_mayor_200';
  const de = (o: OrigenDato) => (o && o !== 'grupo' ? ORIGEN[o] : undefined);
  return (
    <>
      <tr>
        <td>
          <span className="mono">{g.designacion.texto}</span>
          <span className={c.regla}>
            {NOMBRE_FILA[g.fila]} · {g.partidas.length} {g.partidas.length === 1 ? 'partida' : 'partidas'}
          </span>
        </td>
        <td className={`mono ${styles.r}`}>{fmtNum(g.volumen, 2)} m³</td>
        <td>
          <CampoNum
            ariaLabel={`Superficie de ${g.clave}`}
            className={c.num}
            unidad="m²"
            value={datos.superficie ?? null}
            // En cimentación la tabla 57.5.4.1 no lotifica por superficie: solo cuenta en ejecución.
            placeholder={g.superficie.valor != null ? fmtNum(g.superficie.valor, 0) : cimentacion ? '—' : 'falta'}
            min={0}
            onCommit={(v) => onPatch({ superficie: v })}
          />
          {de(g.superficie.origen) && <span className={c.regla}>{de(g.superficie.origen)}</span>}
        </td>
        <td>
          {cimentacion ? (
            <span className={styles.sub}>no aplica</span>
          ) : (
            <>
              <CampoNum
                ariaLabel={`Plantas de ${g.clave}`}
                className={c.num}
                value={datos.plantas ?? null}
                placeholder={g.plantas.valor != null ? fmtNum(g.plantas.valor, 0) : 'falta'}
                min={0}
                dec={0}
                onCommit={(v) => onPatch({ plantas: v })}
              />
              {de(g.plantas.origen) && <span className={c.regla}>{de(g.plantas.origen)}</span>}
            </>
          )}
        </td>
        <td>
          <CampoNum
            ariaLabel={`Semanas de ${g.clave}`}
            className={c.num}
            value={datos.semanas ?? null}
            placeholder={g.semanas != null ? fmtNum(g.semanas, 0) : '—'}
            min={0}
            dec={0}
            onCommit={(v) => onPatch({ semanas: v })}
          />
        </td>
        <td className={`mono ${styles.r}`}>{g.lotes ?? '—'}</td>
        <td className={`mono ${styles.r}`}>{g.amasadas}</td>
      </tr>
      <tr>
        <td colSpan={7}>
          <span className={c.regla}>{g.cuenta}</span>
          {g.notas.map((n) => (
            <span key={n} className={c.regla}>
              {n}
            </span>
          ))}
          {(cimentacion || g.fila === 'pilares_muros') && (
            <div className={styles.compGrid} style={{ marginTop: 6 }}>
              {cimentacion && (
                <label className={styles.field}>
                  Elementos de cimentación (lotes de ejecución)
                  <CampoNum ariaLabel={`Elementos de cimentación de ${g.clave}`} className={c.num} value={datos.elementos} min={0} dec={0} placeholder="—" onCommit={(v) => onPatch({ elementos: v })} />
                </label>
              )}
              {g.fila === 'pilares_muros' && (
                <label className={styles.field}>
                  Metros de muro (lotes de ejecución)
                  <CampoNum ariaLabel={`Metros de muro de ${g.clave}`} className={c.num} unidad="m" value={datos.muroM} min={0} placeholder="—" onCommit={(v) => onPatch({ muroM: v })} />
                </label>
              )}
            </div>
          )}
        </td>
      </tr>
    </>
  );
}

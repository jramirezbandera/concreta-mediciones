import { comunidadDeProvincia } from '../../core/rcd/calculo';
import type { DatosFamilia, PlanCalidad, PlanCalidadDatos } from '../../core/pcc/tipos';
import { useObraStore } from '../../store';
import { CampoNum } from '../residuos/Campos';
import styles from '../residuos/Residuos.module.css';
import c from './Calidad.module.css';

type CampoFamilia = 'tipos' | 'procedencias' | 'dias' | 'pilotes' | 'paneles' | 'm3' | 'diametro';
const CAMPO: Record<CampoFamilia, [string, string | undefined]> = {
  tipos: ['Tipos de producto', undefined],
  procedencias: ['Procedencias', undefined],
  dias: ['Días de trabajo', undefined],
  pilotes: ['Pilotes, micropilotes o anclajes', 'ud'],
  paneles: ['Paneles', 'ud'],
  m3: ['Hormigón', 'm³'],
  diametro: ['Diámetro de los pilotes', 'mm'],
};
/** Datos que pide cada familia, además de los tipos de producto. */
const POR_FAMILIA: Record<string, CampoFamilia[]> = {
  micropilotes: ['pilotes', 'dias'],
  pilotes: ['pilotes', 'm3', 'diametro'],
  pantallas: ['paneles', 'dias', 'm3'],
  anclajes: ['pilotes'],
  excavacion: ['procedencias'],
  relleno: ['procedencias'],
};
/** Ids de pendientes que no son un recuento de unidades (`dato:familia:clave`). */
const NO_UNIDADES = new Set(['pilotes', 'm3', 'paneles', 'dias-m3', 'soldadura']);

/** Recuentos que no salen del presupuesto (tramos, bajantes…) y que el plan está pidiendo. */
function unidadesPedidas(r: PlanCalidad, familia: string): string[] {
  const out: string[] = [];
  for (const p of r.pendientes) {
    const m = /^dato:([^:]+):(.+)$/.exec(p.id);
    if (!m || m[1] !== familia || NO_UNIDADES.has(m[2]!) || /^(j\d|app-)/.test(m[2]!)) continue;
    out.push(m[2]!);
  }
  return out;
}

/** Datos del plan que el presupuesto no trae (§6). */
export function DatosPlan({ r, datos }: { r: PlanCalidad; datos: PlanCalidadDatos }) {
  const set = useObraStore((s) => s.setPlanCalidad);
  const provincia = useObraStore((s) => (typeof s.obra.provincia === 'string' ? s.obra.provincia : ''));
  const deduce = comunidadDeProvincia(provincia);
  const setFamilia = (id: string, patch: Partial<DatosFamilia>) =>
    set({ familias: { ...(datos.familias ?? {}), [id]: { ...(datos.familias?.[id] ?? {}), ...patch } } });
  const triestado = (v: boolean | null | undefined) => (v == null ? '' : v ? 'si' : 'no');
  const deTriestado = (v: string) => (v === '' ? null : v === 'si');
  const plurifamiliar = (datos.viviendas ?? (datos.unifamiliar ? 1 : 0)) > 1 || datos.unifamiliar === false;
  const andalucia = r.comunidad === 'andalucia';
  const familias = r.recepcion.filter((b) => b.partidas.length > 0);

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>La obra</div>
        </div>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            Fecha del plan
            <input type="date" className={styles.input} value={datos.fecha ?? ''} onChange={(e) => set({ fecha: e.target.value || null })} />
            {!datos.fecha && <span className={styles.sub}>Sin fecha: se usa la de hoy.</span>}
          </label>
          <label className={styles.field}>
            Comunidad autónoma
            <select
              className={styles.select}
              value={datos.comunidad ?? ''}
              onChange={(e) => set({ comunidad: (e.target.value || null) as PlanCalidadDatos['comunidad'] })}
            >
              <option value="">{deduce ? `De la provincia (${deduce === 'andalucia' ? 'Andalucía' : 'otra'})` : 'Falta la provincia de la obra'}</option>
              <option value="andalucia">Andalucía</option>
              <option value="otra">Otra (solo normativa estatal)</option>
            </select>
          </label>
          <label className={styles.field}>
            Uso
            <select className={styles.select} value={datos.uso ?? ''} onChange={(e) => set({ uso: (e.target.value || null) as PlanCalidadDatos['uso'] })}>
              <option value="">Sin indicar</option>
              <option value="vivienda">Vivienda</option>
              <option value="otro">Otro uso</option>
            </select>
          </label>
          <label className={styles.field}>
            Tipo de edificio
            <select
              className={styles.select}
              value={datos.unifamiliar == null ? '' : datos.unifamiliar ? (datos.aislada ? 'aislada' : 'unifamiliar') : 'plurifamiliar'}
              onChange={(e) => {
                const v = e.target.value;
                set({ unifamiliar: v === '' ? null : v !== 'plurifamiliar', aislada: v === '' ? null : v === 'aislada' });
              }}
            >
              <option value="">Sin indicar</option>
              <option value="unifamiliar">Unifamiliar entre medianeras o pareada</option>
              <option value="aislada">Unifamiliar aislada</option>
              <option value="plurifamiliar">Plurifamiliar o varias unidades</option>
            </select>
          </label>
          <label className={styles.field}>
            Viviendas o unidades de uso
            <CampoNum
              ariaLabel="Número de viviendas"
              value={datos.viviendas}
              min={1}
              dec={0}
              placeholder={datos.unifamiliar ? '1' : 'falta'}
              onCommit={(v) => set({ viviendas: v })}
            />
          </label>
          <label className={styles.field}>
            Superficie construida
            <CampoNum ariaLabel="Superficie construida" unidad="m²" value={datos.superficieConstruida} min={0} onCommit={(v) => set({ superficieConstruida: v })} />
          </label>
          <label className={styles.field}>
            Plantas
            <CampoNum ariaLabel="Plantas" value={datos.plantas} min={1} dec={0} onCommit={(v) => set({ plantas: v })} />
          </label>
          <label className={styles.field}>
            Zona sísmica
            <select className={styles.select} value={triestado(datos.zonaSismica)} onChange={(e) => set({ zonaSismica: deTriestado(e.target.value) })}>
              <option value="">Sin indicar</option>
              <option value="si">Sí (ensayos de cargas cíclicas del acero)</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className={styles.field}>
            Inspección inicial de la instalación eléctrica
            <select className={styles.select} value={triestado(datos.inspeccionInicial)} onChange={(e) => set({ inspeccionInicial: deTriestado(e.target.value) })}>
              <option value="">Sin indicar</option>
              <option value="si">Sí, por organismo de control (garaje de 25 plazas o más…)</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>
        <p className={styles.nota}>Superficie y plantas de la obra se usan en los grupos de hormigón que no dicen las suyas (pestaña «Estructura»).</p>
      </section>

      {andalucia && plurifamiliar && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Ensayos acústicos de la IT 5</div>
            <div className={styles.cita}>Decreto 50/2025, IT 5: se ensayan todos los casos</div>
          </div>
          <div className={styles.formGrid}>
            {(
              [
                ['actividad', 'Recintos de actividad colindantes con habitables'],
                ['instalaciones', 'Recintos de instalaciones colindantes con habitables'],
                ['comunes', 'Casos de instalaciones comunes'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className={styles.field}>
                {label}
                <CampoNum
                  ariaLabel={label}
                  value={datos.recintosIT5?.[k]}
                  min={0}
                  dec={0}
                  onCommit={(v) => set({ recintosIT5: { ...(datos.recintosIT5 ?? {}), [k]: v } })}
                />
              </label>
            ))}
          </div>
        </section>
      )}

      {familias.length > 0 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Datos por familia</div>
            <div className={styles.cita}>Lo que cuenta los lotes y el presupuesto no dice</div>
          </div>
          {familias.map((b) => {
            const d = datos.familias?.[b.familia] ?? {};
            const campos: CampoFamilia[] = ['tipos', ...(POR_FAMILIA[b.familia] ?? [])];
            const unidades = unidadesPedidas(r, b.familia);
            return (
              <div key={b.familia} className={c.bloque}>
                <div className={c.bloqueTitle}>{b.nombre}</div>
                <div className={styles.compGrid} style={{ marginTop: 6 }}>
                  {campos.map((k) => (
                    <label key={k} className={styles.field}>
                      {CAMPO[k][0]}
                      <CampoNum
                        ariaLabel={`${CAMPO[k][0]} de ${b.nombre}`}
                        className={c.num}
                        unidad={CAMPO[k][1]}
                        value={d[k]}
                        min={0}
                        placeholder={k === 'tipos' || k === 'procedencias' ? '1' : 'falta'}
                        onCommit={(v) => setFamilia(b.familia, { [k]: v })}
                      />
                    </label>
                  ))}
                  {unidades.map((u) => (
                    <label key={u} className={styles.field}>
                      Número de «{u}»
                      <CampoNum
                        ariaLabel={`Número de ${u} de ${b.nombre}`}
                        className={c.num}
                        value={d.unidades?.[u]}
                        min={0}
                        dec={0}
                        onCommit={(v) => setFamilia(b.familia, { unidades: { ...(d.unidades ?? {}), [u]: v } })}
                      />
                    </label>
                  ))}
                  {b.familia === 'pilotes' && (
                    <label className={styles.check}>
                      <input type="checkbox" checked={!!d.aislados} onChange={(e) => setFamilia(b.familia, { aislados: e.target.checked })} />
                      Pilotes aislados
                    </label>
                  )}
                  {b.familia === 'acero-laminado' && (
                    <>
                      <label className={styles.field}>
                        Soldadura en obra
                        <select className={styles.select} value={triestado(d.soldaduraObra)} onChange={(e) => setFamilia(b.familia, { soldaduraObra: deTriestado(e.target.value) })}>
                          <option value="">Falta</option>
                          <option value="si">Sí</option>
                          <option value="no">No</option>
                        </select>
                      </label>
                      {d.soldaduraObra && (
                        <div className={styles.checks}>
                          {(['angulo', 'tope'] as const).map((k) => (
                            <label key={k} className={styles.check}>
                              <input
                                type="checkbox"
                                checked={(d.cordones ?? ['angulo']).includes(k)}
                                onChange={(e) => {
                                  const prev = d.cordones ?? ['angulo'];
                                  setFamilia(b.familia, { cordones: e.target.checked ? [...prev, k] : prev.filter((x) => x !== k) });
                                }}
                              />
                              Cordones {k === 'angulo' ? 'en ángulo' : 'a tope'}
                            </label>
                          ))}
                        </div>
                      )}
                      <label className={styles.check}>
                        <input type="checkbox" checked={!!d.conectores} onChange={(e) => setFamilia(b.familia, { conectores: e.target.checked })} />
                        Conectores
                      </label>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

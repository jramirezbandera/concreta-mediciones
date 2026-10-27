import { Fragment, type ReactNode } from 'react';
import {
  comunidadDeProvincia,
  ECO_CITA_CORTA,
  GRUPOS_ECO,
  OPCIONES_PLANTAS_BASICO,
  opcionesEco,
  plantasEco,
  plantasEcoBasico,
  PLANO_POR_DEFECTO,
  type DatosRatios,
  type EstudioRcdDatos,
  type GrupoOpcionEco,
  type SuperficieEco,
  type TipoObraRcd,
} from '../../core/rcd';
import { edificioDe } from '../../core/edificio';
import type { Agente } from '../../core/types';
import { useObraStore } from '../../store';
import { CampoNum, CampoTexto } from './Campos';
import styles from './Residuos.module.css';

const TIPOS: Array<[TipoObraRcd, string]> = [
  ['nueva', 'Obra nueva'],
  ['reforma', 'Reforma o rehabilitación'],
  ['demolicion', 'Demolición'],
];

const GRUPO_TXT: Record<GrupoOpcionEco, string> = {
  tipologia: 'Tipología',
  plantas: 'Plantas sobre rasante',
  cimentacion: 'Cimentación',
  estructuraVertical: 'Estructura vertical',
  estructuraHorizontal: 'Estructura horizontal',
  cubierta: 'Cubierta',
  fachada: 'Fachada',
  pavimento: 'Pavimento',
};
const SUP_TXT: Record<SuperficieEco, string> = {
  arquetas: 'Arquetas enterradas (nº)',
  forjados: 'Forjados (m²)',
  cubiertas: 'Cubiertas (m²)',
  hojaExterior: 'Hoja exterior de fachadas (m²)',
  particiones: 'Trasdosados y particiones (m²)',
  pavimentos: 'Pavimentos (m²)',
};

/** Referencia estable: un `[]` nuevo en el selector re-renderizaría sin fin. */
const SIN_AGENTES: Agente[] = [];

/** Datos del estudio que no salen de las partidas. */
export function DatosEstudio({ datos }: { datos: EstudioRcdDatos }) {
  const set = useObraStore((s) => s.setEstudioRcd);
  const provincia = useObraStore((s) => (typeof s.obra.provincia === 'string' ? s.obra.provincia : ''));
  const agentes = useObraStore((s) => s.obra.direccionFacultativa ?? SIN_AGENTES);
  const obra = useObraStore((s) => s.obra);
  const setEdificio = useObraStore((s) => s.setEdificio);
  const edificio = edificioDe(obra);
  const sobre = edificio.plantasSobreRasante;
  const deduce = comunidadDeProvincia(provincia);
  const rat = datos.ratios;
  const setRat = (patch: Partial<DatosRatios>) =>
    set({ ratios: { ...(rat ?? { metodo: 'ecoeficiencia', nivel: 'detallado', incluirTierras: true }), ...patch } });
  /** Plantas sobre rasante (de la obra); sin el número, el tramo de la hoja se elige aquí (obras de antes de TD2). */
  const campoPlantas = (tramo: (n: number) => string, select: ReactNode) => (
    <>
      <label className={styles.field}>
        Plantas sobre rasante
        <CampoNum
          ariaLabel="Plantas sobre rasante"
          min={1}
          dec={0}
          placeholder="—"
          unidad={sobre != null ? `tramo ${tramo(sobre)}` : undefined}
          value={sobre}
          onCommit={(v) => setEdificio({ plantasSobreRasante: v })}
        />
      </label>
      {sobre == null && select}
    </>
  );

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>La obra</div>
        </div>
        <div className={styles.formGrid}>
          <div className={`${styles.field} ${styles.fullRow}`}>
            Tipo de obra
            <div className={styles.checks}>
              {TIPOS.map(([k, label]) => (
                <label key={k} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={datos.tipos.includes(k)}
                    onChange={(e) => set({ tipos: e.target.checked ? [...datos.tipos, k] : datos.tipos.filter((x) => x !== k) })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <label className={styles.field}>
            Proyecto
            <select className={styles.select} value={datos.fase} onChange={(e) => set({ fase: e.target.value as EstudioRcdDatos['fase'] })}>
              <option value="ejecucion">De ejecución (1.º a 7.º)</option>
              <option value="basico">Básico (1.º a 4.º y 7.º, art. 4.2)</option>
            </select>
          </label>
          <label className={styles.field}>
            Fecha del estudio
            <input
              type="date"
              className={styles.input}
              value={datos.fecha ?? ''}
              onChange={(e) => set({ fecha: e.target.value || null })}
            />
            {!datos.fecha && <span className={styles.sub}>Sin fecha: se usa la de hoy (decide la lista de residuos vigente).</span>}
          </label>
          <label className={styles.field}>
            Inicio previsto de la obra
            <input
              type="date"
              className={styles.input}
              value={datos.inicioPrevisto ?? ''}
              onChange={(e) => set({ inicioPrevisto: e.target.value || null })}
            />
          </label>
          <label className={styles.field}>
            Comunidad autónoma
            <select
              className={styles.select}
              value={datos.comunidad ?? ''}
              onChange={(e) => set({ comunidad: (e.target.value || null) as EstudioRcdDatos['comunidad'] })}
            >
              <option value="">{deduce ? `De la provincia (${deduce === 'andalucia' ? 'Andalucía' : 'otra'})` : 'Falta la provincia de la obra'}</option>
              <option value="andalucia">Andalucía</option>
              <option value="otra">Otra (solo normativa estatal)</option>
            </select>
          </label>
          <label className={styles.field}>
            Amianto
            <select
              className={styles.select}
              value={datos.amianto ?? ''}
              onChange={(e) => set({ amianto: (e.target.value || null) as EstudioRcdDatos['amianto'] })}
            >
              <option value="">Sin indicar</option>
              <option value="no">No hay</option>
              <option value="posible">Posible (pendiente de identificar)</option>
              <option value="identificado">Identificado</option>
            </select>
          </label>
          {datos.amianto && datos.amianto !== 'no' && (
            <label className={styles.field}>
              Elementos con amianto
              <CampoTexto ariaLabel="Elementos con amianto" value={datos.amiantoElementos} onCommit={(v) => set({ amiantoElementos: v })} />
            </label>
          )}
          <label className={styles.field}>
            Separación
            <select
              className={styles.select}
              value={datos.separacion ?? 'enObra'}
              onChange={(e) => set({ separacion: e.target.value as EstudioRcdDatos['separacion'] })}
            >
              <option value="enObra">En la obra</option>
              <option value="gestorExterno">Por gestor externo (art. 5.5)</option>
            </select>
          </label>
          <label className={styles.field}>
            Tierras reutilizadas en la obra
            <CampoNum
              ariaLabel="Tierras reutilizadas en la propia obra"
              unidad="m³"
              placeholder="0"
              min={0}
              value={datos.tierrasReutilizadas?.m3 ?? null}
              onCommit={(v) => set({ tierrasReutilizadas: v ? { m3: v, destino: datos.tierrasReutilizadas?.destino ?? '' } : null })}
            />
          </label>
          {datos.tierrasReutilizadas && (
            <label className={styles.field}>
              Destino de esas tierras
              <CampoTexto
                ariaLabel="Destino de las tierras reutilizadas"
                placeholder="Relleno del trasdós de muros…"
                value={datos.tierrasReutilizadas.destino}
                onCommit={(v) => set({ tierrasReutilizadas: { m3: datos.tierrasReutilizadas!.m3, destino: v } })}
              />
            </label>
          )}
          <label className={styles.check}>
            <input type="checkbox" checked={!!datos.plantaMovil} onChange={(e) => set({ plantaMovil: e.target.checked })} />
            Planta móvil de tratamiento en la obra
          </label>
          <label className={styles.field}>
            Plano de las instalaciones de residuos (5.º)
            {/* Vacío = el texto por defecto (plano de emplazamiento), que se ve de muestra. */}
            <CampoTexto ariaLabel="Plano de las instalaciones" placeholder={PLANO_POR_DEFECTO} value={datos.plano} onCommit={(v) => set({ plano: v || null })} />
          </label>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Técnico que redacta y firma</div>
        </div>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            Nombre
            <CampoTexto ariaLabel="Nombre del técnico" value={datos.redactor?.nombre} onCommit={(v) => set({ redactor: { titulacion: '', colegiado: '', ...datos.redactor, nombre: v } })} />
          </label>
          <label className={styles.field}>
            Titulación
            <CampoTexto ariaLabel="Titulación" placeholder="Arquitecto" value={datos.redactor?.titulacion} onCommit={(v) => set({ redactor: { nombre: '', colegiado: '', ...datos.redactor, titulacion: v } })} />
          </label>
          <label className={styles.field}>
            Nº de colegiado
            <CampoTexto ariaLabel="Número de colegiado" value={datos.redactor?.colegiado} onCommit={(v) => set({ redactor: { nombre: '', titulacion: '', ...datos.redactor, colegiado: v } })} />
          </label>
          {agentes.length > 0 && (
            <label className={styles.field}>
              Tomarlo de la dirección facultativa
              <select
                className={styles.select}
                value=""
                onChange={(e) => {
                  const a = agentes.find((x) => x.id === e.target.value);
                  if (a) set({ redactor: { nombre: a.nombre, titulacion: datos.redactor?.titulacion ?? '', colegiado: a.colegiado ?? '' } });
                }}
              >
                <option value="">Elige…</option>
                {agentes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.rol}: {a.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>

      {datos.tipos.includes('nueva') && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Obra nueva: ratios por m²</div>
            <div className={styles.cita}>{ECO_CITA_CORTA} · uso provisional</div>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              Método
              <select
                className={styles.select}
                value={rat ? (rat.metodo === 'ecoeficiencia' ? `eco-${rat.nivel ?? 'detallado'}` : 'manual') : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) set({ ratios: null });
                  else if (v === 'manual') setRat({ metodo: 'manual', manual: rat?.manual ?? [] });
                  else setRat({ metodo: 'ecoeficiencia', nivel: v === 'eco-basico' ? 'basico' : 'detallado', tabla: 'ecoeficiencia-2013' });
                }}
              >
                <option value="">Sin ratios (por partidas del banco)</option>
                <option value="eco-detallado">ECO-eficiencia · vivienda (detallado)</option>
                <option value="eco-basico">ECO-eficiencia · otros usos (básico)</option>
                <option value="manual">Ratios tecleados con su fuente</option>
              </select>
            </label>
            {rat && (
              <>
                <label className={styles.field}>
                  Superficie construida
                  <CampoNum
                    ariaLabel="Superficie construida"
                    unidad="m²"
                    min={0}
                    value={edificio.superficieConstruida}
                    onCommit={(v) => setEdificio({ superficieConstruida: v })}
                  />
                </label>
                <label className={styles.field}>
                  Superficie del solar
                  <CampoNum ariaLabel="Superficie del solar" unidad="m²" min={0} placeholder="—" value={rat.superficieSolar ?? null} onCommit={(v) => setRat({ superficieSolar: v })} />
                </label>
                {rat.nivel !== 'basico' && rat.metodo === 'ecoeficiencia' && (
                  <>
                    <label className={styles.field}>
                      Superficie de ocupación
                      <CampoNum ariaLabel="Superficie de ocupación" unidad="m²" min={0} placeholder="—" value={rat.superficieOcupacion ?? null} onCommit={(v) => setRat({ superficieOcupacion: v })} />
                    </label>
                    <label className={styles.field}>
                      Plantas bajo rasante
                      <CampoNum
                        ariaLabel="Plantas bajo rasante"
                        min={0}
                        dec={0}
                        placeholder="0"
                        value={edificio.plantasBajoRasante}
                        onCommit={(v) => setEdificio({ plantasBajoRasante: v })}
                      />
                    </label>
                    {GRUPOS_ECO.map((g) => {
                      const select = (
                        <label key={g} className={styles.field}>
                          {g === 'plantas' ? 'Tramo de plantas' : GRUPO_TXT[g]}
                          <select
                            className={styles.select}
                            value={rat.opciones?.[g] ?? opcionesEco(g)[0]!.id}
                            onChange={(e) => setRat({ opciones: { ...rat.opciones, [g]: e.target.value } })}
                          >
                            {opcionesEco(g).map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.hoja}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                      return g === 'plantas' ? <Fragment key={g}>{campoPlantas(plantasEco, select)}</Fragment> : select;
                    })}
                    {(Object.keys(SUP_TXT) as SuperficieEco[]).map((k) => (
                      <label key={k} className={styles.field}>
                        {SUP_TXT[k]}
                        <CampoNum
                          ariaLabel={SUP_TXT[k]}
                          min={0}
                          dec={k === 'arquetas' ? 0 : 2}
                          placeholder="opcional"
                          value={rat.superficies?.[k] ?? null}
                          onCommit={(v) => {
                            const s = { ...rat.superficies };
                            if (v) s[k] = v;
                            else delete s[k];
                            setRat({ superficies: s });
                          }}
                        />
                      </label>
                    ))}
                  </>
                )}
                {rat.nivel === 'basico' && rat.metodo === 'ecoeficiencia' && (
                  <>
                    <label className={styles.field}>
                      Uso
                      <select className={styles.select} value={rat.tipoBasico ?? 'nuevaNoResidencial'} onChange={(e) => setRat({ tipoBasico: e.target.value as DatosRatios['tipoBasico'] })}>
                        <option value="nuevaNoResidencial">No residencial</option>
                        <option value="nuevaResidencial">Residencial</option>
                      </select>
                    </label>
                    {campoPlantas(
                      plantasEcoBasico,
                      <label className={styles.field}>
                        Tramo de plantas
                        <select className={styles.select} value={rat.plantasBasico ?? '1'} onChange={(e) => setRat({ plantasBasico: e.target.value })}>
                          {OPCIONES_PLANTAS_BASICO.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </label>,
                    )}
                  </>
                )}
                <label className={styles.check}>
                  <input type="checkbox" checked={rat.incluirTierras} onChange={(e) => setRat({ incluirTierras: e.target.checked })} />
                  Incluir las tierras del ratio (si no hay partidas de excavación)
                </label>
              </>
            )}
          </div>
          {rat?.metodo === 'manual' && <RatiosManuales rat={rat} onChange={setRat} />}
          {rat && <p className={styles.nota}>La superficie construida y las plantas son de la obra: las comparte el plan de calidad y están también en «Datos de la obra».</p>}
          <p className={styles.nota}>
            Los ratios solo cubren lo que las partidas no traen: un código con residuos de colocación o embalaje del banco (`~R`) no recibe ratio, y
            las tierras salen de las partidas de excavación si las hay.
          </p>
        </section>
      )}
    </>
  );
}

function RatiosManuales({ rat, onChange }: { rat: DatosRatios; onChange: (p: Partial<DatosRatios>) => void }) {
  const lista = rat.manual ?? [];
  const set = (i: number, patch: Partial<(typeof lista)[number]>) => onChange({ manual: lista.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  return (
    <div style={{ marginTop: 12 }}>
      <table className={`ctable ${styles.table}`}>
        <thead>
          <tr>
            <th>Código</th>
            <th className={styles.r}>t/m²</th>
            <th className={styles.r}>m³/m²</th>
            <th>Fuente</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lista.map((m, i) => (
            <tr key={i}>
              <td>
                <CampoTexto ariaLabel="Código" className={styles.lerInput} value={m.ler} onCommit={(v) => set(i, { ler: v.trim() })} />
              </td>
              <td className={styles.r}>
                <CampoNum ariaLabel="t por m²" min={0} value={m.tPorM2} onCommit={(v) => set(i, { tPorM2: v ?? 0 })} />
              </td>
              <td className={styles.r}>
                <CampoNum ariaLabel="m³ por m²" min={0} placeholder="—" value={m.m3PorM2} onCommit={(v) => set(i, { m3PorM2: v })} />
              </td>
              <td>
                <CampoTexto ariaLabel="Fuente del ratio" value={m.fuente} onCommit={(v) => set(i, { fuente: v })} />
              </td>
              <td>
                <button type="button" className="icon-btn" aria-label="Quitar ratio" onClick={() => onChange({ manual: lista.filter((_, j) => j !== i) })}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className={`tcol ${styles.btn}`}
        style={{ marginTop: 8 }}
        onClick={() => onChange({ manual: [...lista, { ler: '', tPorM2: 0, m3PorM2: null, fuente: '' }] })}
      >
        Añadir ratio
      </button>
    </div>
  );
}

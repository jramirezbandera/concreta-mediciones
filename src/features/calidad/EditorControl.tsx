import { Icon } from '../../components';
import { avisosDesignacion, leerDesignacion } from '../../core/pcc/hormigon';
import { enCapituloControl } from '../../core/pcc/datos';
import { diametrosDe, necesitaRevision, proponerControl } from '../../core/pcc/reglas';
import familiasJson from '../../core/pcc/tablas/familias.json';
import type { AceroPartida, ControlPartida, FilaLote, HormigonPartida } from '../../core/pcc/tipos';
import { unidadPcc } from '../../core/pcc/unidades';
import type { Partida } from '../../core/types';
import { useObraStore, useToastStore } from '../../store';
import { CampoNum, CampoTexto } from '../residuos/Campos';
import { ChipControl } from './ChipControl';
import { NOMBRE_FILA } from './nombres';
import styles from '../residuos/Residuos.module.css';

const GRUPOS: Record<string, string> = {
  estructura: 'Estructura',
  cimentacion: 'Cimentación profunda',
  albanileria: 'Albañilería',
  cubiertas: 'Cubiertas',
  envolvente: 'Envolvente',
  acabados: 'Acabados',
  carpinteria: 'Carpintería y vidrios',
  instalaciones: 'Instalaciones',
  terreno: 'Terreno',
};
const FAMILIAS = familiasJson.familias.map((f) => ({ id: f.id, nombre: f.nombre, grupo: f.grupo }));

const NOMBRE_ACERO: Record<AceroPartida['tipo'], string> = {
  barras: 'Barras corrugadas',
  mallas: 'Mallas electrosoldadas',
  ferralla: 'Ferralla armada',
};
const NOMBRE_ORIGEN: Record<ControlPartida['origen']['tipo'], string> = {
  regla: 'Regla',
  banco: 'Del banco',
  descomposicion: 'De la descomposición',
  manual: 'A mano',
};

/** Lo que el técnico cambia pasa a «a mano»: al volver a confirmar se conserva (O6). */
const aMano = (c: ControlPartida): ControlPartida['origen'] =>
  c.origen.tipo === 'manual' ? c.origen : { tipo: 'manual', ...(c.origen.ref ? { ref: c.origen.ref } : {}), motivo: `${c.origen.motivo} · ajustado a mano` };

/** Editor del control de una partida (vista Calidad y pestaña del detalle). */
export function EditorControl({ chapterId, p }: { chapterId: string; p: Partida }) {
  const setControl = useObraStore((s) => s.setControlPartida);
  const confirmar = useObraStore((s) => s.confirmarControles);
  const aplicarHom = useObraStore((s) => s.aplicarControlAHomonimos);
  const recursos = useObraStore((s) => s.recursos);
  const enCapitulo = useObraStore((s) => enCapituloControl(s.chapters, s.planCalidad?.capituloControl, chapterId, p));
  const homonimos = useObraStore((s) => {
    if (!p.code) return 0;
    let n = 0;
    for (const ps of Object.values(s.partidas)) for (const x of ps ?? []) if (x.id !== p.id && x.code === p.code) n += 1;
    return n;
  });
  const c = p.pcc;
  const write = (next: ControlPartida | null) => setControl(chapterId, p.id, next);
  const proponer = () => proponerControl(p, { banco: recursos, enCapituloControl: enCapitulo });

  if (!c) {
    return (
      <div className={styles.editor}>
        <div className={styles.editorHead}>
          <ChipControl estado={null} /> Sin control asignado.
        </div>
        <div className={styles.btnRow}>
          <button
            type="button"
            className={`tcol ${styles.btn}`}
            onClick={() => {
              const prop = proponer();
              if (prop) write(prop);
              else useToastStore.getState().show('Ninguna regla reconoce esta partida: elige su familia a mano.');
            }}
          >
            <Icon name="target" size={14} /> Proponer
          </button>
          <SelectFamilia
            value=""
            onChange={(familia) => write({ estado: 'propuesta', origen: { tipo: 'manual', motivo: 'Asignada a mano' }, ...(familia ? { familia } : {}) })}
          />
          <button
            type="button"
            className={`tcol ${styles.btn}`}
            onClick={() => write({ estado: 'sinControl', origen: { tipo: 'manual', motivo: 'Sin control' } })}
          >
            Sin control
          </button>
        </div>
      </div>
    );
  }

  const revisar = necesitaRevision(c, p);
  const editar = (patch: Partial<ControlPartida>) => write({ ...c, ...patch, origen: aMano(c) });
  const setHormigon = (patch: Partial<HormigonPartida>) => editar({ hormigon: { ...c.hormigon!, ...patch } });
  const setAcero = (patch: Partial<AceroPartida>) => editar({ acero: { ...(c.acero ?? { tipo: 'barras' }), ...patch } });
  const u = unidadPcc(p.ud);
  const esAcero = !!c.acero || c.familia === 'acero-armar' || c.familia === 'mallas';
  const esHormigon = !!c.hormigon || c.familia === 'hormigon-estructural' || c.familia === 'forjado-viguetas';

  return (
    <div className={styles.editor}>
      <div className={styles.editorHead}>
        <ChipControl estado={revisar ? 'revisar' : c.estado} />
        <span>
          {NOMBRE_ORIGEN[c.origen.tipo]}: {c.origen.motivo}
        </span>
      </div>
      {revisar && (
        <p className={styles.nota}>
          La partida ha cambiado desde que se confirmó su control: no entra en el plan hasta que lo confirmes otra vez.
          {c.origen.tipo === 'manual' ? ' Lo puesto a mano se conserva.' : ' Al confirmar, las reglas la vuelven a leer.'}
        </p>
      )}
      {c.estado === 'capituloControl' && <p className={styles.nota}>Partida del capítulo de control de calidad: es el coste del plan, no dispara control.</p>}

      {c.estado !== 'capituloControl' && (
        <div className={styles.comp}>
          <div className={styles.compGrid}>
            <label className={styles.field}>
              Familia
              <SelectFamilia value={c.familia ?? ''} onChange={(familia) => editar({ familia: familia || undefined })} />
            </label>
            {esHormigon && (
              <label className={styles.field}>
                Designación del hormigón
                <CampoTexto
                  ariaLabel="Designación del hormigón"
                  className="mono"
                  value={c.hormigon?.designacion.texto ?? ''}
                  placeholder="HA-25/B/20/XC1"
                  onCommit={(v) => {
                    const l = leerDesignacion(v);
                    if (!l) {
                      useToastStore.getState().show('No se lee el tipo y la resistencia (HA-25…).', undefined, { tone: 'error' });
                      return;
                    }
                    editar({ hormigon: { ...(c.hormigon ?? {}), designacion: l.designacion } });
                  }}
                />
              </label>
            )}
            {c.hormigon && (
              <>
                <label className={styles.field}>
                  Tipo de elemento (tabla 57.5.4.1)
                  <select
                    className={`${styles.select} ${styles.wide}`}
                    value={c.hormigon.fila ?? ''}
                    onChange={(e) => setHormigon({ fila: (e.target.value || undefined) as FilaLote | undefined })}
                  >
                    <option value="">Falta: elige el tipo de elemento</option>
                    {(Object.keys(NOMBRE_FILA) as FilaLote[]).map((f) => (
                      <option key={f} value={f}>
                        {NOMBRE_FILA[f]}
                      </option>
                    ))}
                  </select>
                </label>
                {u !== 'm3' && (
                  <label className={styles.field}>
                    Hormigón por unidad
                    <CampoNum ariaLabel="Metros cúbicos de hormigón por unidad" unidad={`m³/${p.ud}`} value={c.hormigon.m3PorUd} min={0} onCommit={(v) => setHormigon({ m3PorUd: v })} />
                  </label>
                )}
                {(c.hormigon.fila === 'cim_superficial' || c.hormigon.fila === 'cim_mayor_200') && (
                  <label className={styles.field}>
                    Mayor elemento
                    <CampoNum
                      ariaLabel="Volumen del mayor elemento de cimentación"
                      unidad="m³"
                      value={c.hormigon.elementoMayorM3}
                      min={0}
                      placeholder="—"
                      onCommit={(v) => setHormigon({ elementoMayorM3: v, ...(v != null && v > 200 ? { fila: 'cim_mayor_200' as const } : {}) })}
                    />
                  </label>
                )}
                <label className={styles.field}>
                  Dosificación
                  <CampoTexto
                    ariaLabel="Dosificación"
                    value={c.hormigon.dosificacion ?? ''}
                    placeholder={c.hormigon.designacion.texto}
                    onCommit={(v) => setHormigon({ dosificacion: v.trim() || undefined })}
                  />
                </label>
              </>
            )}
            {esAcero && (
              <>
                <label className={styles.field}>
                  Acero
                  <select className={styles.select} value={c.acero?.tipo ?? 'barras'} onChange={(e) => setAcero({ tipo: e.target.value as AceroPartida['tipo'] })}>
                    {(Object.keys(NOMBRE_ACERO) as Array<AceroPartida['tipo']>).map((t) => (
                      <option key={t} value={t}>
                        {NOMBRE_ACERO[t]}
                      </option>
                    ))}
                  </select>
                </label>
                {u !== 'kg' && u !== 't' && (
                  <label className={styles.field}>
                    Acero por unidad
                    <CampoNum ariaLabel="Kilos de acero por unidad" unidad={`kg/${p.ud}`} value={c.acero?.kgPorUd} min={0} placeholder="—" onCommit={(v) => setAcero({ kgPorUd: v })} />
                  </label>
                )}
                <label className={styles.field}>
                  Diámetros (mm)
                  <CampoTexto
                    ariaLabel="Diámetros"
                    className="mono"
                    value={(c.acero?.diametros ?? []).join(', ')}
                    placeholder="8, 10, 12"
                    onCommit={(v) => {
                      const ds = diametrosDe(`Ø${v.replace(/\s+/g, ' ')}`);
                      setAcero({ diametros: ds.length ? ds : undefined });
                    }}
                  />
                </label>
                <label className={styles.field}>
                  Ferralla
                  <select
                    className={styles.select}
                    value={c.acero?.procedencia ?? ''}
                    onChange={(e) => setAcero({ procedencia: (e.target.value || undefined) as AceroPartida['procedencia'] })}
                  >
                    <option value="">Como diga el plan</option>
                    <option value="taller">De taller (art. 59.2)</option>
                    <option value="obra">Elaborada en obra (art. 58)</option>
                  </select>
                </label>
              </>
            )}
          </div>
          {c.hormigon &&
            avisosDesignacion(c.hormigon.designacion).map((a) => (
              <div key={a} className={`${styles.lerDesc} ${styles.peligroso}`}>
                {a}
              </div>
            ))}
        </div>
      )}

      <div className={styles.btnRow}>
        {(c.estado === 'propuesta' || revisar) && (
          <button type="button" className={`tcol ${styles.btnPrimary}`} onClick={() => confirmar([{ chapterId, partidaId: p.id }])}>
            <Icon name="check" size={14} /> {revisar ? 'Confirmar otra vez' : c.familia || c.hormigon || c.acero ? 'Confirmar' : 'Confirmar sin control'}
          </button>
        )}
        {c.estado !== 'sinControl' && c.estado !== 'capituloControl' && (
          <button
            type="button"
            className={`tcol ${styles.btn}`}
            onClick={() => write({ estado: 'sinControl', origen: { tipo: 'manual', motivo: 'Sin control' } })}
          >
            Sin control
          </button>
        )}
        {homonimos > 0 && (
          <button
            type="button"
            className={`tcol ${styles.btn}`}
            title={`Copia este control a las partidas con el código ${p.code}`}
            onClick={() => {
              const n = aplicarHom(chapterId, p.id);
              useToastStore.getState().show(`Control copiado a ${n} partida${n === 1 ? '' : 's'} con el código ${p.code}`);
            }}
          >
            <Icon name="copy" size={14} /> Aplicar a {homonimos === 1 ? 'la otra' : `las ${homonimos}`} con el mismo código
          </button>
        )}
        <button type="button" className={`tcol ${styles.btn}`} onClick={() => write(null)}>
          <Icon name="x" size={14} /> Quitar
        </button>
      </div>
    </div>
  );
}

function SelectFamilia({ value, onChange }: { value: string; onChange: (familia: string) => void }) {
  const grupos = [...new Set(FAMILIAS.map((f) => f.grupo))];
  return (
    <select aria-label="Familia de control" className={`${styles.select} ${styles.wide}`} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{value ? 'Sin familia' : 'Asignar familia…'}</option>
      {grupos.map((g) => (
        <optgroup key={g} label={GRUPOS[g] ?? g}>
          {FAMILIAS.filter((f) => f.grupo === g).map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

import { useId, useMemo, useState } from 'react';
import { Icon } from '../../components';
import { fmtNum } from '../../core/money';
import {
  lerConAsterisco,
  lerVigente,
  materialesSeAe,
  MODOS_POR_UNIDAD,
  necesitaRevision,
  normalizarLer,
  pesosSuperficieSeAe,
  proponerResiduo,
  refSeAe,
  resultadoPartida,
  unidadRcd,
  type ComponenteRcd,
  type Conversion,
  type ResiduoPartida,
  type TipoComponente,
  type Transporte,
} from '../../core/rcd';
import type { Partida } from '../../core/types';
import { useObraStore, useToastStore } from '../../store';
import { enCapituloGestion } from '../../store/slices/rcdSlice';
import { CampoNum } from './Campos';
import { hoyIso } from './formato';
import { ChipEstado } from './ChipEstado';
import styles from './Residuos.module.css';

const NOMBRE_MODO: Record<Conversion['modo'], string> = {
  volumen: 'Por volumen',
  espesor: 'Superficie × espesor',
  pesoSuperficie: 'Peso por m² (SE-AE)',
  seccion: 'Longitud × sección',
  pesoUnidad: 'Peso por unidad',
  masa: 'Por masa',
  directo: 'Del banco de precios',
};
const NOMBRE_TIPO: Record<TipoComponente, string> = {
  demolicion: 'Demolición',
  excavacion: 'Excavación',
  colocacion: 'Colocación (mermas)',
  embalaje: 'Embalaje',
};
const NOMBRE_TRANSPORTE: Record<Transporte, string> = {
  incluido: 'El precio incluye carga y transporte',
  excluido: 'El transporte va aparte',
  noDice: 'La partida no dice si incluye el transporte',
};

/** Conversión por defecto de un modo (sin inventar valores). */
function conversionDe(modo: Conversion['modo'], prev: Conversion): Conversion {
  const espesor = 'espesor' in prev ? prev.espesor : null;
  switch (modo) {
    case 'volumen':
      return { modo };
    case 'espesor':
      return { modo, espesor };
    case 'pesoSuperficie':
      return { modo, tPorM2: null, espesor };
    case 'seccion':
      return { modo, seccion: null };
    case 'pesoUnidad':
      return { modo, kgPorUd: null, m3PorUd: null };
    case 'masa':
      return { modo };
    case 'directo':
      return prev.modo === 'directo' ? prev : { modo, tPorUd: 0, m3PorUd: 0, m3Base: 'aparente' };
  }
}

const usaDensidad = (c: Conversion): boolean => c.modo === 'volumen' || c.modo === 'espesor' || c.modo === 'seccion' || c.modo === 'masa';

/** Editor del residuo de una partida (vista Residuos y pestaña del detalle). */
export function EditorResiduo({ chapterId, p }: { chapterId: string; p: Partida }) {
  const estudio = useObraStore((s) => s.estudioRcd);
  const setResiduo = useObraStore((s) => s.setResiduoPartida);
  const confirmar = useObraStore((s) => s.confirmarResiduos);
  const aplicarHom = useObraStore((s) => s.aplicarResiduoAHomonimos);
  const homonimos = useObraStore((s) => {
    if (!p.code) return 0;
    let n = 0;
    for (const ps of Object.values(s.partidas)) for (const x of ps ?? []) if (x.id !== p.id && x.code === p.code) n += 1;
    return n;
  });
  const enGestion = useObraStore((s) => enCapituloGestion(s, chapterId, p));
  const r = p.rcd;
  const res = useMemo(() => resultadoPartida(p, estudio), [p, estudio]);
  const u = unidadRcd(p.ud);
  const write = (next: ResiduoPartida | null) => setResiduo(chapterId, p.id, next);

  const nuevoComponente = (): ComponenteRcd => ({
    ler: '',
    tipo: 'demolicion',
    conversion: conversionDe(MODOS_POR_UNIDAD[u][0]!, { modo: 'volumen' }),
  });

  if (!r) {
    return (
      <div className={styles.editor}>
        <div className={styles.editorHead}>
          <ChipEstado estado={null} /> Sin residuo asignado.
        </div>
        <div className={styles.btnRow}>
          <button
            type="button"
            className={`tcol ${styles.btn}`}
            onClick={() => {
              const prop = proponerResiduo(p, enGestion);
              if (prop) write(prop);
              else useToastStore.getState().show('Ninguna regla reconoce esta partida: asígnala a mano.');
            }}
          >
            <Icon name="target" size={14} /> Proponer
          </button>
          <button
            type="button"
            className={`tcol ${styles.btn}`}
            onClick={() => write({ estado: 'propuesta', origen: { tipo: 'manual', motivo: 'Asignado a mano' }, componentes: [nuevoComponente()] })}
          >
            <Icon name="plus" size={14} /> Asignar a mano
          </button>
          <button
            type="button"
            className={`tcol ${styles.btn}`}
            onClick={() => write({ estado: 'noGenera', origen: { tipo: 'manual', motivo: 'No genera residuo' }, componentes: [] })}
          >
            No genera residuo
          </button>
        </div>
      </div>
    );
  }

  const revisar = necesitaRevision(r, p);
  const patchComp = (i: number, patch: Partial<ComponenteRcd>) =>
    write({ ...r, componentes: r.componentes.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  return (
    <div className={styles.editor}>
      <div className={styles.editorHead}>
        <ChipEstado estado={revisar ? 'revisar' : r.estado} />
        <span>
          {r.origen.tipo === 'banco' ? 'Del banco' : r.origen.tipo === 'regla' ? 'Regla' : r.origen.tipo === 'ia' ? 'IA' : 'A mano'}:{' '}
          {r.origen.motivo}
        </span>
        {r.estado !== 'gestion' && r.estado !== 'noGenera' && (
          <select
            aria-label="Transporte del residuo"
            className={styles.select}
            value={r.transporte ?? 'noDice'}
            onChange={(e) => write({ ...r, transporte: e.target.value as Transporte })}
          >
            {(Object.keys(NOMBRE_TRANSPORTE) as Transporte[]).map((k) => (
              <option key={k} value={k}>
                {NOMBRE_TRANSPORTE[k]}
              </option>
            ))}
          </select>
        )}
      </div>

      {revisar && r.huella && (
        <p className={styles.nota} role="status">
          La partida ha cambiado desde que se confirmó su residuo
          {r.huella.title !== p.title ? ` (antes: «${r.huella.title}»)` : r.huella.ud !== p.ud ? ` (antes en ${r.huella.ud})` : ''}: no suma hasta que lo
          confirmes otra vez. Revisa los residuos o vuelve a proponerlos.
        </p>
      )}
      {r.estado === 'gestion' && (
        <p className={styles.nota}>Partida del capítulo de gestión de residuos: es el coste del 7.º, no genera residuo.</p>
      )}
      {r.estado !== 'gestion' && r.componentes.length === 0 && (
        <p className={styles.nota}>{r.estado === 'noGenera' ? 'Confirmado: no genera residuo.' : 'Propuesta: no genera residuo.'}</p>
      )}

      {r.componentes.map((c, i) => (
        <Componente
          key={i}
          c={c}
          ud={p.ud}
          resultado={res.componentes[i]?.res}
          varios={r.componentes.length > 1}
          onPatch={(patch) => patchComp(i, patch)}
          onQuitar={() => write({ ...r, componentes: r.componentes.filter((_, j) => j !== i) })}
        />
      ))}

      <div className={styles.btnRow}>
        {(r.estado === 'propuesta' || revisar) && (
          <button type="button" className={`tcol ${styles.btnPrimary}`} onClick={() => confirmar([{ chapterId, partidaId: p.id }])}>
            <Icon name="check" size={14} /> {revisar ? 'Confirmar otra vez' : r.componentes.length ? 'Confirmar' : 'Confirmar que no genera'}
          </button>
        )}
        {revisar && (
          <button
            type="button"
            className={`tcol ${styles.btn}`}
            title="Las reglas vuelven a leer la partida: lo que hubieras corregido en los residuos se pierde"
            onClick={() => {
              const prop = proponerResiduo(p, enGestion);
              if (prop) write(prop);
              else useToastStore.getState().show('Ninguna regla reconoce la partida tal como está ahora: corrige los residuos a mano.');
            }}
          >
            <Icon name="target" size={14} /> Volver a proponer
          </button>
        )}
        {r.estado !== 'gestion' && (
          <button type="button" className={`tcol ${styles.btn}`} onClick={() => write({ ...r, componentes: [...r.componentes, nuevoComponente()] })}>
            <Icon name="plus" size={14} /> Añadir residuo
          </button>
        )}
        {r.estado !== 'noGenera' && r.estado !== 'gestion' && (
          <button type="button" className={`tcol ${styles.btn}`} onClick={() => write({ ...r, estado: 'noGenera', componentes: [] })}>
            No genera residuo
          </button>
        )}
        {homonimos > 0 && (
          <button
            type="button"
            className={`tcol ${styles.btn}`}
            title={`Copia este residuo a las partidas con el código ${p.code}`}
            onClick={() => {
              const n = aplicarHom(chapterId, p.id);
              useToastStore.getState().show(`Residuo copiado a ${n} partida${n === 1 ? '' : 's'} con el código ${p.code}`);
            }}
          >
            <Icon name="copy" size={14} /> Aplicar a {homonimos === 1 ? 'la otra' : `las ${homonimos}`} con el mismo código
          </button>
        )}
        <button type="button" className={`tcol ${styles.btn}`} onClick={() => write(null)}>
          <Icon name="x" size={14} /> Quitar
        </button>
      </div>
      {res.t > 0 && (
        <div className={styles.sub}>
          Total de la partida: <span className="mono">{fmtNum(res.t, 3)} t</span>
        </div>
      )}
    </div>
  );
}

function Componente({
  c,
  ud,
  resultado,
  varios,
  onPatch,
  onQuitar,
}: {
  c: ComponenteRcd;
  ud: string;
  resultado: ReturnType<typeof resultadoPartida>['componentes'][number]['res'] | undefined;
  varios: boolean;
  onPatch: (patch: Partial<ComponenteRcd>) => void;
  onQuitar: () => void;
}) {
  const fecha = useObraStore((s) => s.estudioRcd?.fecha) ?? hoyIso();
  const ler = useMemo(() => lerVigente(fecha), [fecha]);
  const dl = useId();
  const [lerDraft, setLerDraft] = useState<string | null>(null);
  const [lerErr, setLerErr] = useState(false);
  const info = ler.get(c.ler);
  const u = unidadRcd(ud);
  const modos = MODOS_POR_UNIDAD[u].filter((m) => m !== 'directo' || c.conversion.modo === 'directo');
  const conv = c.conversion;
  const setConv = (next: Conversion) => onPatch({ conversion: next });

  const commitLer = () => {
    if (lerDraft == null) return;
    const code = normalizarLer(lerDraft);
    if (!code || !ler.has(code)) {
      setLerErr(true);
      return;
    }
    setLerDraft(null);
    setLerErr(false);
    if (code !== c.ler) onPatch({ ler: code });
  };

  return (
    <div className={styles.comp}>
      <div className={styles.compGrid}>
        <label className={styles.field}>
          Código LER
          <input
            list={dl}
            aria-label="Código de la lista europea de residuos"
            aria-invalid={lerErr || undefined}
            className={`${styles.input} ${styles.lerInput} mono ${lerErr || !info ? styles.inputErr : ''}`}
            value={lerDraft ?? (info ? lerConAsterisco(info) : c.ler)}
            placeholder="17 01 02"
            onChange={(e) => setLerDraft(e.target.value)}
            onBlur={commitLer}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitLer();
              } else if (e.key === 'Escape') {
                setLerDraft(null);
                setLerErr(false);
              }
            }}
          />
          <datalist id={dl}>
            {[...ler.values()].map((x) => (
              <option key={x.codigo} value={x.codigo}>
                {`${lerConAsterisco(x)} ${x.descripcion}`}
              </option>
            ))}
          </datalist>
        </label>
        <label className={styles.field}>
          Origen
          <select
            className={styles.select}
            value={c.tipo}
            onChange={(e) => onPatch({ tipo: e.target.value as TipoComponente })}
          >
            {(Object.keys(NOMBRE_TIPO) as TipoComponente[]).map((t) => (
              <option key={t} value={t}>
                {NOMBRE_TIPO[t]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Cómo se mide
          <select
            className={styles.select}
            value={conv.modo}
            onChange={(e) => setConv(conversionDe(e.target.value as Conversion['modo'], conv))}
          >
            {modos.map((m) => (
              <option key={m} value={m}>
                {m === 'pesoUnidad' && u === 'm' ? 'Peso por metro' : NOMBRE_MODO[m]}
              </option>
            ))}
          </select>
        </label>

        {conv.modo === 'espesor' && (
          <label className={styles.field}>
            Espesor
            <CampoNum ariaLabel="Espesor" unidad="m" value={conv.espesor} min={0.001} max={2} onCommit={(v) => setConv({ ...conv, espesor: v })} />
          </label>
        )}
        {conv.modo === 'pesoSuperficie' && (
          <>
            <label className={styles.field}>
              Elemento del SE-AE
              <select
                className={`${styles.select} ${styles.wide}`}
                value={c.densidad?.ref?.split(':')[1] ?? ''}
                onChange={(e) => {
                  const ps = pesosSuperficieSeAe().find((x) => x.id === e.target.value);
                  if (ps) onPatch({ conversion: { modo: 'pesoSuperficie', tPorM2: ps.tPorM2, espesor: ps.espesor ?? conv.espesor }, densidad: { tPorM3: null, ref: refSeAe(ps.id) } });
                }}
              >
                <option value="">Otro (teclea el peso)</option>
                {pesosSuperficieSeAe().map((ps) => (
                  <option key={ps.id} value={ps.id}>
                    {`${ps.elemento} — ${fmtNum(ps.kNm2, 2)} kN/m² (${ps.tabla})`}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Peso
              <CampoNum ariaLabel="Peso por metro cuadrado" unidad="t/m²" value={conv.tPorM2} min={0} onCommit={(v) => setConv({ ...conv, tPorM2: v })} />
            </label>
            <label className={styles.field}>
              Espesor (para los m³)
              <CampoNum ariaLabel="Espesor" unidad="m" value={conv.espesor} min={0.001} max={2} placeholder="—" onCommit={(v) => setConv({ ...conv, espesor: v })} />
            </label>
          </>
        )}
        {conv.modo === 'seccion' && (
          <label className={styles.field}>
            Sección
            <CampoNum ariaLabel="Sección" unidad="m²" value={conv.seccion} min={0} onCommit={(v) => setConv({ ...conv, seccion: v })} />
          </label>
        )}
        {conv.modo === 'pesoUnidad' && (
          <>
            <label className={styles.field}>
              Peso
              <CampoNum ariaLabel="Peso por unidad" unidad={u === 'm' ? 'kg/m' : 'kg/ud'} value={conv.kgPorUd} min={0} onCommit={(v) => setConv({ ...conv, kgPorUd: v })} />
            </label>
            <label className={styles.field}>
              Volumen en obra
              <CampoNum ariaLabel="Volumen por unidad" unidad={u === 'm' ? 'm³/m' : 'm³/ud'} value={conv.m3PorUd} min={0} placeholder="—" onCommit={(v) => setConv({ ...conv, m3PorUd: v })} />
            </label>
          </>
        )}
        {conv.modo === 'directo' && (
          <span className={styles.sub}>
            {fmtNum(conv.tPorUd * 1000, 3)} kg y {fmtNum(conv.m3PorUd, 5)} m³ {conv.m3Base === 'aparente' ? 'aparentes' : 'en obra'} por unidad
          </span>
        )}
        {usaDensidad(conv) && (
          <>
            <label className={styles.field}>
              Material (SE-AE, anejo C)
              <select
                className={`${styles.select} ${styles.wide}`}
                value={c.densidad?.ref?.split(':')[1] ?? ''}
                onChange={(e) => {
                  const m = materialesSeAe().find((x) => x.id === e.target.value);
                  onPatch({ densidad: m ? { tPorM3: m.tPorM3, ref: refSeAe(m.id) } : { tPorM3: c.densidad?.tPorM3 ?? null } });
                }}
              >
                <option value="">Otro (teclea la densidad)</option>
                {materialesSeAe().map((m) => (
                  <option key={m.id} value={m.id}>
                    {`${m.material} — ${m.kNm3[0] === m.kNm3[1] ? fmtNum(m.kNm3[0], 1) : `${fmtNum(m.kNm3[0], 1)} a ${fmtNum(m.kNm3[1], 1)}`} kN/m³`}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Densidad en obra
              <CampoNum
                ariaLabel="Densidad del material en obra"
                unidad="t/m³"
                value={c.densidad?.tPorM3 ?? null}
                min={0.01}
                max={20}
                onCommit={(v) => onPatch({ densidad: { tPorM3: v } })}
              />
            </label>
          </>
        )}
        {varios && (
          <label className={styles.field}>
            Parte de la medición
            <CampoNum ariaLabel="Parte de la medición" value={c.parte ?? 1} min={0.01} max={1} placeholder="1" onCommit={(v) => onPatch({ parte: v ?? undefined })} />
          </label>
        )}
        <label className={styles.check}>
          <input type="checkbox" checked={!!c.reutilizable} onChange={(e) => onPatch({ reutilizable: e.target.checked || undefined })} />
          Se reutiliza
        </label>
        <button type="button" className="icon-btn" title="Quitar este residuo" aria-label="Quitar este residuo" onClick={onQuitar}>
          <Icon name="trash" size={15} />
        </button>
      </div>
      {info ? (
        <div className={styles.lerDesc}>
          {info.peligroso && <span className={styles.peligroso}>Peligroso · </span>}
          {info.descripcion}
          {info.aviso ? ` · ${info.aviso}` : ''}
        </div>
      ) : (
        <div className={`${styles.lerDesc} ${styles.peligroso}`}>{c.ler ? `${c.ler} no está en la lista vigente.` : 'Elige el código de la lista europea de residuos.'}</div>
      )}
      {resultado && (
        <div className={`${styles.formula} mono ${'error' in resultado || resultado.faltan.length ? styles.formulaWarn : ''}`}>
          {'error' in resultado ? resultado.error : resultado.formula}
        </div>
      )}
    </div>
  );
}

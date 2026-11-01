import { useState } from 'react';
import { nombreRiesgo, textoItem } from '../../core/ess/catalogo';
import { conEdicion, type FichaEnSeleccion } from '../../core/ess/seleccion';
import {
  CLAVES_RIESGO,
  type ClaveRiesgo,
  type EdicionFicha,
  type EdicionLista,
  type EstudioSsDatos,
  type ItemFicha,
} from '../../core/ess/tipos';
import { useObraStore } from '../../store';
import styles from '../residuos/Residuos.module.css';
import ss from './Seguridad.module.css';

type Lista = 'medidas' | 'protecciones' | 'epi';
const LISTAS: Array<[Lista, string]> = [
  ['medidas', 'Medidas preventivas'],
  ['protecciones', 'Protecciones colectivas'],
  ['epi', 'Equipos de protección individual'],
];

const sinVacias = (l: EdicionLista): EdicionLista | undefined => {
  const out: EdicionLista = {};
  if (l.quitados?.length) out.quitados = l.quitados;
  if (l.anadidos?.length) out.anadidos = l.anadidos;
  return out.quitados || out.anadidos ? out : undefined;
};

/** Lo que el técnico cambia dentro de una ficha: se guarda por ficha, como diferencia con el catálogo. */
export function EditorFicha({ f, datos }: { f: FichaEnSeleccion; datos: EstudioSsDatos }) {
  const set = useObraStore((s) => s.setEstudioSs);
  const ficha = f.ficha;
  const ed: EdicionFicha = datos.seleccion?.ediciones?.[ficha.id] ?? {};
  const guarda = (nueva: EdicionFicha) =>
    set({ seleccion: conEdicion(datos.seleccion, ficha.id, nueva) });

  const quitadosR = new Set(ed.riesgos?.quitados ?? []);
  const anadidosR = ed.riesgos?.anadidos ?? [];
  const riesgos = [...ficha.riesgos, ...(ficha.evita ?? [])];
  const setRiesgos = (quitados: ClaveRiesgo[], anadidos: typeof anadidosR) => {
    const r: NonNullable<EdicionFicha['riesgos']> = {};
    if (quitados.length) r.quitados = quitados;
    if (anadidos.length) r.anadidos = anadidos;
    guarda({ ...ed, riesgos: r.quitados || r.anadidos ? r : undefined });
  };
  const [nuevoRiesgo, setNuevoRiesgo] = useState<ClaveRiesgo | ''>('');
  const [causa, setCausa] = useState('');
  const libres = CLAVES_RIESGO.filter(
    (k) => !riesgos.some((r) => r.clave === k) && !anadidosR.some((r) => r.clave === k),
  );

  const setLista = (k: Lista, l: EdicionLista) => guarda({ ...ed, [k]: sinVacias(l) });

  return (
    <div className={styles.editor}>
      {f.partidas.length > 0 && (
        <div>
          <div className="sec-head">La piden estas partidas</div>
          <ul className={ss.partidas}>
            {f.partidas.slice(0, 8).map((p) => (
              <li key={p.partidaId}>
                <span className="mono">{p.code}</span> {p.title}
              </li>
            ))}
            {f.partidas.length > 8 && <li>y {f.partidas.length - 8} más</li>}
          </ul>
        </div>
      )}
      {f.motivos.some((m) => !m.startsWith('por ')) && (
        <p className={styles.nota}>
          Motivo: {f.motivos.filter((m) => !m.startsWith('por ')).join('; ')}.
        </p>
      )}
      {ficha.avisos?.map((a) => (
        <p key={a} className={styles.nota}>
          {a}
        </p>
      ))}
      {ficha.redactadaPorApp && (
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={ed.revisada === true}
            onChange={(e) => guarda({ ...ed, revisada: e.target.checked || undefined })}
          />
          Redactada por la app: la he revisado
        </label>
      )}

      <div className={ss.bloque}>
        <div className="sec-head">Riesgos</div>
        <ul className={ss.items}>
          {riesgos.map((r) => {
            const fuera = quitadosR.has(r.clave);
            return (
              <li key={r.clave} className={`${ss.item} ${fuera ? ss.quitado : ''}`}>
                <span>
                  {nombreRiesgo(r.clave)}
                  {r.causa ? ` (${r.causa})` : ''}
                </span>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() =>
                    setRiesgos(
                      fuera ? [...quitadosR].filter((x) => x !== r.clave) : [...quitadosR, r.clave],
                      anadidosR,
                    )
                  }
                >
                  {fuera ? 'Volver a poner' : 'Quitar'}
                </button>
              </li>
            );
          })}
          {anadidosR.map((r) => (
            <li key={r.clave} className={`${ss.item} ${ss.anadido}`}>
              <span>
                {nombreRiesgo(r.clave)}
                {r.causa ? ` (${r.causa})` : ''}
              </span>
              <button
                type="button"
                className={styles.link}
                onClick={() =>
                  setRiesgos(
                    [...quitadosR],
                    anadidosR.filter((x) => x.clave !== r.clave),
                  )
                }
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
        <div className={ss.anadir}>
          <select
            className={styles.select}
            aria-label="Riesgo que se añade"
            value={nuevoRiesgo}
            onChange={(e) => setNuevoRiesgo(e.target.value as ClaveRiesgo | '')}
          >
            <option value="">Añadir un riesgo…</option>
            {libres.map((k) => (
              <option key={k} value={k}>
                {nombreRiesgo(k)}
              </option>
            ))}
          </select>
          <input
            className={styles.input}
            aria-label="Causa del riesgo"
            placeholder="causa (opcional)"
            value={causa}
            onChange={(e) => setCausa(e.target.value)}
          />
          <button
            type="button"
            className={`tcol ${styles.btn}`}
            disabled={!nuevoRiesgo}
            onClick={() => {
              if (!nuevoRiesgo) return;
              setRiesgos(
                [...quitadosR],
                [
                  ...anadidosR,
                  causa.trim()
                    ? { clave: nuevoRiesgo, causa: causa.trim() }
                    : { clave: nuevoRiesgo },
                ],
              );
              setNuevoRiesgo('');
              setCausa('');
            }}
          >
            Añadir
          </button>
        </div>
      </div>

      {LISTAS.map(([k, titulo]) => (
        <ListaTextos
          key={k}
          titulo={titulo}
          items={ficha[k]}
          ed={ed[k] ?? {}}
          onChange={(l) => setLista(k, l)}
        />
      ))}
    </div>
  );
}

function ListaTextos({
  titulo,
  items,
  ed,
  onChange,
}: {
  titulo: string;
  items: readonly ItemFicha[];
  ed: EdicionLista;
  onChange: (l: EdicionLista) => void;
}) {
  const [nuevo, setNuevo] = useState('');
  const quitados = new Set(ed.quitados ?? []);
  const anadidos = ed.anadidos ?? [];
  const anadir = () => {
    const t = nuevo.trim();
    if (!t) return;
    onChange({ ...ed, anadidos: [...anadidos.filter((x) => x !== t), t] });
    setNuevo('');
  };
  return (
    <div className={ss.bloque}>
      <div className="sec-head">{titulo}</div>
      <ul className={ss.items}>
        {items.map((i) => {
          const txt = textoItem(i);
          const fuera = quitados.has(txt);
          return (
            <li key={txt} className={`${ss.item} ${fuera ? ss.quitado : ''}`}>
              <span>{txt}</span>
              <button
                type="button"
                className={styles.link}
                onClick={() =>
                  onChange({
                    ...ed,
                    quitados: fuera ? [...quitados].filter((x) => x !== txt) : [...quitados, txt],
                  })
                }
              >
                {fuera ? 'Volver a poner' : 'Quitar'}
              </button>
            </li>
          );
        })}
        {anadidos.map((txt) => (
          <li key={txt} className={`${ss.item} ${ss.anadido}`}>
            <span>{txt}</span>
            <button
              type="button"
              className={styles.link}
              onClick={() => onChange({ ...ed, anadidos: anadidos.filter((x) => x !== txt) })}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
      <div className={ss.anadir}>
        <input
          className={styles.input}
          aria-label={`Añadir a ${titulo.toLowerCase()}`}
          placeholder="Añadir…"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              anadir();
            }
          }}
        />
        <button
          type="button"
          className={`tcol ${styles.btn}`}
          disabled={!nuevo.trim()}
          onClick={anadir}
        >
          Añadir
        </button>
      </div>
    </div>
  );
}

/* ===========================================================================
   AnadirTambien — «Añadir también a…» (§5.7, A1): la MISMA forma en otras
   partidas. El suelo de un salón entra como su área en Solado, como su
   perímetro en Rodapié y como perímetro × 2,70 en Pintura.

   · Selección múltiple de partidas (recientes y buscador); en una partida
     por Unidades una superficie no se ofrece.
   · Por partida: la interpretación, las dimensiones fijas (las mismas de la
     franja, por partida), la cantidad resultante y el cambio de forma.
   · Un solo botón, todo o nada: si alguna no es válida no se crea ninguna y
     se marca cuál. Las líneas nuevas comparten `formaId` y el signo de la
     forma (un hueco entra como hueco), y cada una guarda su `magnitud`.
   · Cada medida sale de `prepararMedida` (la misma función del visor y del
     store) con la fila de su interpretación.
   =========================================================================== */
import { useMemo, useRef, useState } from 'react';
import { Icon, Modal } from '../../components';
import { medFormaDe } from '../../core/medForma';
import { fmtNum } from '../../core/money';
import { escalaDe, origenLegible } from '../../core/planoDatos';
import {
  ROTULO_FACTOR,
  TABLA_MEDIDA,
  celdaDe,
  esResta,
  filaDe,
  interpretacionesPara,
  prepararMedida,
  rotuloFija,
  textoInterpretacion,
  type Interpretacion,
  type ResultadoMedida,
  type ValorFijo,
} from '../../core/planoMedida';
import type { MedDim, MedLine, OrigenPlano, Partida, PlanoMeta } from '../../core/types';
import { useObraStore } from '../../store';
import { textoMotivoMedida, textoResultado } from '../../store/motivos';
import { usePlanoUiStore } from '../../store/planoUiStore';
import { leerFactor, leerFija } from './herramientas';
import styles from './Planos.module.css';

interface Opcion {
  p: Partida;
  chapterId: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

const NOMBRE_INTERP: Record<Interpretacion, string> = {
  area: 'Área',
  perimetro: 'Perímetro',
  longitud: 'Longitud',
  recuento: 'Recuento',
};

/** Por defecto: el área si encaja y la partida no es por metros; si no, la primera. */
function porDefecto(opciones: Interpretacion[], p: Partida): Interpretacion {
  if (opciones.includes('area') && medFormaDe(p) !== 'lin') return 'area';
  return opciones.includes('perimetro') ? 'perimetro' : opciones[0]!;
}

export function AnadirTambien({
  plano,
  pagina,
  linea,
  partidaOrigenId,
  onCerrar,
  onHecho,
}: {
  plano: PlanoMeta;
  pagina: number;
  linea: MedLine;
  partidaOrigenId: string;
  onCerrar: () => void;
  /** Tras añadir, con el texto del aviso. */
  onHecho: (texto: string) => void;
}) {
  const origen = linea.origen as OrigenPlano;
  const herramienta = origen.herramienta;
  const partidas = useObraStore((s) => s.partidas);
  const coefK = useObraStore((s) => s.rates.coefK);
  const recientesIds = usePlanoUiStore((s) => s.recientes[plano.id]);
  const fijasUi = usePlanoUiStore((s) => s.fijas);
  const factorUi = usePlanoUiStore((s) => s.factor);
  const supDirectaUi = usePlanoUiStore((s) => s.supDirecta);
  const [q, setQ] = useState('');
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [interp, setInterp] = useState<Record<string, Interpretacion>>({});
  const [error, setError] = useState<string | null>(null);
  const [intentado, setIntentado] = useState(false);
  const cancelar = useRef<HTMLButtonElement>(null);

  const escala = escalaDe(plano, pagina);
  const todas = useMemo<(Opcion & { opciones: Interpretacion[] })[]>(
    () =>
      Object.entries(partidas).flatMap(([chapterId, ps]) =>
        ps
          .filter((p) => p.id !== partidaOrigenId)
          .map((p) => ({ p, chapterId, opciones: interpretacionesPara(herramienta, p) }))
          .filter((o) => o.opciones.length > 0),
      ),
    [partidas, partidaOrigenId, herramienta],
  );
  const porId = useMemo(() => new Map(todas.map((o) => [o.p.id, o])), [todas]);
  const lista = useMemo(() => {
    const t = norm(q.trim());
    if (!t) {
      const rec = (recientesIds ?? []).map((id) => porId.get(id)).filter((o): o is (typeof todas)[number] => !!o);
      return rec.length ? rec : todas.slice(0, 8);
    }
    return todas.filter((o) => norm(`${o.p.pos} ${o.p.code} ${o.p.title}`).includes(t)).slice(0, 30);
  }, [q, recientesIds, porId, todas]);

  /** La medida preparada de un destino, con la MISMA función del visor. */
  const preparar = (o: Opcion & { opciones: Interpretacion[] }): { i: Interpretacion; r: ResultadoMedida } => {
    const i = interp[o.p.id] ?? porDefecto(o.opciones, o.p);
    const fijas: Partial<Record<MedDim, ValorFijo>> = {};
    for (const [k, v] of Object.entries(fijasUi[o.p.id] ?? {})) {
      const f = leerFija(v);
      if (f) fijas[k as MedDim] = f;
    }
    const r = prepararMedida({
      herramienta,
      fila: filaDe(herramienta, i),
      puntos: origen.puntos,
      plano,
      pagina,
      escala: herramienta === 'recuento' ? null : escala,
      partida: o.p,
      fijas,
      factor: leerFactor(factorUi[o.p.id]),
      restar: esResta(linea),
      comentario: linea.comment,
      aceptaSupDirecta: supDirectaUi[o.p.id] === true,
      formaId: origen.formaId,
      at: new Date().toISOString(),
      coefK,
    });
    return { i, r };
  };

  const elegidas = seleccion.map((id) => porId.get(id)).filter((o): o is (typeof todas)[number] => !!o);
  const preparadas = elegidas.map((o) => ({ o, ...preparar(o) }));
  const validas = preparadas.every((x) => x.r.ok);

  const anadir = () => {
    setIntentado(true);
    if (!preparadas.length || !validas) return; // todo o nada: se marca cuál falla
    const s = useObraStore.getState();
    const r = s.addPlanoLines({
      destinos: preparadas.map(({ o, r: m }) => {
        const ok = m as Extract<ResultadoMedida, { ok: true }>;
        return {
          chapterId: o.chapterId,
          partidaId: o.p.id,
          lineas: ok.lineas,
          ...(ok.cambioForma ? { medForma: ok.cambioForma } : {}),
          afterId: null,
          expectForma: medFormaDe(o.p),
          expectUd: o.p.ud,
        };
      }),
      expect: {
        docToken: s.docToken,
        planoId: plano.id,
        huella: plano.huella,
        pagina,
        calRev: herramienta === 'recuento' ? null : (escala?.rev ?? null),
      },
    });
    if (!r.ids.length) {
      setError(textoResultado(r));
      return;
    }
    for (const { o } of preparadas) usePlanoUiStore.getState().usarPartida(plano.id, o.p.id);
    const n = preparadas.length;
    onHecho(`Añadida a ${n} ${n === 1 ? 'partida' : 'partidas'}: ${preparadas.map(({ o }) => `${o.p.pos} ${o.p.title}`).join(', ')}`);
  };

  const quitar = (id: string) => setSeleccion((s) => s.filter((x) => x !== id));
  const poner = (id: string) => setSeleccion((s) => (s.includes(id) ? s : [...s, id]));
  const n = seleccion.length;

  return (
    <Modal
      open
      onClose={onCerrar}
      title="Añadir también a…"
      subtitle={linea.comment || undefined}
      icon="plus"
      initialFocus={cancelar}
      closeOnOverlay={false}
      footer={
        <>
          <button ref={cancelar} type="button" className={styles.btn} onClick={onCerrar}>
            Cancelar
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimario}`} disabled={!n} onClick={anadir}>
            {n ? `Añadir a ${n} ${n === 1 ? 'partida' : 'partidas'}` : 'Elige partidas'}
          </button>
        </>
      }
    >
      <div className={styles.anadir}>
        {preparadas.length > 0 && (
          <ul className={styles.anadirElegidas} aria-label="Partidas elegidas">
            {preparadas.map(({ o, i, r }) => {
              const forma = medFormaDe(o.p);
              const fila = filaDe(herramienta, i);
              const pasa = TABLA_MEDIDA[fila][forma].encaja === 'pasa-a-area';
              const formaFinal = pasa && (o.p.med.length === 0 || supDirectaUi[o.p.id]) ? 'area' : forma;
              const celda = celdaDe(fila, formaFinal);
              const campos =
                celda.encaja === true
                  ? [
                      ...celda.fijas.map((s) => ({ slot: s as MedDim | 'factor', rotulo: rotuloFija(formaFinal, s, celda.magnitud) })),
                      ...(celda.factor ? [{ slot: 'factor' as const, rotulo: ROTULO_FACTOR }] : []),
                    ]
                  : [];
              const invalida = !r.ok;
              return (
                <li key={o.p.id} className={`${styles.anadirFila} ${intentado && invalida ? styles.anadirFilaMal : ''}`}>
                  <div className={styles.anadirCab}>
                    <span className="mono">{o.p.pos}</span>
                    <span className={styles.anadirTitulo}>{o.p.title}</span>
                    <button type="button" className={`icon-btn ${styles.cabIcono}`} aria-label={`Quitar ${o.p.title}`} onClick={() => quitar(o.p.id)}>
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                  <div className={styles.anadirCuerpo}>
                    {o.opciones.length > 1 ? (
                      <select
                        aria-label={`Qué se añade a ${o.p.title}`}
                        value={i}
                        onChange={(e) => setInterp((x) => ({ ...x, [o.p.id]: e.target.value as Interpretacion }))}
                      >
                        {o.opciones.map((op) => (
                          <option key={op} value={op}>
                            {NOMBRE_INTERP[op]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{NOMBRE_INTERP[i]}</span>
                    )}
                    {(() => {
                      // La descripción solo si añade algo al nombre («perímetro × 2,7»).
                      const t = textoInterpretacion(herramienta, i, o.p, leerFactor(factorUi[o.p.id]));
                      return t.toLowerCase() === NOMBRE_INTERP[i].toLowerCase() ? null : <span className={styles.franjaTexto}>{t}</span>;
                    })()}
                    {campos.map((c) => {
                      const valor = c.slot === 'factor' ? (factorUi[o.p.id] ?? '') : (fijasUi[o.p.id]?.[c.slot] ?? '');
                      const falta = !(c.slot === 'factor' ? leerFactor(valor) : leerFija(valor));
                      return (
                        <label key={c.slot} className={`${styles.fija} ${falta ? styles.fijaFalta : ''}`}>
                          <span>{c.rotulo}</span>
                          <input
                            className="mono"
                            value={valor}
                            inputMode="decimal"
                            placeholder="0,00"
                            aria-label={`${c.rotulo} en ${o.p.title}`}
                            aria-invalid={falta || undefined}
                            onChange={(e) =>
                              c.slot === 'factor'
                                ? usePlanoUiStore.getState().setFactor(o.p.id, e.target.value)
                                : usePlanoUiStore.getState().setFija(o.p.id, c.slot, e.target.value)
                            }
                          />
                        </label>
                      );
                    })}
                    {pasa && o.p.med.length > 0 && (
                      <label className={styles.checkLinea}>
                        <input
                          type="checkbox"
                          checked={supDirectaUi[o.p.id] === true}
                          onChange={(e) => usePlanoUiStore.getState().setSupDirecta(o.p.id, e.target.checked)}
                        />
                        Medir esta partida por Superficie directa
                      </label>
                    )}
                  </div>
                  <div className={`mono ${styles.anadirResultado}`}>
                    {r.ok ? (
                      <>
                        {fmtNum(r.resumen.parcial)} {o.p.ud} · cantidad {fmtNum(r.resumen.antes.cantidad)} → {fmtNum(r.resumen.despues.cantidad)} {o.p.ud}
                        {r.cambioForma && <span className={styles.recalculoAviso}> · pasa a Superficie directa</span>}
                      </>
                    ) : (
                      <span className={styles.recalculoAviso} role={intentado ? 'alert' : undefined}>
                        {textoMotivoMedida(r)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <input
          className={styles.anadirBusca}
          value={q}
          placeholder="Buscar partida (código o nombre)"
          aria-label="Buscar partida"
          onChange={(e) => setQ(e.target.value)}
        />
        <ul className={styles.anadirOpciones} aria-label={q.trim() ? 'Partidas encontradas' : 'Partidas recientes'}>
          {lista
            .filter((o) => !seleccion.includes(o.p.id))
            .map((o) => (
              <li key={o.p.id}>
                <button type="button" className={`tcol ${styles.menuItem}`} onClick={() => poner(o.p.id)}>
                  <span className="mono">{o.p.pos}</span> {o.p.title} <span className={styles.franjaTexto}>· {o.p.ud}</span>
                </button>
              </li>
            ))}
          {lista.length === 0 && <li className={styles.franjaTexto}>Ninguna partida admite esta forma con esa búsqueda.</li>}
        </ul>
        {error && (
          <p className={styles.recalculoAviso} role="alert">
            {error}
          </p>
        )}
        {!origenLegible(origen) && <p className={styles.recalculoAviso}>Esta línea ya no tiene una forma legible.</p>}
      </div>
    </Modal>
  );
}

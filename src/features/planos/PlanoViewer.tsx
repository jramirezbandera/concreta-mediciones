/* ===========================================================================
   PlanoViewer — un plano abierto: aviso, barra de herramientas, lienzo con su
   capa, franja inferior y barra de control flotante (§5). Conecta el ciclo de
   medida (`core/planoCiclo`, reductor puro) con el ratón, el teclado y el
   store: traduce eventos y ejecuta los efectos.

   Teclado (§5.9, defensa en profundidad): la raíz lleva `data-planos-viewer`
   y `tabIndex=-1`, toma el foco al pulsar; dibujando o calibrando consume Esc,
   Enter, Retroceso, Espacio y Ctrl/⌘+Z; nombrando, las teclas de edición del
   comentario son nativas (solo se corta su propagación) y consume Enter y Esc.
   Los atajos de una tecla (§6) nunca actúan con el foco en un campo de texto.
   =========================================================================== */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components';
import { medFormaDe, medFormaDef } from '../../core/medForma';
import { lineParcial } from '../../core/medicion';
import { resumenCantidad } from '../../core/medPaste';
import { fmtNum } from '../../core/money';
import { REPOSO, cicloReducer, type Armada, type EfectoCiclo, type EstadoCiclo, type EventoCiclo } from '../../core/planoCiclo';
import { escalaDe, etiquetaDe, origenLegible } from '../../core/planoDatos';
import {
  areaLazo,
  dist,
  escalaN,
  longitudPolilinea,
  perimetroCerrado,
  rectanguloTresClics,
  redondearPunto,
} from '../../core/planoGeom';
import {
  ROTULO_FACTOR,
  celdaDe,
  lineasConEscala,
  prefijoComentario,
  prepararMedida,
  rotuloFija,
  type MotivoMedida,
  type ResultadoMedida,
  type ValorFijo,
} from '../../core/planoMedida';
import type { Escala, Herramienta, MedDim, MedLine, Partida, PlanoMeta, Punto } from '../../core/types';
import { isTextField } from '../../hooks/hotkeyGuards';
import { useSessionStore } from '../../persist';
import { useObraStore, useToastStore } from '../../store';
import { nextCalRev, nextFormaId } from '../../store/base';
import { deleteLines, locatePartida } from '../../store/medLineOps';
import { useMedUiStore } from '../../store/medUiStore';
import { textoResultado } from '../../store/motivos';
import { usePlanoUiStore } from '../../store/planoUiStore';
import { getDomainRevision, undo } from '../../store/temporal';
import { adjuntarPlano } from './adjuntar';
import { CalibrarPasos, CampoMetros } from './CalibrarPasos';
import { BotonAyuda } from './BotonAyuda';
import { textoEscala } from './textos';
import { cajaDe, formasDeLineas, otrasPaginas, type FormaCapa } from './capa';
import {
  HERRAMIENTAS_MEDIR,
  leerFactor,
  leerFija,
  motivoVisor,
  textoMotivoVisor,
  type ContextoVisor,
  type MotivoVisor,
} from './herramientas';
import { PlanoLienzo, type Ancla, type LienzoApi } from './PlanoLienzo';
import { PlanoToolbar } from './PlanoToolbar';
import { SelectorPartida } from './SelectorPartida';
import { usePaginaPdf, usePlanoDoc } from './usePlanoDoc';
import styles from './Planos.module.css';

const TEXTO_DESCARTE: Record<string, string> = {
  partida: 'cambiaste de partida',
  pagina: 'cambiaste de página',
  plano: 'cambiaste de plano',
  ocupante: 'cerraste el visor',
  escala: 'cambió la escala de la página',
  herramienta: 'cambiaste de herramienta',
};
const TEXTO_RECHAZO: Record<string, string> = {
  cruce: 'La forma se cruza: rehazla en orden.',
  'longitud-cero': 'La forma no tiene longitud.',
  'pocos-vertices': 'Hace falta al menos 3 puntos.',
  'area-cero': 'La superficie es 0.',
  'demasiados-puntos': 'Esta forma ya tiene 2 000 puntos: termínala.',
};
const TEXTO_SOLO_LECTURA = {
  'otra-pestana': 'Esta obra está abierta en otra pestaña: aquí solo se puede ver.',
  'sin-recargar': 'Esta obra no se pudo volver a leer: aquí solo se puede ver. Recarga la página.',
  'mas-nueva': 'Esta obra se guardó con una versión más nueva de Concreta: aquí solo se puede ver.',
} as const;

const m = (v: number) => `${fmtNum(v)} m`;
const m2 = (v: number) => `${fmtNum(v)} m²`;

/** Lectura en vivo mientras se dibuja (§5.2): con la escala activa. */
function lecturaEnVivo(h: Herramienta, puntos: Punto[], cursor: Punto | null, e: Escala | null): string {
  if (h === 'recuento') return `${puntos.length} ${puntos.length === 1 ? 'punto' : 'puntos'}`;
  if (!e) return '';
  const k = e.mPorUnidad;
  const pts = cursor ? [...puntos, cursor] : puntos;
  const esc = textoEscala(e.n);
  if (h === 'longitud') return `${m(longitudPolilinea(pts) * k)} · ${esc}`;
  if (h === 'rectangulo') {
    if (pts.length < 2) return esc;
    if (pts.length === 2) return `${m(dist(pts[0]!, pts[1]!) * k)} · ${esc}`;
    const r = rectanguloTresClics(pts[0]!, pts[1]!, pts[2]!);
    return `${fmtNum(dist(r[0], r[1]) * k)} × ${fmtNum(dist(r[1], r[2]) * k)} m · ${m2(areaLazo(r) * k * k)} · ${esc}`;
  }
  if (pts.length < 3) return `${m(longitudPolilinea(pts) * k)} · ${esc}`;
  return `${m2(areaLazo(pts) * k * k)} · perímetro ${m(perimetroCerrado(pts) * k)} · ${esc}`;
}

export function PlanoViewer({
  plano,
  estrecha,
  onCerrarVisor,
}: {
  plano: PlanoMeta;
  /** Por debajo de 1024 px solo se ve: medir está deshabilitado. */
  estrecha: boolean;
  onCerrarVisor: () => void;
}) {

  const partidas = useObraStore((s) => s.partidas);
  const openPartidaId = useObraStore((s) => s.openPartidaId);
  const coefK = useObraStore((s) => s.rates.coefK);
  const readonlyMotivo = useSessionStore((s) => (s.readonly ? (s.readonlyMotivo ?? 'otra-pestana') : null));
  const soloLectura = readonlyMotivo ? TEXTO_SOLO_LECTURA[readonlyMotivo] : null;

  const paginaUi = usePlanoUiStore((s) => s.pagina);
  const pagina = Math.min(Math.max(1, paginaUi), plano.paginas);
  const restar = usePlanoUiStore((s) => s.restar);
  const destacar = usePlanoUiStore((s) => s.destacar);
  const remedir = usePlanoUiStore((s) => s.remedir);
  const pantallaCompleta = usePlanoUiStore((s) => s.pantallaCompleta);

  const [intentoDoc, setIntentoDoc] = useState(0);
  const docE = usePlanoDoc(plano.huella, plano.archivo, intentoDoc);
  const doc = docE.estado === 'listo' ? docE.doc : null;
  const info = usePaginaPdf(doc, pagina);
  const escala = escalaDe(plano, pagina);

  // Partida abierta: la única fuente del destino (§5.4).
  const loc = useMemo(() => {
    if (!openPartidaId) return null;
    for (const [chapterId, ps] of Object.entries(partidas)) {
      const partida = ps.find((p) => p.id === openPartidaId);
      if (partida) return { chapterId, partida };
    }
    return null;
  }, [partidas, openPartidaId]);
  const partida = loc?.partida ?? null;
  const partidaId = partida?.id ?? null;

  const fijasTexto = usePlanoUiStore((s) => (partidaId ? s.fijas[partidaId] : undefined));
  const factorTexto = usePlanoUiStore((s) => (partidaId ? s.factor[partidaId] : undefined));
  const supDirecta = usePlanoUiStore((s) => (partidaId ? (s.supDirecta[partidaId] ?? null) : null));

  // Propuesta de fijas y factor: los de la última línea medida de la partida (§3.3).
  useEffect(() => {
    if (!partida) return;
    const ui = usePlanoUiStore.getState();
    const ultima = [...partida.med].reverse().find((l) => origenLegible(l.origen));
    if (!ultima || !origenLegible(ultima.origen)) return;
    const o = ultima.origen;
    for (const [slot, v] of Object.entries(o.fijas ?? {}) as [MedDim, number][])
      if (ui.fijas[partida.id]?.[slot] === undefined) ui.setFija(partida.id, slot, ultima.expr?.[slot] ?? fmtNum(v, 3).replace(/\.(?=\d{3})/g, ''));
    if (o.factor !== undefined && ui.factor[partida.id] === undefined) ui.setFactor(partida.id, fmtNum(o.factor, 2));
  }, [partida]);

  const fijas = useMemo(() => {
    const out: Partial<Record<MedDim, ValorFijo>> = {};
    for (const [k, t] of Object.entries(fijasTexto ?? {})) {
      const v = leerFija(t);
      if (v) out[k as MedDim] = v;
    }
    return out;
  }, [fijasTexto]);
  const factor = leerFactor(factorTexto);

  const [pintado, setPintado] = useState<{ estado: 'pintando' | 'listo' | 'error'; causa?: string }>({ estado: 'pintando' });
  const ctx: ContextoVisor = {
    partida,
    escala,
    fijas,
    factor,
    supDirecta,
    soloLectura,
    estrecha,
    pintada: pintado.estado === 'listo',
  };
  const motivos = Object.fromEntries(HERRAMIENTAS_MEDIR.map((h) => [h, motivoVisor(h, ctx)])) as Record<
    Herramienta,
    MotivoVisor | null
  >;
  const motivoCalibrar = soloLectura ?? (estrecha ? 'Para calibrar, usa una pantalla más ancha.' : null);

  /* ---- mensajes (aviso único y aria-live) ----------------------------------------- */
  const [mensaje, setMensaje] = useState<{
    texto: string;
    tono: 'info' | 'warn' | 'error';
    n: number;
    /** Lleva «?» a la ayuda (calibración y «no encaja», §7.2). */
    ayuda?: boolean;
  } | null>(null);
  const [pista, setPista] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState({ texto: '', n: 0 });
  const decir = useCallback((texto: string) => setAnuncio((a) => ({ texto, n: a.n + 1 })), []);
  const avisar = useCallback(
    (texto: string, tono: 'info' | 'warn' | 'error' = 'warn', ayuda = false) => {
      setMensaje((x) => ({ texto, tono, n: (x?.n ?? 0) + 1, ayuda }));
      decir(texto);
    },
    [decir],
  );
  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 7000);
    return () => clearTimeout(t);
  }, [mensaje]);

  /* ---- el ciclo ---------------------------------------------------------------------- */
  const [estado, setEstado] = useState<EstadoCiclo>(REPOSO);
  const estadoRef = useRef(estado);
  const efectosRef = useRef<(efs: EfectoCiclo[], nuevo: EstadoCiclo, antes: EstadoCiclo) => void>(() => undefined);
  const dispatch = useCallback((ev: EventoCiclo) => {
    const antes = estadoRef.current;
    const paso = cicloReducer(antes, ev);
    estadoRef.current = paso.estado;
    setEstado(paso.estado);
    efectosRef.current(paso.efectos, paso.estado, antes);
  }, []);

  const lienzoApi = useRef<LienzoApi | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const comentarioRef = useRef<HTMLInputElement>(null);
  const [espacio, setEspacio] = useState(false);
  const [cursor, setCursor] = useState<Punto | null>(null);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [destacada, setDestacada] = useState<string | null>(null);
  const [etiqueta, setEtiqueta] = useState('');
  const formaIdRef = useRef<string>('');
  const atRef = useRef<string>('');

  const prefijo = prefijoComentario(plano, pagina);

  // Medida preparada (NOMBRANDO): la vista previa, la confirmación y el store usan
  // la MISMA función (§4.2).
  const preparada = useMemo<ResultadoMedida | null>(() => {
    if (estado.fase !== 'nombrando' || !partida) return null;
    return prepararMedida({
      herramienta: estado.armada,
      puntos: estado.puntos,
      plano,
      pagina,
      escala,
      partida,
      fijas,
      factor,
      restar,
      comentario: `${prefijo}${estado.texto}`,
      aceptaSupDirecta: supDirecta ?? undefined,
      formaId: formaIdRef.current,
      at: atRef.current,
      coefK,
    });
  }, [estado, partida, plano, pagina, escala, fijas, factor, restar, prefijo, supDirecta, coefK]);

  /** Punto de inserción (§5.3): tras la línea con el foco o al final; avanza con
   *  cada línea creada desde el visor. */
  function afterIdPara(p: Partida): string | null {
    const ui = usePlanoUiStore.getState();
    if (ui.insercion?.partidaId === p.id && (ui.insercion.afterId === null || p.med.some((l) => l.id === ui.insercion!.afterId)))
      return ui.insercion.afterId;
    const mu = useMedUiStore.getState();
    const foco = mu.partidaId === p.id ? mu.lastFocusedLineId : null;
    return foco && p.med.some((l) => l.id === foco) ? foco : null;
  }

  function crear(): void {
    const e = estadoRef.current;
    if (e.fase !== 'nombrando' || !loc || !preparada?.ok) return;
    const store = useObraStore.getState();
    const expect = { docToken: store.docToken, planoId: plano.id, huella: plano.huella, pagina, calRev: escala?.rev ?? null };
    const forma = medFormaDe(loc.partida);
    let res;
    if (e.sustituye) {
      const hit = loc.partida.med.find((l) => l.id === e.sustituye);
      if (!hit) {
        dispatch({ tipo: 'esc' });
        return;
      }
      const base = {
        lineId: e.sustituye,
        preparada: preparada.lineas[0]!,
        expect: {
          ...expect,
          expectForma: forma,
          expectUd: loc.partida.ud,
          valores: { comment: hit.comment, uds: hit.uds, largo: hit.largo, ancho: hit.ancho, alto: hit.alto },
        },
      };
      res = store.remeasureLine(base);
      if (res.reason === 'certificada') {
        if (!window.confirm(`${textoResultado(res)}\n\n¿Sustituir igualmente su medida?`)) return;
        res = store.remeasureLine({ ...base, expect: { ...base.expect, certificadaOk: true } });
      }
    } else {
      res = store.addPlanoLines({
        destinos: [
          {
            chapterId: loc.chapterId,
            partidaId: loc.partida.id,
            lineas: preparada.lineas,
            ...(preparada.cambioForma ? { medForma: preparada.cambioForma } : {}),
            afterId: afterIdPara(loc.partida),
            expectForma: forma,
            expectUd: loc.partida.ud,
          },
        ],
        expect,
      });
    }
    const id = res.ids[0];
    if (!id) {
      if (res.reason === 'stale') dispatch({ tipo: 'stale' });
      avisar(textoResultado(res), 'error');
      return;
    }
    const ui = usePlanoUiStore.getState();
    if (!e.sustituye) ui.setInsercion({ partidaId: loc.partida.id, afterId: id });
    ui.usarPartida(plano.id, loc.partida.id);
    const p = locatePartida(loc.partida.id)?.partida;
    const n = (p?.med.findIndex((l) => l.id === id) ?? -1) + 1;
    const l = p?.med.find((x) => x.id === id);
    const ud = p?.ud ?? '';
    decir(`Línea ${n} ${e.sustituye ? 'medida de nuevo' : 'creada'}: ${l?.comment ?? ''}, ${fmtNum(l ? lineParcial(l) : 0)} ${ud}`);
    if (preparada.cambioForma) {
      const rev = getDomainRevision();
      useToastStore.getState().show(
        'Esta partida se mide ahora por Superficie directa',
        {
          label: 'Deshacer',
          run: () => {
            if (getDomainRevision() === rev) undo();
          },
        },
        { rev },
      );
    }
    dispatch({ tipo: 'creada', lineId: id });
    // La línea se lleva a la vista SIN mover el foco (sigue en el visor).
    requestAnimationFrame(() =>
      document.querySelector(`[data-lineid="${id}"]`)?.scrollIntoView?.({ block: 'nearest' }),
    );
    raizRef.current?.focus();
  }

  function guardarCalibracion(datos: Extract<EfectoCiclo, { tipo: 'calibrada' }>['datos']): void {
    if (!info) return;
    const store = useObraStore.getState();
    const r = redondearPunto;
    const esc: Escala = {
      rev: nextCalRev(),
      mPorUnidad: datos.mPorUnidad,
      n: escalaN(datos.mPorUnidad, info.userUnit),
      ref: { ...datos.ref, a: r(datos.ref.a), b: r(datos.ref.b) },
      comprobacion: { ...datos.comprobacion, a: r(datos.comprobacion.a), b: r(datos.comprobacion.b) },
      at: new Date().toISOString(),
    };
    const res = store.setPlanoPageScale({ planoId: plano.id, pagina, escala: esc, expect: { docToken: store.docToken } });
    if (!res.ids.length) {
      avisar(textoResultado(res), 'error');
      return;
    }
    const et = etiqueta.trim();
    if (et !== (etiquetaDe(plano, pagina) ?? ''))
      store.setPlanoPageLabel({ planoId: plano.id, pagina, etiqueta: et, expect: { docToken: store.docToken } });
    const nombre = et || `Pág. ${pagina}`;
    const texto = `${nombre} calibrada ${textoEscala(esc.n)} · comprobada ${fmtNum(datos.comprobacion.desviacion * 100, 1)} %`;
    useToastStore.getState().show(texto);
    decir(texto);
  }

  // Los efectos se leen con los cierres de ESTE render.
  efectosRef.current = (efs, nuevo, antes) => {
    for (const ef of efs) {
      switch (ef.tipo) {
        case 'seleccionar':
          break; // la selección vive en el estado del ciclo
        case 'borrar': {
          if (!partidaId) break;
          deleteLines(partidaId, [ef.forma], { toast: true });
          dispatch({ tipo: 'contexto', que: 'partida' }); // cierra el popover
          break;
        }
        case 'motivo':
          atenderMotivo(ef.motivo as MotivoVisor);
          break;
        case 'rechazo':
          setPista(TEXTO_RECHAZO[ef.razon] ?? null);
          decir(TEXTO_RECHAZO[ef.razon] ?? '');
          break;
        case 'preparar':
          if (antes.fase === 'dibujando') {
            formaIdRef.current = nextFormaId();
            atRef.current = new Date().toISOString();
            // «Volver a medir»: el comentario de la línea sin su prefijo.
            if (nuevo.fase === 'nombrando' && nuevo.sustituye && partida) {
              const l = partida.med.find((x) => x.id === nuevo.sustituye);
              if (l) {
                const texto = l.comment.startsWith(prefijo) ? l.comment.slice(prefijo.length) : l.comment;
                estadoRef.current = { ...nuevo, texto };
                setEstado(estadoRef.current);
              }
            }
          }
          setPista(null);
          break;
        case 'crear':
          crear();
          break;
        case 'escReposo':
          if (usePlanoUiStore.getState().pantallaCompleta) usePlanoUiStore.getState().setPantallaCompleta(false);
          else onCerrarVisor();
          break;
        case 'descartada':
          avisar(`Forma descartada: ${TEXTO_DESCARTE[ef.que] ?? 'cambió el contexto'}.`, 'info');
          break;
        case 'restaurar':
          break;
        case 'calibrada':
          guardarCalibracion(ef.datos);
          break;
      }
    }
  };

  /** Qué hace el visor con un motivo: decirlo y, si lo hay, su arreglo (§7.2). */
  function atenderMotivo(mo: MotivoVisor | MotivoMedida): void {
    avisar(textoMotivoVisor(mo), 'warn', mo.motivo === 'no-encaja' || mo.motivo === 'sin-calibrar');
    if (mo.motivo === 'no-encaja') dispatch({ tipo: 'herramienta', armada: mo.usa });
    else if (mo.motivo === 'sin-partida') setSelectorAbierto(true);
    else if (mo.motivo === 'falta-dimension' || mo.motivo === 'kgm-sin-resolver')
      requestAnimationFrame(() =>
        raizRef.current
          ?.querySelector<HTMLInputElement>(`[data-fija="${mo.motivo === 'falta-dimension' ? mo.slot : 'ancho'}"]`)
          ?.focus(),
      );
  }

  /* ---- cambios de contexto bajo una forma a medio dibujar (§5.3) --------------- */
  const previo = useRef({ partidaId, pagina, planoId: plano.id, rev: escala?.rev ?? null });
  useEffect(() => {
    const p = previo.current;
    const que =
      p.planoId !== plano.id
        ? 'plano'
        : p.pagina !== pagina
          ? 'pagina'
          : p.partidaId !== partidaId
            ? 'partida'
            : p.rev !== (escala?.rev ?? null)
              ? 'escala'
              : null;
    previo.current = { partidaId, pagina, planoId: plano.id, rev: escala?.rev ?? null };
    if (que) dispatch({ tipo: 'contexto', que });
  }, [partidaId, pagina, plano.id, escala?.rev, dispatch]);

  // Etiqueta propuesta al calibrar: la actual o «P<n>».
  useEffect(() => {
    if (estado.fase === 'calibrando') setEtiqueta((t) => t || etiquetaDe(plano, pagina) || '');
    else setEtiqueta('');
  }, [estado.fase, plano, pagina]);

  /* ---- «Ver en plano» y «Volver a medir» pedidos desde el presupuesto ---------- */
  useEffect(() => {
    if (!destacar || destacar.planoId !== plano.id || destacar.pagina !== pagina || pintado.estado !== 'listo') return;
    const l = partida?.med.find((x) => x.id === destacar.lineId);
    const o = l?.origen;
    if (!origenLegible(o)) return;
    lienzoApi.current?.encuadrar(cajaDe(o.puntos));
    setDestacada(destacar.lineId);
    const t = setTimeout(() => setDestacada(null), 1500);
    return () => clearTimeout(t);
  }, [destacar, plano.id, pagina, pintado.estado, partida]);

  useEffect(() => {
    if (!remedir || !partida) return;
    const l = partida.med.find((x) => x.id === remedir.lineId);
    const o = l?.origen;
    usePlanoUiStore.getState().limpiarRemedir();
    if (!l || !origenLegible(o) || o.planoId !== plano.id) return;
    if (o.pagina !== pagina) usePlanoUiStore.getState().setPagina(o.pagina);
    usePlanoUiStore.getState().setRestar(typeof l.uds === 'number' && l.uds < 0);
    dispatch({ tipo: 'volverAMedir', lineId: l.id, herramienta: o.herramienta });
    raizRef.current?.focus();
  }, [remedir, partida, plano.id, pagina, dispatch]);

  /* ---- herramientas ------------------------------------------------------------------ */
  function elegirHerramienta(h: Armada): void {
    if (h === 'mano') {
      dispatch({ tipo: 'herramienta', armada: 'mano' });
      return;
    }
    const mo = motivos[h];
    if (!mo || mo.motivo === 'falta-dimension' || mo.motivo === 'superficie-en-sup' || mo.motivo === 'pintando') {
      dispatch({ tipo: 'herramienta', armada: h });
      if (mo && mo.motivo !== 'superficie-en-sup') atenderMotivo(mo);
      return;
    }
    if (mo.motivo === 'sin-calibrar') {
      avisar(textoMotivoVisor(mo));
      empezarCalibrar();
      return;
    }
    atenderMotivo(mo);
  }

  function empezarCalibrar(): void {
    if (motivoCalibrar) {
      avisar(motivoCalibrar);
      return;
    }
    const n = lineasConEscala(useObraStore.getState().partidas, plano.id, pagina);
    if (n > 0) {
      avisar(textoResultado({ reason: 'has-lines', detalle: { n } }));
      return;
    }
    dispatch({ tipo: 'calibrar' });
  }

  const armada = estado.armada;
  const armadaMide = armada !== 'mano' && estado.fase !== 'calibrando';
  const motivoArmada = armadaMide ? motivos[armada as Herramienta] : null;

  /* ---- teclado --------------------------------------------------------------------------- */
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    const fase = estadoRef.current.fase;
    const enCampo = isTextField(e.target);
    const consumir = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    const mod = e.ctrlKey || e.metaKey;
    if (enCampo) {
      if (fase === 'nombrando' && (e.target as HTMLElement).dataset.comentario !== undefined) {
        if (e.key === 'Enter') {
          consumir();
          intentarCrear(e.nativeEvent.isComposing);
        } else if (e.key === 'Escape') {
          consumir();
          dispatch({ tipo: 'esc' });
          raizRef.current?.focus();
        } else e.stopPropagation(); // edición nativa: Retroceso, Ctrl+Z… no llegan a los atajos
        return;
      }
      if (e.key === 'Escape') {
        consumir();
        if (fase !== 'reposo') dispatch({ tipo: 'esc' });
        (e.target as HTMLElement).blur();
        raizRef.current?.focus();
        return;
      }
      if (e.key === 'Enter' && fase === 'calibrando') {
        consumir();
        confirmarCalibracion();
        return;
      }
      e.stopPropagation();
      return;
    }
    const ocupado = fase === 'dibujando' || fase === 'calibrando';
    if (e.key === 'Escape') {
      consumir();
      dispatch({ tipo: 'esc' });
      return;
    }
    if (e.key === 'Enter') {
      if (fase === 'dibujando') {
        consumir();
        dispatch({ tipo: 'enter' });
      } else if (fase === 'calibrando') {
        consumir();
        confirmarCalibracion();
      } else if (fase === 'nombrando') {
        consumir();
        intentarCrear(false);
      }
      return;
    }
    if (e.key === 'Backspace' || (mod && !e.shiftKey && e.key.toLowerCase() === 'z')) {
      if (fase === 'dibujando') {
        consumir();
        dispatch({ tipo: 'retroceso' });
      } else if (ocupado) consumir();
      return; // en reposo, Ctrl+Z llega al deshacer global
    }
    if (e.key === ' ') {
      consumir();
      if (!e.repeat) setEspacio(true);
      return;
    }
    if (e.key === 'Delete') {
      consumir();
      dispatch({ tipo: 'supr' });
      return;
    }
    if (mod || e.altKey) return;
    const k = e.key.toLowerCase();
    const atajo: Record<string, () => void> = {
      m: () => elegirHerramienta('mano'),
      l: () => elegirHerramienta('longitud'),
      s: () => elegirHerramienta('superficie'),
      r: () => elegirHerramienta('rectangulo'),
      n: () => elegirHerramienta('recuento'),
      c: () => empezarCalibrar(),
      d: () => usePlanoUiStore.getState().setRestar(!usePlanoUiStore.getState().restar),
      f: () => lienzoApi.current?.ajustar(),
      '+': () => lienzoApi.current?.zoom(1.25),
      '=': () => lienzoApi.current?.zoom(1.25),
      '-': () => lienzoApi.current?.zoom(1 / 1.25),
    };
    const fn = atajo[k];
    if (fn) {
      consumir();
      fn();
    }
  }

  function intentarCrear(componiendo: boolean): void {
    if (componiendo) {
      dispatch({ tipo: 'enter', componiendo: true });
      return;
    }
    const r = preparada;
    if (!r) return;
    dispatch({ tipo: 'enter', motivo: r.ok ? null : (r as MotivoMedida) });
  }

  function confirmarCalibracion(): void {
    dispatch({ tipo: 'confirmar', px: lienzoApi.current?.escala() ?? 1, userUnit: info?.userUnit ?? 1 });
  }

  /* ---- capa ------------------------------------------------------------------------------ */
  const formas: FormaCapa[] = useMemo(
    () => (partida ? formasDeLineas(partida.med, plano.id, pagina) : []),
    [partida, plano.id, pagina],
  );
  const vacioOtras = useMemo(
    () => (partida && !formas.length ? otrasPaginas(partida.med, plano.id, pagina) : []),
    [partida, formas.length, plano.id, pagina],
  );
  const seleccion = estado.fase === 'reposo' ? estado.seleccion : null;
  const atenuada =
    (estado.fase === 'reposo' || estado.fase === 'dibujando' || estado.fase === 'nombrando') && estado.sustituye
      ? estado.sustituye
      : null;

  const anclas: Ancla[] = [];
  if (estado.fase === 'calibrando') {
    const t = estado[estado.paso];
    if (t.a && t.b)
      anclas.push({
        key: `metros-${estado.paso}`,
        p: [(t.a[0] + t.b[0]) / 2, (t.a[1] + t.b[1]) / 2],
        nodo: (
          <CampoMetros
            valor={t.metros}
            autoFocus
            onCambio={(texto) => dispatch({ tipo: 'metros', cual: estado.paso, texto })}
            onConfirmar={confirmarCalibracion}
          />
        ),
      });
  }
  if (seleccion && partida) {
    const f = formas.find((x) => x.lineId === seleccion);
    const l = partida.med.find((x) => x.id === seleccion);
    if (f && l)
      anclas.push({
        key: 'popover-forma',
        p: f.puntos[0]!,
        nodo: (
          <PopoverForma
            linea={l}
            numero={f.numero}
            partida={partida}
            soloLectura={!!soloLectura || estrecha}
            onVerLinea={() => document.querySelector(`[data-lineid="${l.id}"]`)?.scrollIntoView?.({ block: 'center' })}
            onRemedir={() => {
              const o = l.origen;
              if (!origenLegible(o)) return;
              usePlanoUiStore.getState().setRestar(typeof l.uds === 'number' && l.uds < 0);
              dispatch({ tipo: 'volverAMedir', lineId: l.id, herramienta: o.herramienta });
            }}
            onBorrar={() => dispatch({ tipo: 'supr' })}
          />
        ),
      });
  }

  const dibujo =
    estado.fase === 'dibujando' || estado.fase === 'nombrando'
      ? {
          herramienta: estado.armada,
          puntos: estado.puntos,
          cruce: estado.fase === 'dibujando' && estado.cruce,
          resta: restar,
          cerrada: estado.fase === 'nombrando',
        }
      : null;

  /* ---- aviso único (§5.2): el más prioritario ------------------------------------------ */
  const ilegibles = useObraStore((s) => s._ilegible?.length ?? 0);
  let aviso: {
    texto: string;
    tono: 'info' | 'warn' | 'error';
    accion?: { texto: string; run: () => void };
    ayuda?: boolean;
  } | null = mensaje ? { texto: mensaje.texto, tono: mensaje.tono, ayuda: mensaje.ayuda } : null;
  if (!aviso && docE.estado === 'no-disponible') aviso = null; // lo explica el cuerpo
  if (!aviso && docE.estado === 'listo' && !escala && estado.fase !== 'calibrando')
    aviso = {
      texto: 'Calibra esta página para medir longitudes y superficies. Recuento funciona sin escala.',
      tono: 'info',
      accion: motivoCalibrar ? undefined : { texto: 'Calibrar', run: empezarCalibrar },
    };
  if (!aviso && ilegibles > 0)
    aviso = { texto: `${ilegibles} datos de planos no se pueden leer; las líneas conservan sus números.`, tono: 'warn' };

  const ariaLienzo = `Plano ${etiquetaDe(plano, pagina) ?? `página ${pagina}`}, ${escala ? textoEscala(escala.n) : 'sin calibrar'}, herramienta ${
    estado.fase === 'calibrando' ? 'Calibrar' : armada === 'mano' ? 'Mano' : armada
  }`;

  return (
    <div
      ref={raizRef}
      className={styles.visor}
      data-planos-viewer=""
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onKeyUp={(e) => {
        if (e.key === ' ') setEspacio(false);
      }}
      onPointerDown={(e) => {
        const t = e.target as HTMLElement;
        if (!t.closest('input, button, textarea, select, [data-no-foco]')) raizRef.current?.focus();
      }}
    >
      <div className={`${styles.aviso} ${aviso ? styles[`aviso_${aviso.tono}`] : ''}`} role={aviso ? 'status' : undefined}>
        {aviso && (
          <>
            <Icon name={aviso.tono === 'info' ? 'crosshair' : 'alert'} size={14} />
            <span className={styles.avisoTexto}>{aviso.texto}</span>
            {aviso.ayuda && <BotonAyuda />}
            {aviso.accion && (
              <button type="button" className={styles.btn} onClick={aviso.accion.run}>
                {aviso.accion.texto}
              </button>
            )}
          </>
        )}
      </div>

      <PlanoToolbar
        armada={armada}
        calibrando={estado.fase === 'calibrando'}
        motivos={motivos}
        motivoCalibrar={motivoCalibrar}
        restar={restar}
        onHerramienta={elegirHerramienta}
        onCalibrar={empezarCalibrar}
        onRestar={() => usePlanoUiStore.getState().setRestar(!restar)}
        onZoom={(f) => lienzoApi.current?.zoom(f)}
        onAjustar={() => lienzoApi.current?.ajustar()}
      />

      <div className={styles.lienzoWrap}>
        {docE.estado === 'cargando' && <div className={styles.estadoLienzo}>Abriendo el plano…</div>}
        {docE.estado === 'error' && (
          <div className={styles.estadoLienzo} role="alert">
            <p>{docE.texto}</p>
            <button type="button" className={styles.btn} onClick={() => setIntentoDoc((x) => x + 1)}>
              Reintentar
            </button>
          </div>
        )}
        {docE.estado === 'no-disponible' && <NoDisponible plano={plano} />}
        {doc && info && (
          <PlanoLienzo
            apiRef={lienzoApi}
            doc={doc}
            n={pagina}
            info={info}
            formas={formas}
            seleccion={seleccion}
            destacada={destacada}
            atenuada={atenuada}
            dibujo={dibujo}
            calibrar={estado.fase === 'calibrando' ? { paso: estado.paso, cota: estado.cota, comprobacion: estado.comprobacion } : null}
            anclas={anclas}
            modo={armadaMide || estado.fase === 'calibrando' ? 'medir' : 'mano'}
            espacio={espacio}
            ariaLabel={ariaLienzo}
            onClic={(p, meta) =>
              dispatch({ tipo: 'clic', p, px: meta.px, mayus: meta.mayus, detalle: meta.detalle, forma: meta.forma, motivo: motivoArmada })
            }
            onDobleClic={() => dispatch({ tipo: 'dobleClic' })}
            onMoverVertice={(i, p) => dispatch({ tipo: 'moverVertice', i, p })}
            onMoverCota={(cual, p) => dispatch({ tipo: 'moverPunto', cual, p })}
            onCursor={(p) => setCursor(p)}
            onPintado={(est, causa) => setPintado({ estado: est, causa })}
          />
        )}
        {doc && pintado.estado === 'pintando' && <div className={styles.pintando}>Pintando…</div>}
        {doc && pintado.estado === 'error' && (
          <div className={styles.estadoLienzo} role="alert">
            <p>
              No se pudo pintar esta página de «{plano.archivo}»{pintado.causa ? `: ${pintado.causa}` : ''}.
            </p>
            <button type="button" className={styles.btn} onClick={() => lienzoApi.current?.reintentar()}>
              Reintentar
            </button>
          </div>
        )}
        {doc && partida && !formas.length && vacioOtras.length > 0 && estado.fase === 'reposo' && (
          <div className={styles.vacioCapa}>
            Esta partida tiene medidas en{' '}
            {vacioOtras.map((n, i) => (
              <span key={n}>
                {i > 0 && (i === vacioOtras.length - 1 ? ' y ' : ', ')}
                <button type="button" className={styles.enlace} onClick={() => usePlanoUiStore.getState().setPagina(n)}>
                  {etiquetaDe(plano, n) ?? `Pág. ${n}`}
                </button>
              </span>
            ))}
          </div>
        )}
        {estado.fase === 'dibujando' && (
          <div className={styles.control} data-no-foco="">
            <button type="button" className={`${styles.btnControl} ${styles.btnPrimario}`} onClick={() => dispatch({ tipo: 'terminar' })}>
              Terminar ({estado.puntos.length})
            </button>
            <button type="button" className={styles.btnControl} onClick={() => dispatch({ tipo: 'retroceso' })}>
              Deshacer punto
            </button>
            <button type="button" className={styles.btnControl} onClick={() => dispatch({ tipo: 'esc' })}>
              Cancelar
            </button>
          </div>
        )}
      </div>

      <div className={styles.franja}>
        <div className={styles.franjaFila1}>
          <SelectorPartida
            planoId={plano.id}
            partida={partida}
            abierto={selectorAbierto}
            onAbierto={setSelectorAbierto}
          />
          <span className={styles.toolFill} />
          {partida && <TotalPartida p={partida} coefK={coefK} />}
        </div>
        <div className={styles.franjaFila2}>
          {estado.fase === 'calibrando' ? (
            <CalibrarPasos
              estado={estado}
              px={lienzoApi.current?.escala() ?? 1}
              etiqueta={etiqueta}
              onEtiqueta={setEtiqueta}
              onConfirmar={confirmarCalibracion}
              onRehacerCota={() => dispatch({ tipo: 'rehacerCota' })}
              onRehacerComprobacion={() => dispatch({ tipo: 'rehacerComprobacion' })}
              onEsCorrecta={() => dispatch({ tipo: 'esCorrecta', px: lienzoApi.current?.escala() ?? 1, userUnit: info?.userUnit ?? 1 })}
              onCancelar={() => dispatch({ tipo: 'esc' })}
            />
          ) : estado.fase === 'dibujando' ? (
            <div className={styles.lectura}>
              <span className="mono">{lecturaEnVivo(estado.armada, estado.puntos, cursor, escala)}</span>
              <span className={styles.pistas}>
                {pista ??
                  (estado.armada === 'recuento'
                    ? 'Clic en cada elemento · Enter termina · Retroceso quita punto · Esc cancela'
                    : 'Enter cierra · Retroceso quita punto · Esc cancela · Mayús fuerza 0/45/90°')}
              </span>
            </div>
          ) : estado.fase === 'nombrando' ? (
            <Nombrando
              prefijo={prefijo}
              texto={estado.texto}
              preparada={preparada}
              partida={partida}
              inputRef={comentarioRef}
              onTexto={(texto) => dispatch({ tipo: 'texto', texto })}
              onCrear={() => intentarCrear(false)}
              onCancelar={() => {
                dispatch({ tipo: 'esc' });
                raizRef.current?.focus();
              }}
            />
          ) : estado.fase === 'creada' ? (
            <Creada lineId={estado.lineId} partida={partida} />
          ) : (
            <Reposo
              armada={armada}
              estrecha={estrecha}
              partida={partida}
              motivo={motivoArmada}
              supDirecta={supDirecta}
              onSupDirecta={(v) => {
                if (!partidaId) return;
                usePlanoUiStore.getState().setSupDirecta(partidaId, v);
                if (!v) dispatch({ tipo: 'herramienta', armada: 'rectangulo' });
              }}
            />
          )}
        </div>
      </div>
      <div className={styles.srOnly} aria-live="polite">
        {anuncio.texto}
        {anuncio.n % 2 ? ' ' : ''}
      </div>
      {pantallaCompleta && <span hidden data-pantalla-completa="" />}
    </div>
  );
}

/* ---- piezas de la franja --------------------------------------------------------------- */

function TotalPartida({ p, coefK }: { p: Partida; coefK: number }) {
  const r = resumenCantidad(p, coefK);
  return (
    <span className={`mono ${styles.total}`}>
      {r.fija ? 'cantidad fija' : `${p.med.length} ${p.med.length === 1 ? 'línea' : 'líneas'}`} · {fmtNum(r.cantidad)} {p.ud}
    </span>
  );
}

/** EN REPOSO: dimensiones fijas de la herramienta armada, por partida (§3.3). */
function Reposo({
  armada,
  estrecha,
  partida,
  motivo,
  supDirecta,
  onSupDirecta,
}: {
  armada: Armada;
  estrecha: boolean;
  partida: Partida | null;
  motivo: MotivoVisor | null;
  supDirecta: boolean | null;
  onSupDirecta: (v: boolean) => void;
}) {
  const fijas = usePlanoUiStore((s) => (partida ? s.fijas[partida.id] : undefined));
  const factor = usePlanoUiStore((s) => (partida ? s.factor[partida.id] : undefined));
  if (estrecha)
    return <p className={styles.franjaTexto}>Aquí solo se ve el plano: para medir, usa una pantalla más ancha.</p>;
  if (!partida) return <p className={styles.franjaTexto}>Abre una partida para medir: elígela en «Midiendo en».</p>;
  if (armada === 'mano')
    return <p className={styles.franjaTexto}>Mano: arrastra para moverte, clic en una forma para verla. Elige una herramienta para medir.</p>;
  if (motivo?.motivo === 'superficie-en-sup' && supDirecta === null)
    return (
      <div className={styles.pregunta}>
        <span>Esta partida se mide por Longitud × Anchura.</span>
        <button type="button" className={`${styles.btn} ${styles.btnPrimario}`} onClick={() => onSupDirecta(true)}>
          Medir esta partida por Superficie directa
        </button>
        <button type="button" className={styles.btn} onClick={() => onSupDirecta(false)}>
          Usar Rectángulo
        </button>
      </div>
    );
  const forma = medFormaDe(partida);
  const celda = celdaDe(armada, TABLA_SUP(forma, armada, supDirecta));
  if (celda.encaja !== true) return motivo ? <p className={styles.franjaTexto}>{textoMotivoVisor(motivo)}</p> : null;
  const formaFinal = TABLA_SUP(forma, armada, supDirecta);
  const campos: { slot: MedDim | 'factor'; rotulo: string; obligatoria: boolean }[] = [
    ...celda.fijas.map((s) => ({
      slot: s,
      rotulo: rotuloFija(formaFinal, s, celda.magnitud),
      obligatoria: !(formaFinal === 'peso' && s === 'ancho'),
    })),
    ...(celda.factor ? [{ slot: 'factor' as const, rotulo: ROTULO_FACTOR, obligatoria: true }] : []),
  ];
  if (!campos.length)
    return (
      <p className={styles.franjaTexto}>
        {motivo ? textoMotivoVisor(motivo) : `Clic en el plano para empezar a medir por ${medFormaDef(formaFinal).nombre.toLowerCase()}.`}
      </p>
    );
  return (
    <div className={styles.fijas}>
      {campos.map((c) => {
        const valor = c.slot === 'factor' ? (factor ?? '') : (fijas?.[c.slot] ?? '');
        const falta = c.obligatoria && !(c.slot === 'factor' ? leerFactor(valor) : leerFija(valor));
        return (
          <label key={c.slot} className={`${styles.fija} ${falta ? styles.fijaFalta : ''}`}>
            <span>{c.rotulo}</span>
            <input
              className="mono"
              value={valor}
              inputMode="decimal"
              data-fija={c.slot}
              placeholder={c.slot === 'ancho' && formaFinal === 'peso' ? 'kg/m o IPE 300' : '0,00'}
              aria-label={c.rotulo}
              aria-invalid={falta || undefined}
              onChange={(e) =>
                c.slot === 'factor'
                  ? usePlanoUiStore.getState().setFactor(partida.id, e.target.value)
                  : usePlanoUiStore.getState().setFija(partida.id, c.slot, e.target.value)
              }
            />
          </label>
        );
      })}
      {motivo && motivo.motivo !== 'falta-dimension' && <span className={styles.pistas}>{textoMotivoVisor(motivo)}</span>}
    </div>
  );
}

/** Superficie en L×A: con la decisión tomada (o sin líneas) se rotula como Superficie directa. */
function TABLA_SUP(forma: ReturnType<typeof medFormaDe>, armada: Armada, supDirecta: boolean | null) {
  return forma === 'sup' && armada === 'superficie' && supDirecta !== false ? 'area' : forma;
}

/** NOMBRANDO: prefijo fijo + comentario + vista previa (§5.2). */
function Nombrando({
  prefijo,
  texto,
  preparada,
  partida,
  inputRef,
  onTexto,
  onCrear,
  onCancelar,
}: {
  prefijo: string;
  texto: string;
  preparada: ResultadoMedida | null;
  partida: Partida | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onTexto: (t: string) => void;
  onCrear: () => void;
  onCancelar: () => void;
}) {
  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);
  let previa: React.ReactNode = null;
  if (preparada?.ok && partida) {
    const l = preparada.lineas[0]!;
    const casillas = (['uds', 'largo', 'ancho', 'alto'] as const)
      .filter((s) => l[s] !== '' && (s !== 'uds' || l.uds !== 1))
      .map((s) => `${s} ${l.expr?.[s] ?? fmtNum(Number(l[s]))}`)
      .join(' · ');
    const r = preparada.resumen;
    previa = (
      <span className="mono">
        {casillas} → parcial {fmtNum(r.parcial)} {partida.ud}
        {r.antes.fija && r.antes.cantidad > 0 && ` · fija ${fmtNum(r.antes.cantidad)} → medida ${fmtNum(r.despues.cantidad)}`}
        {preparada.cambioForma && ' · la partida pasa a Superficie directa'}
      </span>
    );
  } else if (preparada && !preparada.ok) {
    previa = <span className={styles.previaMotivo}>{textoMotivoVisor(preparada as MotivoMedida)}</span>;
  }
  return (
    <div className={styles.nombrando}>
      <span className={styles.prefijo}>{prefijo.replace(/ · $/, '')}</span>
      <input
        ref={inputRef}
        data-comentario=""
        className={styles.comentario}
        value={texto}
        placeholder="Comentario (Salón, Tabique cocina…)"
        aria-label="Comentario de la línea"
        onChange={(e) => onTexto(e.target.value)}
      />
      <span className={styles.previa}>{previa}</span>
      <button type="button" className={styles.btn} onClick={onCancelar}>
        Descartar
      </button>
      <button type="button" className={`${styles.btn} ${styles.btnPrimario}`} onClick={onCrear}>
        Crear línea
      </button>
    </div>
  );
}

/** CREADA: «✓ Línea 7 · 18,40 m²» y [Ver línea], hasta el siguiente vértice. */
function Creada({ lineId, partida }: { lineId: string; partida: Partida | null }) {
  const i = partida?.med.findIndex((l) => l.id === lineId) ?? -1;
  const l = i >= 0 ? partida!.med[i]! : null;
  if (!l || !partida) return null;
  return (
    <div className={styles.creada}>
      <span className={styles.creadaOk}>
        <Icon name="check" size={14} /> Línea {i + 1} · {fmtNum(lineParcial(l))} {partida.ud}
      </span>
      <button
        type="button"
        className={styles.btn}
        onClick={() => document.querySelector(`[data-lineid="${l.id}"]`)?.scrollIntoView?.({ block: 'center' })}
      >
        Ver línea
      </button>
      <span className={styles.pistas}>Clic para la siguiente medida · Esc termina</span>
    </div>
  );
}

/** Popover de una forma seleccionada con Mano (§5.6). */
function PopoverForma({
  linea,
  numero,
  partida,
  soloLectura,
  onVerLinea,
  onRemedir,
  onBorrar,
}: {
  linea: MedLine;
  numero: number;
  partida: Partida;
  soloLectura: boolean;
  onVerLinea: () => void;
  onRemedir: () => void;
  onBorrar: () => void;
}) {
  const dims = (['uds', 'largo', 'ancho', 'alto'] as const)
    .filter((s) => linea[s] !== '')
    .map((s) => fmtNum(Number(linea[s])))
    .join(' × ');
  return (
    <div className={styles.popForma} data-no-foco="" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className={styles.popFormaTit}>
        <span className="mono">{numero}</span> {linea.comment || 'Sin comentario'}
      </div>
      <div className={`mono ${styles.popFormaDims}`}>
        {dims} = {fmtNum(lineParcial(linea))} {partida.ud}
      </div>
      <div className={styles.popFormaBtns}>
        <button type="button" className={styles.btn} onClick={onVerLinea}>
          Ver línea
        </button>
        {!soloLectura && (
          <>
            <button type="button" className={styles.btn} onClick={onRemedir}>
              Volver a medir
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnPeligro}`} onClick={onBorrar}>
              Borrar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Plano no disponible: sus bytes no están en este navegador (§7.2). */
function NoDisponible({ plano }: { plano: PlanoMeta }) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className={styles.estadoLienzo}>
      <p>
        No está el PDF de «{plano.archivo}» ({fmtNum(plano.tamano / 1048576, 1)} MB) en este navegador. Vuelve a
        adjuntarlo: las líneas y la escala se recuperan solas.
      </p>
      <button type="button" className={`${styles.btn} ${styles.btnPrimario}`} disabled={busy} onClick={() => ref.current?.click()}>
        Adjuntar PDF
      </button>
      <input
        ref={ref}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        aria-label="Adjuntar el PDF de este plano"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          setError(null);
          const r = await adjuntarPlano(f, { destino: plano.id });
          setBusy(false);
          if (r.kind === 'no-identico') setError('Este PDF no es idéntico al original: adjúntalo desde el menú como plano nuevo.');
          else if (r.kind === 'error') setError(r.texto);
          else if (r.kind === 'reenlazado') useToastStore.getState().show(`Plano reenlazado: ${plano.nombre}`);
        }}
      />
      {error && (
        <p className={styles.errorTexto} role="alert">
          {error} <BotonAyuda />
        </p>
      )}
    </div>
  );
}

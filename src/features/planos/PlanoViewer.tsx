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
   [A1] Las flechas encienden el cursor de teclado (§5.10): Intro pone un punto
   donde está y Mayús+Intro cierra la forma; mover el ratón lo apaga.

   [A1] Borradores (§5.8): una forma a medio medir que cambia de partida (sin
   encajar), de página, de plano, de ocupante o a pantalla estrecha se guarda
   en `planoUiStore` y se ofrece al volver ([Seguir] [Descartar], o «Borrador
   para …» [Volver] [Descartar]). Uno a la vez: empezar otra forma lo descarta.
   =========================================================================== */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components';
import { medFormaDe, medFormaDef } from '../../core/medForma';
import { lineParcial } from '../../core/medicion';
import { resumenCantidad } from '../../core/medPaste';
import { fmtNum } from '../../core/money';
import {
  REPOSO,
  aMedio,
  cicloReducer,
  type Armada,
  type Contexto,
  type EfectoCiclo,
  type EstadoCiclo,
  type EventoCiclo,
  type FormaEnCurso,
} from '../../core/planoCiclo';
import { escalaDe, etiquetaDe, origenLegible } from '../../core/planoDatos';
import {
  areaLazo,
  cifra,
  dist,
  DESVIACION_MAX,
  escalaN,
  formatoPapel,
  leerEscalaTecleada,
  longitudPolilinea,
  perimetroCerrado,
  rectanguloTresClics,
  redondearPunto,
  tamanoPaginaMm,
} from '../../core/planoGeom';
import {
  NOMBRE_HERRAMIENTA,
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
import { usePlanoUiStore, type Borrador } from '../../store/planoUiStore';
import { getDomainRevision, undo } from '../../store/temporal';
import { adjuntarPlano, adjuntarRevision, usarPdfParaPlano } from './adjuntar';
import { CalibrarPasos, CampoMetros } from './CalibrarPasos';
import { AnadirTambien } from './AnadirTambien';
import { DialogoRecalcular } from './DialogoRecalcular';
import { DialogoCopiarEscala, PopoverAjuste } from './EscalaCajetin';
import { revisionMasNueva } from '../../core/planoRevision';
import { comentarioPropuesto, desviacionCajetin, escalaCalibrada, escalaDeclarada, etiquetaPropuesta } from '../../core/planoTexto';
import type { AnclaAyuda } from '../../layout/ayudaContent';
import { BotonAyuda } from './BotonAyuda';
import { TEXTO_DESCARTE_BORRADOR, textoEscala, textoReenlazado, textoRevisionAdjunta } from './textos';
import { cajaDe, formaEn, formasDeLineas, otrasPaginas, paginasAPrecargar, type FormaCapa } from './capa';
import {
  HERRAMIENTAS_MEDIR,
  encajaHerramienta,
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
import { usePaginaPdf, usePlanoDoc, useTextosPagina } from './usePlanoDoc';
import { PAGINAS_EN_MEMORIA } from './pdfTipos';
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

/** Flechas del cursor de teclado (§5.10): px de pantalla por pulsación. */
const FLECHAS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};
/** Motivos que se resuelven en la franja a media forma (§5.8): las fijas que
 *  pide la partida nueva o la pregunta de Superficie directa. */
const PIDE_EN_FRANJA = new Set(['falta-dimension', 'kgm-sin-resolver', 'superficie-en-sup']);

/** El aviso único de encima del lienzo (§5.2). */
type Aviso = {
  texto: string;
  tono: 'info' | 'warn' | 'error';
  acciones?: { texto: string; run: () => void }[];
  /** Lleva «?» a esta sección de la ayuda (§7.2). */
  ayuda?: AnclaAyuda;
};

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

/** Pistas de la franja mientras se dibuja (§5.2), con ratón o [A1] con el cursor de teclado. */
function pistasDibujando(h: Herramienta, teclado: boolean): string {
  if (teclado)
    return `Flechas mueven el cursor (Mayús ×10) · Intro pone un punto · Mayús+Intro ${h === 'recuento' ? 'termina' : 'cierra'} · Esc cancela`;
  return h === 'recuento'
    ? 'Clic en cada elemento · Enter termina · Retroceso quita punto · Esc cancela'
    : 'Enter cierra · Retroceso quita punto · Esc cancela · Mayús fuerza 0/45/90°';
}

export function PlanoViewer({
  plano,
  estrecha,
  onCerrarVisor,
  paginasConMedidas,
}: {
  plano: PlanoMeta;
  /** Por debajo de 1024 px solo se ve: medir está deshabilitado. */
  estrecha: boolean;
  onCerrarVisor: () => void;
  /** Páginas de este plano con líneas medidas (de cualquier partida). */
  paginasConMedidas?: readonly number[];
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
  // Texto de la página [A1]: escala del cajetín y propuestas de etiqueta y comentario.
  const textosPagina = useTextosPagina(doc, pagina);
  const cajetin = useMemo(() => (textosPagina ? escalaDeclarada(textosPagina) : null), [textosPagina]);
  const declarada = cajetin?.tipo === 'una' ? cajetin.n : null;
  const etiquetaSugerida = useMemo(() => (textosPagina ? etiquetaPropuesta(textosPagina) : null), [textosPagina]);
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
    /** Lleva «?» a esta sección de la ayuda (calibración y «no encaja», §7.2). */
    ayuda?: AnclaAyuda;
  } | null>(null);
  const [pista, setPista] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState({ texto: '', n: 0 });
  const decir = useCallback((texto: string) => setAnuncio((a) => ({ texto, n: a.n + 1 })), []);
  const avisar = useCallback(
    (texto: string, tono: 'info' | 'warn' | 'error' = 'warn', ayuda?: AnclaAyuda) => {
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
  /** «Escala del plano» al calibrar: con ella basta una cota de control. */
  const [escalaTexto, setEscalaTexto] = useState('');
  /** Calibración nueva de una página con líneas, pendiente de la pregunta de recalcular. */
  const [recalculo, setRecalculo] = useState<{ escala: Escala; etiqueta: string; detalle: string; verbo: string } | null>(null);
  const [ajusteAbierto, setAjusteAbierto] = useState(false);
  /** «Añadir también a…» abierto para esta línea (A1). */
  const [anadir, setAnadir] = useState<string | null>(null);
  const [copiarAbierto, setCopiarAbierto] = useState(false);
  const comentarioSugeridoRef = useRef(false);
  const formaIdRef = useRef<string>('');
  const atRef = useRef<string>('');
  /** [A1] Dónde empezó la forma en curso: lo que guarda su borrador (§5.8). */
  const origenForma = useRef<{ docToken: string; partidaId: string | null; pagina: number; calRev: string | null } | null>(
    null,
  );
  /** [A1] Cursor de teclado (§5.10), en coordenadas de página; `null` = apagado. */
  const [cursorTec, setCursorTec] = useState<Punto | null>(null);
  const cursorTecRef = useRef<Punto | null>(null);
  const ponerCursorTec = (p: Punto | null) => {
    cursorTecRef.current = p;
    setCursorTec(p);
  };

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
    const c = datos.comprobacion;
    const esc: Escala = {
      rev: nextCalRev(),
      mPorUnidad: datos.mPorUnidad,
      n: escalaN(datos.mPorUnidad, info.userUnit),
      ref: { ...datos.ref, a: r(datos.ref.a), b: r(datos.ref.b) },
      comprobacion: c.fuente === 'cota' ? { ...c, a: r(c.a), b: r(c.b) } : { ...c },
      ...(datos.escalaDeclarada ? { escalaDeclarada: datos.escalaDeclarada } : {}),
      ...(datos.ajustada ? { ajustada: true } : {}),
      at: new Date().toISOString(),
    };
    const et = etiqueta.trim();
    const detalle =
      c.fuente === 'cajetin'
        ? `ajustada al plano (la cota daba ${textoEscala(escalaCalibrada(esc, info.userUnit).n)})`
        : datos.nMedida !== undefined
          ? `ajustada${datos.ajustada ? ' al plano' : ''} (las cotas daban ${textoEscala(datos.nMedida)})`
          : `comprobada ${fmtNum(c.desviacion * 100, 1)} %`;
    // Con líneas medidas, la pregunta «¿La escala anterior estaba mal?» (§2, §4.4).
    if (lineasConEscala(store.partidas, plano.id, pagina) > 0) {
      setRecalculo({ escala: esc, etiqueta: et, detalle, verbo: 'recalibrada' });
      return;
    }
    const res = store.setPlanoPageScale({ planoId: plano.id, pagina, escala: esc, expect: { docToken: store.docToken } });
    if (!res.ids.length) {
      avisar(textoResultado(res), 'error');
      return;
    }
    rematarCalibracion(esc, et, detalle);
  }

  /** Tras guardar una escala: la etiqueta de la página y el aviso. */
  function rematarCalibracion(esc: Escala, et: string, detalle: string, verbo = 'calibrada'): void {
    const store = useObraStore.getState();
    if (et !== (etiquetaDe(plano, pagina) ?? ''))
      store.setPlanoPageLabel({ planoId: plano.id, pagina, etiqueta: et, expect: { docToken: store.docToken } });
    const texto = `${et || `Pág. ${pagina}`} ${verbo} ${textoEscala(esc.n)} · ${detalle}`;
    useToastStore.getState().show(texto);
    decir(texto);
  }

  /** «Comprobar» una escala que no tiene comprobación (A1). */
  function comprobarEscala(): void {
    if (motivoCalibrar) {
      avisar(motivoCalibrar);
      return;
    }
    if (!escala) return;
    setEtiqueta(etiquetaDe(plano, pagina) ?? '');
    dispatch({ tipo: 'comprobar', mPorUnidad: escala.mPorUnidad, ref: escala.ref });
  }

  function guardarComprobacion(c: Extract<EfectoCiclo, { tipo: 'comprobada' }>['comprobacion']): void {
    if (!escala) return;
    const store = useObraStore.getState();
    const r = redondearPunto;
    const res = store.setPlanoPageCheck({
      planoId: plano.id,
      pagina,
      comprobacion: { ...c, a: r(c.a), b: r(c.b) },
      expect: { docToken: store.docToken, calRev: escala.rev },
    });
    if (!res.ids.length) {
      avisar(textoResultado(res), 'error');
      return;
    }
    rematarCalibracion(escala, etiqueta.trim(), `${fmtNum(c.desviacion * 100, 1)} %`, 'comprobada');
  }

  // Los efectos se leen con los cierres de ESTE render.
  efectosRef.current = (efs, nuevo, antes) => {
    // [A1] Una forma que empieza (o se retoma): se anota dónde, para su
    // borrador. Si había otro guardado, se descarta con aviso (uno a la vez).
    if (aMedio(nuevo) && !aMedio(antes)) {
      origenForma.current = { docToken: useObraStore.getState().docToken, partidaId, pagina, calRev: escala?.rev ?? null };
      if (usePlanoUiStore.getState().borrador) {
        usePlanoUiStore.getState().quitarBorrador();
        avisar('Borrador descartado: empezaste otra forma.', 'info');
      }
    }
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
            comentarioSugeridoRef.current = false;
            // [A1] En Superficie y Rectángulo, el texto de la página dentro del
            // polígono entra seleccionado: lo que se teclea lo sustituye.
            if (
              nuevo.fase === 'nombrando' &&
              !nuevo.sustituye &&
              (nuevo.armada === 'superficie' || nuevo.armada === 'rectangulo') &&
              textosPagina
            ) {
              const sugerido = comentarioPropuesto(textosPagina, nuevo.puntos);
              if (sugerido) {
                comentarioSugeridoRef.current = true;
                estadoRef.current = { ...nuevo, texto: sugerido };
                setEstado(estadoRef.current);
              }
            }
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
        case 'borrador':
          guardarBorrador(ef.forma, ef.que === 'partida' ? 'partida' : 'vista');
          break;
        case 'restaurar':
          break;
        case 'calibrada':
          guardarCalibracion(ef.datos);
          break;
        case 'comprobada':
          guardarComprobacion(ef.comprobacion);
          break;
      }
    }
  };

  /** Qué hace el visor con un motivo: decirlo y, si lo hay, su arreglo (§7.2). */
  function atenderMotivo(mo: MotivoVisor | MotivoMedida): void {
    avisar(
      textoMotivoVisor(mo),
      'warn',
      mo.motivo === 'no-encaja'
        ? 'planos-herramientas'
        : mo.motivo === 'sin-calibrar' || mo.motivo === 'sin-comprobar'
          ? 'planos-calibrar'
          : undefined,
    );
    if (mo.motivo === 'no-encaja') dispatch({ tipo: 'herramienta', armada: mo.usa });
    else if (mo.motivo === 'sin-partida') setSelectorAbierto(true);
    else if (mo.motivo === 'falta-dimension' || mo.motivo === 'kgm-sin-resolver')
      requestAnimationFrame(() =>
        raizRef.current
          ?.querySelector<HTMLInputElement>(`[data-fija="${mo.motivo === 'falta-dimension' ? mo.slot : 'ancho'}"]`)
          ?.focus(),
      );
  }

  /* ---- cambios de contexto bajo una forma a medio dibujar (§5.3, [A1] §5.8) ---- */
  const docToken = useObraStore((s) => s.docToken);
  const borrador = usePlanoUiStore((s) => s.borrador);
  /** ¿El borrador es de esta página y sigue valiendo (misma obra y escala)? */
  const esDeAqui = (b: Borrador) =>
    b.planoId === plano.id && b.pagina === pagina && b.docToken === docToken && b.calRev === (escala?.rev ?? null);
  const puedeSeguir = !soloLectura && !estrecha;

  /** Guarda la forma en curso como borrador de donde empezó. */
  function guardarBorrador(forma: FormaEnCurso, espera: Borrador['espera']): void {
    const o = origenForma.current;
    if (!o?.partidaId) return;
    const ui = usePlanoUiStore.getState();
    ui.guardarBorrador({ ...o, partidaId: o.partidaId, planoId: plano.id, restar: ui.restar, forma, espera });
  }

  /** La forma pasa a la partida abierta: dilo, con lo que le falte. */
  function avisarPaso(h: Herramienta): void {
    if (!partida) return;
    const mo = motivos[h];
    avisar(`La forma pasa a ${partida.pos} ${partida.title}.${mo && PIDE_EN_FRANJA.has(mo.motivo) ? ` ${textoMotivoVisor(mo)}` : ''}`, 'info');
  }

  /** [Seguir]: retoma el borrador en la partida abierta. */
  function seguirBorrador(b: Borrador): void {
    const ui = usePlanoUiStore.getState();
    ui.quitarBorrador();
    ui.setRestar(b.restar);
    if (b.forma.fase === 'nombrando') {
      formaIdRef.current = nextFormaId();
      atRef.current = new Date().toISOString();
      comentarioSugeridoRef.current = false;
    }
    dispatch({ tipo: 'seguir', forma: b.forma });
    if (b.partidaId !== partidaId) avisarPaso(b.forma.armada);
    raizRef.current?.focus();
  }

  const previo = useRef({ partidaId, pagina, planoId: plano.id, rev: escala?.rev ?? null });
  const alCambiar = useRef<(que: Contexto) => void>(() => undefined);
  alCambiar.current = (que) => {
    const e = estadoRef.current;
    if (que === 'pagina') ponerCursorTec(null); // sus coordenadas eran de la otra página
    if (que === 'partida' && aMedio(e)) {
      // Si su herramienta encaja en la partida nueva, la forma pasa a ella; si
      // no, queda como borrador de la suya.
      const encaja = !e.sustituye && encajaHerramienta(e.armada, partida, supDirecta);
      if (encaja && origenForma.current) {
        origenForma.current = { ...origenForma.current, partidaId };
        avisarPaso(e.armada);
      }
      dispatch({ tipo: 'contexto', que, encaja });
      return;
    }
    dispatch({ tipo: 'contexto', que });
    // De vuelta a la partida de un borrador en espera, en su página: se retoma solo.
    const b = usePlanoUiStore.getState().borrador;
    if (que === 'partida' && b?.espera === 'partida' && b.partidaId === partidaId && esDeAqui(b) && puedeSeguir) seguirBorrador(b);
  };
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
    if (que) alCambiar.current(que);
  }, [partidaId, pagina, plano.id, escala?.rev]);

  // [A1] La ventana pasa a estrecha (< 1024 px, donde no se mide): la forma
  // queda como borrador y se ofrece al volver a ensanchar.
  useEffect(() => {
    if (estrecha && aMedio(estadoRef.current)) dispatch({ tipo: 'contexto', que: 'vista' });
  }, [estrecha, dispatch]);

  // [A1] Al desmontar (otro plano, cerrar el visor, Deshacer que quita el
  // plano) la forma en curso queda como borrador; si cambió la obra, se
  // descarta con aviso.
  useEffect(() => {
    const planoId = plano.id;
    return () => {
      const e = estadoRef.current;
      const o = origenForma.current;
      if (!aMedio(e) || !o?.partidaId) return;
      if (useObraStore.getState().docToken !== o.docToken) {
        useToastStore.getState().show(`Forma descartada: ${TEXTO_DESCARTE_BORRADOR.obra}.`);
        return;
      }
      const ui = usePlanoUiStore.getState();
      ui.guardarBorrador({ ...o, partidaId: o.partidaId, planoId, restar: ui.restar, forma: e, espera: 'vista' });
    };
  }, [plano.id]);

  // Etiqueta al calibrar: la actual o, si no hay, la propuesta desde el texto (A1).
  useEffect(() => {
    if (estado.fase === 'calibrando') setEtiqueta((t) => t || etiquetaDe(plano, pagina) || etiquetaSugerida || '');
    else setEtiqueta('');
  }, [estado.fase, plano, pagina, etiquetaSugerida]);
  // Escala del plano al calibrar: la que ya tenía la página o la del cajetín.
  const escalaPrevia = escala?.escalaDeclarada ?? declarada;
  useEffect(() => {
    if (estado.fase === 'calibrando') setEscalaTexto((t) => t || (escalaPrevia ? cifra(escalaPrevia) : ''));
    else setEscalaTexto('');
  }, [estado.fase, escalaPrevia]);
  const escalaPlano = leerEscalaTecleada(escalaTexto);
  const papel = useMemo(() => {
    if (!info) return null;
    const t = tamanoPaginaMm(info.vista, info.userUnit);
    const [an, al] = info.rotacion === 90 || info.rotacion === 270 ? [t.alto, t.ancho] : [t.ancho, t.alto];
    const f = formatoPapel(an, al);
    return `${f ? `${f} · ` : ''}${Math.round(an)} × ${Math.round(al)} mm`;
  }, [info]);

  /* ---- peticiones de la cabecera: chip de escala y menú ⋯ (A1) ---------------------- */
  const pedido = usePlanoUiStore((s) => s.pedido);
  useEffect(() => {
    if (!pedido) return;
    usePlanoUiStore.getState().limpiarPedido();
    if (pedido.que === 'ajuste' && escala?.escalaDeclarada) setAjusteAbierto(true);
    if (pedido.que === 'copiarEscala' && escala?.escalaDeclarada && doc) setCopiarAbierto(true);
  }, [pedido, escala, doc]);

  /* ---- «Ver en plano» y «Volver a medir» pedidos desde el presupuesto ---------- */
  useEffect(() => {
    if (!destacar || destacar.planoId !== plano.id || destacar.pagina !== pagina || pintado.estado !== 'listo') return;
    const l = partida?.med.find((x) => x.id === destacar.lineId);
    const o = l?.origen;
    if (!origenLegible(o)) return;
    lienzoApi.current?.encuadrar(cajaDe(o.puntos));
    setDestacada(destacar.lineId);
    // [A1] Medida con el PDF anterior del plano («Usar este PDF para este plano»).
    if (o.huella !== plano.huella) avisar('Esta línea se midió sobre otra versión del PDF.', 'info');
    const t = setTimeout(() => setDestacada(null), 1500);
    return () => clearTimeout(t);
  }, [destacar, plano.id, plano.huella, pagina, pintado.estado, partida, avisar]);

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
    if (mo.motivo === 'sin-comprobar') {
      avisar(textoMotivoVisor(mo));
      comprobarEscala();
      return;
    }
    atenderMotivo(mo);
  }

  /** Superficie en una partida L×A (§3.2): Superficie directa o Rectángulo. */
  function elegirSupDirecta(v: boolean): void {
    if (!partidaId) return;
    usePlanoUiStore.getState().setSupDirecta(partidaId, v);
    if (!v) dispatch({ tipo: 'herramienta', armada: 'rectangulo' });
  }

  function empezarCalibrar(): void {
    if (motivoCalibrar) {
      avisar(motivoCalibrar);
      return;
    }
    // Con líneas medidas también se calibra: al terminar, la pregunta de recalcular.
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
    // [A1] Cursor de teclado (§5.10): las flechas lo encienden y lo mueven;
    // con él, Intro pone un punto donde está y Mayús+Intro cierra la forma.
    const flecha = FLECHAS[e.key];
    if (flecha && !mod && !e.altKey) {
      consumir();
      moverCursorTec(flecha, e.shiftKey ? 10 : 1);
      return;
    }
    if (e.key === 'Enter' && cursorTecRef.current && fase !== 'nombrando') {
      consumir();
      if (!e.shiftKey) clicTeclado(cursorTecRef.current);
      else if (fase === 'dibujando') dispatch({ tipo: 'enter' });
      else if (fase === 'calibrando') confirmarCalibracion();
      return;
    }
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
    if (e.key === 'PageDown' || e.key === 'PageUp') {
      consumir();
      const n = pagina + (e.key === 'PageDown' ? 1 : -1);
      if (n >= 1 && n <= plano.paginas) usePlanoUiStore.getState().setPagina(n);
      return;
    }
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

  /** [A1] Enciende o mueve el cursor de teclado `k` px de pantalla. */
  function moverCursorTec([dx, dy]: [number, number], k: number): void {
    const api = lienzoApi.current;
    if (!api) return;
    const c = cursorTecRef.current;
    if (!c) decir('Cursor de teclado: las flechas lo mueven, Intro pone un punto y Mayús+Intro cierra la forma.');
    ponerCursorTec(api.moverCursor(c ?? inicioCursorTec(api), dx * k, dy * k));
  }

  /** Dónde se enciende: en el último punto de la forma o de la cota, donde
   *  estaba el ratón o en el centro de la vista. */
  function inicioCursorTec(api: LienzoApi): Punto {
    const e = estadoRef.current;
    if (aMedio(e)) return e.puntos[e.puntos.length - 1]!;
    if (e.fase === 'calibrando') {
      const t = e[e.paso];
      const ultimo = t.b ?? t.a;
      if (ultimo) return ultimo;
    }
    return cursor ?? api.centro();
  }

  /** Intro con el cursor de teclado: un clic donde está (con Mano, sobre la
   *  forma que haya debajo). */
  function clicTeclado(p: Punto): void {
    const px = lienzoApi.current?.escala() ?? 1;
    const mano = !(armadaMide || estadoRef.current.fase === 'calibrando');
    dispatch({ tipo: 'clic', p, px, detalle: 1, forma: mano ? (formaEn(formas, p, px)?.lineId ?? null) : null, motivo: motivoArmada });
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
    dispatch({ tipo: 'confirmar', px: lienzoApi.current?.escala() ?? 1, userUnit: info?.userUnit ?? 1, cajetin: escalaPlano });
  }

  /** Otras partidas con líneas de la misma forma (`formaId`), para el popover. */
  function tambienEn(l: MedLine): string[] {
    const o = l.origen;
    if (!origenLegible(o)) return [];
    const out: string[] = [];
    for (const ps of Object.values(partidas))
      for (const p of ps)
        if (p.med.some((x) => x.id !== l.id && origenLegible(x.origen) && x.origen.formaId === o.formaId)) out.push(`${p.pos} ${p.title}`);
    return out;
  }
  const anadirLinea = anadir && partida ? (partida.med.find((l) => l.id === anadir && origenLegible(l.origen)) ?? null) : null;

  /* ---- capa ------------------------------------------------------------------------------ */
  const formas: FormaCapa[] = useMemo(
    () => (partida ? formasDeLineas(partida.med, plano.id, pagina) : []),
    [partida, plano.id, pagina],
  );
  // Tras pintar, en reposo: las vecinas y las páginas con escala o medidas.
  const precarga = useMemo(
    () =>
      paginasAPrecargar(
        pagina,
        plano.paginas,
        [...Object.keys(plano.escalas).map(Number), ...(paginasConMedidas ?? [])],
        PAGINAS_EN_MEMORIA - 1,
      ),
    [pagina, plano.paginas, plano.escalas, paginasConMedidas],
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
            tambienEn={tambienEn(l)}
            onAnadir={() => setAnadir(l.id)}
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

  /** [A1] El aviso de un borrador de esta página (§5.8): [Seguir] si su
   *  herramienta sirve en la partida abierta; si no, «Borrador para …» [Volver]. */
  function avisoBorrador(b: Borrador): Aviso {
    const f = b.forma;
    const n = f.puntos.length;
    const que = `${NOMBRE_HERRAMIENTA[f.armada]}, ${n} ${n === 1 ? 'punto' : 'puntos'}`;
    const descartar = { texto: 'Descartar', run: () => usePlanoUiStore.getState().quitarBorrador() };
    const pasa = b.partidaId === partidaId || (!f.sustituye && encajaHerramienta(f.armada, partida, supDirecta));
    if (pasa || !puedeSeguir)
      return {
        texto: `Forma a medio medir: ${que}.`,
        tono: 'info',
        acciones: puedeSeguir ? [{ texto: 'Seguir', run: () => seguirBorrador(b) }, descartar] : [descartar],
      };
    const suya = locatePartida(b.partidaId);
    if (!suya) return { texto: `Forma a medio medir para una partida que ya no está: ${que}.`, tono: 'info', acciones: [descartar] };
    const volver = () => useObraStore.getState().revealPartida(suya.partida.id, suya.chapterId, suya.partida.sub ?? null);
    return {
      texto: `Borrador para ${suya.partida.pos} ${suya.partida.title}: ${que}.`,
      tono: 'info',
      acciones: [{ texto: 'Volver', run: volver }, descartar],
    };
  }

  /* ---- aviso único (§5.2): el más prioritario ------------------------------------------ */
  const ilegibles = useObraStore((s) => s._ilegible?.length ?? 0);
  const planosObra = useObraStore((s) => s.planos);
  const masNueva = revisionMasNueva(planosObra, plano.id);
  let aviso: Aviso | null = mensaje ? { texto: mensaje.texto, tono: mensaje.tono, ayuda: mensaje.ayuda } : null;
  // [A1] El borrador de esta página va el primero: es trabajo del usuario a
  // medio hacer y el aviso es su única salida (§5.8).
  const borradorAqui = borrador && (estado.fase === 'reposo' || estado.fase === 'creada') && esDeAqui(borrador) ? borrador : null;
  if (!aviso && borradorAqui) aviso = avisoBorrador(borradorAqui);
  // [A1] Revisión más nueva: sale también con el PDF no disponible (el cuerpo
  // explica eso) porque abrir la nueva es la salida más corta.
  if (!aviso && masNueva)
    aviso = {
      texto: `Hay una revisión más nueva: ${masNueva.revision ?? masNueva.nombre}.`,
      tono: 'info',
      acciones: [{ texto: 'Abrir', run: () => usePlanoUiStore.getState().abrirPlano(masNueva.id, Math.min(pagina, masNueva.paginas)) }],
    };
  if (!aviso && docE.estado === 'no-disponible') aviso = null; // lo explica el cuerpo
  if (
    !aviso &&
    docE.estado === 'listo' &&
    escala?.escalaDeclarada &&
    !escala.ajustada &&
    info &&
    desviacionCajetin(escalaCalibrada(escala, info.userUnit).n, escala.escalaDeclarada) > DESVIACION_MAX &&
    estado.fase !== 'calibrando'
  )
    aviso = {
      texto: 'La calibración no cuadra con la escala del plano: ¿el PDF está a otro tamaño?',
      tono: 'warn',
      ayuda: 'planos-calibrar',
      acciones: motivoCalibrar ? undefined : [{ texto: 'Rehacer cota', run: empezarCalibrar }],
    };
  if (!aviso && docE.estado === 'listo' && !escala && estado.fase !== 'calibrando')
    aviso = {
      texto: 'Calibra esta página para medir longitudes y superficies. Recuento funciona sin escala.',
      tono: 'info',
      acciones: motivoCalibrar ? undefined : [{ texto: 'Calibrar', run: empezarCalibrar }],
    };
  if (!aviso && docE.estado === 'listo' && escala && !escala.comprobacion && estado.fase !== 'calibrando')
    aviso = {
      texto: 'Comprueba la escala de esta página con otra cota antes de medir.',
      tono: 'warn',
      acciones: motivoCalibrar ? undefined : [{ texto: 'Comprobar', run: comprobarEscala }],
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
            {aviso.ayuda && <BotonAyuda seccion={aviso.ayuda} />}
            {aviso.acciones?.map((a) => (
              <button key={a.texto} type="button" className={styles.btn} onClick={a.run}>
                {a.texto}
              </button>
            ))}
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
        {ajusteAbierto && escala?.escalaDeclarada && info && (
          <PopoverAjuste
            plano={plano}
            pagina={pagina}
            escala={escala}
            userUnit={info.userUnit}
            readonly={!!motivoCalibrar}
            onCerrar={() => setAjusteAbierto(false)}
            onRecalcular={(nueva, detalle) => setRecalculo({ escala: nueva, etiqueta: etiquetaDe(plano, pagina) ?? '', detalle, verbo: 'con escala' })}
            onRehacerCota={empezarCalibrar}
            onHecho={(texto) => {
              useToastStore.getState().show(texto);
              decir(texto);
            }}
          />
        )}
        {docE.estado === 'cargando' && <div className={styles.estadoLienzo}>Abriendo el plano…</div>}
        {docE.estado === 'error' && (
          <div className={styles.estadoLienzo} role="alert">
            <p>{docE.texto}</p>
            <button type="button" className={styles.btn} onClick={() => setIntentoDoc((x) => x + 1)}>
              Reintentar
            </button>
          </div>
        )}
        {docE.estado === 'no-disponible' && <NoDisponible plano={plano} soloLectura={!!soloLectura} />}
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
            onMoverCota={(cual, p) => dispatch({ tipo: 'moverPunto', cual, p, px: lienzoApi.current?.escala() })}
            onCursor={(p) => {
              setCursor(p);
              if (p && cursorTecRef.current) ponerCursorTec(null); // mover el ratón lo apaga
            }}
            cursorTeclado={cursorTec}
            borrador={
              borradorAqui
                ? { herramienta: borradorAqui.forma.armada, puntos: borradorAqui.forma.puntos, cerrada: borradorAqui.forma.fase === 'nombrando' }
                : null
            }
            onPintado={(est, causa) => setPintado({ estado: est, causa })}
            precargar={precarga}
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
              onEsCorrecta={() =>
                dispatch({ tipo: 'esCorrecta', px: lienzoApi.current?.escala() ?? 1, userUnit: info?.userUnit ?? 1, cajetin: escalaPlano })
              }
              declarada={escalaPlano}
              escalaPlano={escalaTexto}
              onEscalaPlano={setEscalaTexto}
              papel={papel}
              userUnit={info?.userUnit ?? 1}
              onCancelar={() => dispatch({ tipo: 'esc' })}
            />
          ) : estado.fase === 'dibujando' ? (
            <div className={styles.aMedio}>
              <div className={styles.lectura}>
                <span className="mono">{lecturaEnVivo(estado.armada, estado.puntos, cursorTec ?? cursor, escala)}</span>
                <span className={styles.pistas}>{pista ?? pistasDibujando(estado.armada, !!cursorTec)}</span>
              </div>
              {partida && motivoArmada && PIDE_EN_FRANJA.has(motivoArmada.motivo) && (
                <PideEnFranja
                  armada={estado.armada}
                  partida={partida}
                  motivo={motivoArmada}
                  supDirecta={supDirecta}
                  onSupDirecta={elegirSupDirecta}
                />
              )}
            </div>
          ) : estado.fase === 'nombrando' ? (
            <Nombrando
              prefijo={prefijo}
              texto={estado.texto}
              preparada={preparada}
              partida={partida}
              inputRef={comentarioRef}
              seleccionar={comentarioSugeridoRef.current}
              onTexto={(texto) => dispatch({ tipo: 'texto', texto })}
              onCrear={() => intentarCrear(false)}
              onCancelar={() => {
                dispatch({ tipo: 'esc' });
                raizRef.current?.focus();
              }}
              pide={
                partida && preparada && !preparada.ok && PIDE_EN_FRANJA.has((preparada as MotivoMedida).motivo) ? (
                  <PideEnFranja
                    armada={estado.armada}
                    partida={partida}
                    motivo={preparada as MotivoMedida}
                    supDirecta={supDirecta}
                    onSupDirecta={elegirSupDirecta}
                  />
                ) : null
              }
            />
          ) : estado.fase === 'creada' ? (
            <Creada lineId={estado.lineId} partida={partida} onAnadir={soloLectura || estrecha ? undefined : () => setAnadir(estado.lineId)} />
          ) : (
            <Reposo
              armada={armada}
              estrecha={estrecha}
              partida={partida}
              motivo={motivoArmada}
              supDirecta={supDirecta}
              onSupDirecta={elegirSupDirecta}
            />
          )}
        </div>
      </div>
      <div className={styles.srOnly} aria-live="polite">
        {anuncio.texto}
        {anuncio.n % 2 ? ' ' : ''}
      </div>
      {pantallaCompleta && <span hidden data-pantalla-completa="" />}
      {recalculo && (
        <DialogoRecalcular
          plano={plano}
          pagina={pagina}
          nombrePagina={recalculo.etiqueta || etiquetaDe(plano, pagina) || `Pág. ${pagina}`}
          escala={recalculo.escala}
          onCancelar={() => {
            setRecalculo(null);
            raizRef.current?.focus();
          }}
          onHecho={(n) => {
            const r = recalculo;
            setRecalculo(null);
            raizRef.current?.focus();
            rematarCalibracion(r.escala, r.etiqueta, `${r.detalle} · ${n} ${n === 1 ? 'línea recalculada' : 'líneas recalculadas'}`, r.verbo);
          }}
        />
      )}
      {anadirLinea && partida && (
        <AnadirTambien
          plano={plano}
          pagina={pagina}
          linea={anadirLinea}
          partidaOrigenId={partida.id}
          onCerrar={() => {
            setAnadir(null);
            raizRef.current?.focus();
          }}
          onHecho={(texto) => {
            setAnadir(null);
            raizRef.current?.focus();
            useToastStore.getState().show(texto);
            decir(texto);
          }}
        />
      )}
      {copiarAbierto && doc && (
        <DialogoCopiarEscala
          doc={doc}
          plano={plano}
          pagina={pagina}
          onCerrar={() => {
            setCopiarAbierto(false);
            raizRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

/* ---- piezas de la franja --------------------------------------------------------------- */

function TotalPartida({ p, coefK }: { p: Partida; coefK: number }) {
  const r = resumenCantidad(p, coefK);
  const n = p.med.length;
  // Una partida vacía no tiene «cantidad fija»: aún no tiene nada.
  const que = r.fija ? (n === 0 && r.cantidad === 0 ? 'sin líneas' : 'cantidad fija') : `${n} ${n === 1 ? 'línea' : 'líneas'}`;
  return (
    <span className={`mono ${styles.total}`}>
      {que} · {fmtNum(r.cantidad)} {p.ud}
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
  if (estrecha)
    return <p className={styles.franjaTexto}>Aquí solo se ve el plano: para medir, usa una pantalla más ancha.</p>;
  if (!partida) return <p className={styles.franjaTexto}>Abre una partida para medir: elígela en «Midiendo en».</p>;
  if (armada === 'mano')
    return <p className={styles.franjaTexto}>Mano: arrastra para moverte, clic en una forma para verla. Elige una herramienta para medir.</p>;
  if (motivo?.motivo === 'superficie-en-sup' && supDirecta === null) return <PreguntaSupDirecta onSupDirecta={onSupDirecta} />;
  return <CamposFijas armada={armada} partida={partida} supDirecta={supDirecta} motivo={motivo} />;
}

/** [A1] A media forma, lo que pide la partida a la que pasó (§5.8): sus
 *  dimensiones fijas o la pregunta de Superficie directa. */
function PideEnFranja({
  armada,
  partida,
  motivo,
  supDirecta,
  onSupDirecta,
}: {
  armada: Herramienta;
  partida: Partida;
  motivo: MotivoVisor;
  supDirecta: boolean | null;
  onSupDirecta: (v: boolean) => void;
}) {
  if (motivo.motivo === 'superficie-en-sup') return <PreguntaSupDirecta onSupDirecta={onSupDirecta} />;
  return <CamposFijas armada={armada} partida={partida} supDirecta={supDirecta} motivo={null} aMedio />;
}

function PreguntaSupDirecta({ onSupDirecta }: { onSupDirecta: (v: boolean) => void }) {
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
}

/** Dimensiones fijas de una herramienta en una partida (§3.3). `aMedio` ([A1]
 *  §5.8): solo los campos, sin textos, para la franja de una forma en curso. */
function CamposFijas({
  armada,
  partida,
  supDirecta,
  motivo,
  aMedio = false,
}: {
  armada: Herramienta;
  partida: Partida;
  supDirecta: boolean | null;
  motivo: MotivoVisor | null;
  aMedio?: boolean;
}) {
  const fijas = usePlanoUiStore((s) => s.fijas[partida.id]);
  const factor = usePlanoUiStore((s) => s.factor[partida.id]);
  const forma = medFormaDe(partida);
  const celda = celdaDe(armada, TABLA_SUP(forma, armada, supDirecta));
  if (celda.encaja !== true) return motivo && !aMedio ? <p className={styles.franjaTexto}>{textoMotivoVisor(motivo)}</p> : null;
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
    return aMedio ? null : (
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
      {!aMedio && motivo && motivo.motivo !== 'falta-dimension' && <span className={styles.pistas}>{textoMotivoVisor(motivo)}</span>}
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
  seleccionar,
  onTexto,
  onCrear,
  onCancelar,
  pide,
}: {
  prefijo: string;
  texto: string;
  preparada: ResultadoMedida | null;
  partida: Partida | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** El texto es una propuesta: entra seleccionado. */
  seleccionar: boolean;
  onTexto: (t: string) => void;
  onCrear: () => void;
  onCancelar: () => void;
  /** [A1] Lo que pide la partida (sus fijas), si le falta algo (§5.8). */
  pide?: React.ReactNode;
}) {
  const seleccionarAlEntrar = useRef(seleccionar);
  useEffect(() => {
    inputRef.current?.focus();
    if (seleccionarAlEntrar.current) inputRef.current?.select();
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
      {pide}
      <div className={styles.nombrandoAcciones}>
        <button type="button" className={styles.btn} onClick={onCancelar}>
          Descartar
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnPrimario}`} onClick={onCrear}>
          Crear línea
        </button>
      </div>
    </div>
  );
}

/** CREADA: «✓ Línea 7 · 18,40 m²» y [Ver línea], hasta el siguiente vértice. */
function Creada({ lineId, partida, onAnadir }: { lineId: string; partida: Partida | null; onAnadir?: () => void }) {
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
      {onAnadir && (
        <button type="button" className={styles.btn} onClick={onAnadir}>
          Añadir también a…
        </button>
      )}
      <span className={styles.pistas}>Clic para la siguiente medida · Esc termina</span>
    </div>
  );
}

/** Popover de una forma seleccionada con Mano (§5.6). */
function PopoverForma({
  linea,
  numero,
  partida,
  tambienEn,
  soloLectura,
  onVerLinea,
  onRemedir,
  onBorrar,
  onAnadir,
}: {
  linea: MedLine;
  numero: number;
  partida: Partida;
  /** Otras partidas con la misma forma («2.3 Rodapié»). */
  tambienEn: string[];
  soloLectura: boolean;
  onVerLinea: () => void;
  onRemedir: () => void;
  onBorrar: () => void;
  onAnadir: () => void;
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
      {tambienEn.length > 0 && <div className={styles.franjaTexto}>También en: {tambienEn.join(', ')}</div>}
      <div className={styles.popFormaBtns}>
        <button type="button" className={styles.btn} onClick={onVerLinea}>
          Ver línea
        </button>
        {!soloLectura && (
          <>
            <button type="button" className={styles.btn} onClick={onRemedir}>
              Volver a medir
            </button>
            <button type="button" className={styles.btn} onClick={onAnadir}>
              Añadir también a…
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

/** Plano no disponible: sus bytes no están en este navegador (§7.2). [A1] Si
 *  el PDF que se adjunta no es el original, ofrece «Usar este PDF para este
 *  plano» (si encaja en sus páginas) o «Adjuntar como revisión nueva» (§9.3). */
function NoDisponible({ plano, soloLectura }: { plano: PlanoMeta; soloLectura: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [otro, setOtro] = useState<{ file: File; encaja: boolean } | null>(null);
  const toast = (texto: string) => useToastStore.getState().show(texto);
  const empezar = () => {
    setBusy(true);
    setError(null);
  };
  async function elegido(f: File) {
    empezar();
    setOtro(null);
    const r = await adjuntarPlano(f, { destino: plano.id });
    setBusy(false);
    if (r.kind === 'no-identico') setOtro({ file: f, encaja: r.encaja });
    else if (r.kind === 'error') setError(r.texto);
    else if (r.kind === 'reenlazado') toast(`Plano reenlazado: ${plano.nombre}`);
  }
  async function usarEste(f: File) {
    empezar();
    const r = await usarPdfParaPlano(f, { planoId: plano.id });
    setBusy(false);
    setOtro(null);
    if (r.kind === 'ok') toast(textoReenlazado(r.lineas, r.calibradas));
    else if (r.kind === 'no-encaja') setError('Este PDF no tiene las mismas páginas: adjúntalo como revisión nueva.');
    else if (r.kind === 'error') setError(r.texto);
  }
  async function comoRevision(f: File) {
    empezar();
    const r = await adjuntarRevision(f, { sustituye: plano.id });
    setBusy(false);
    setOtro(null);
    if (r.kind === 'ok') toast(textoRevisionAdjunta(r.revision, plano));
    else if (r.kind === 'error') setError(r.texto);
  }
  return (
    <div className={styles.estadoLienzo}>
      <p>
        No está el PDF de «{plano.archivo}» ({fmtNum(plano.tamano / 1048576, 1)} MB) en este navegador. Vuelve a
        adjuntarlo: las líneas y la escala se recuperan solas.
      </p>
      {otro ? (
        <div className={styles.otroPdf} role="alert">
          <p>
            Este PDF no es idéntico al original.{' '}
            {otro.encaja
              ? 'Tiene sus mismas páginas: puedes usarlo para este plano (conserva escalas y líneas; cada página calibrada pide comprobar su escala) o adjuntarlo como revisión nueva.'
              : 'No tiene sus mismas páginas: solo puede entrar como revisión nueva, y las líneas siguen en este plano.'}{' '}
            <BotonAyuda seccion="planos-revisiones" />
          </p>
          <div className={styles.popoverAcciones}>
            {otro.encaja && (
              <button type="button" className={`${styles.btn} ${styles.btnPrimario}`} disabled={busy} onClick={() => void usarEste(otro.file)}>
                Usar este PDF para este plano
              </button>
            )}
            <button type="button" className={styles.btn} disabled={busy} onClick={() => void comoRevision(otro.file)}>
              Adjuntar como revisión nueva
            </button>
            <button type="button" className={styles.btn} disabled={busy} onClick={() => setOtro(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimario}`}
          disabled={busy || soloLectura}
          onClick={() => ref.current?.click()}
        >
          Adjuntar PDF
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        aria-label="Adjuntar el PDF de este plano"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void elegido(f);
        }}
      />
      {error && (
        <p className={styles.errorTexto} role="alert">
          {error} <BotonAyuda seccion="planos-revisiones" />
        </p>
      )}
    </div>
  );
}

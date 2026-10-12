/* ===========================================================================
   core/planoCiclo — ciclo de medida y de calibración del visor de planos.
   Especificación · Etapa A, §5.3 (docs/plan-medir-planos-pdf.md).

   Reductor PURO `(estado, evento) → { estado, efectos }`: el visor solo lo
   conecta (traduce ratón y teclado a eventos y ejecuta los efectos), y la
   tabla de §5.3 es su tabla de tests.

     reposo ──clic──► dibujando ──Enter/doble clic/cierre──► nombrando
       ▲  ▲               │  Retroceso quita puntos             │ Enter
       │  └──Esc──────────┘  Esc descarta                       ▼
       │                                         creada ◄── (store: crear)
       │                                           │ clic: otra forma
       └────────────── Esc ────────────────────────┘
     reposo ──Calibrar──► calibrando ──► reposo
                          (la escala del plano, una cota o las dos)

   La herramienta armada se mantiene tras crear una línea. [A1] Borradores
   (§5.8): un cambio de partida, página, plano, ocupante o a pantalla estrecha
   a medio dibujo NO descarta la forma: la devuelve como efecto `borrador` y
   el visor la guarda; `seguir` la retoma. Si la herramienta encaja en la
   partida nueva (lo decide el visor), la forma sigue en ella. Un cambio de
   escala o de herramienta la descarta con aviso.
   =========================================================================== */
import { parseEsNumber } from './money';
/** Un motivo por el que no se puede medir (el de `planoMedida` o uno del visor:
 *  sin partida, solo lectura…). El ciclo no lo interpreta: lo devuelve como efecto. */
export type MotivoCiclo = { motivo: string };
import {
  DESVIACION_TOPE,
  ajustar45,
  cruzaLaForma,
  demasiadoCerca,
  escalaN,
  escalaParaAjustar,
  formaInvalida,
  mPorUnidadDeCota,
  mPorUnidadDeEscala,
  plausibilidad,
  precisionTramo,
  rectanguloTresClics,
  sobrePrimerVertice,
  toleranciaComprobacion,
  type FormaInvalida,
} from './planoGeom';
import { TOPES } from './planoDatos';
import type { Herramienta, Punto } from './types';

export type Armada = 'mano' | Herramienta;
/** Qué cambió bajo una forma a medio dibujar. `vista`: la ventana pasó a
 *  estrecha (< 1024 px), donde no se mide. */
export type Contexto = 'partida' | 'pagina' | 'plano' | 'ocupante' | 'vista' | 'escala' | 'herramienta';

/** Una cota: dos puntos y la distancia real tecleada.
 *  `pxA`/`pxB`: píxeles de pantalla por unidad de página con que se marcó
 *  cada extremo (su precisión; sin ellos, el zoom de ahora). */
export interface TramoCota {
  a: Punto | null;
  b: Punto | null;
  metros: string;
  pxA?: number;
  pxB?: number;
}

/** Precisión (fracción) de un tramo con sus dos extremos; null si le falta alguno. */
export function precisionDe(t: TramoCota, pxAhora: number): number | null {
  return t.a && t.b ? precisionTramo(t.a, t.b, t.pxA ?? pxAhora, t.pxB ?? pxAhora) : null;
}

/** Lo que da una cota completa: su «1:N», su precisión y, con escala del
 *  plano, si cuadra con ella dentro de esa precisión. null si está incompleta. */
export interface LecturaCota {
  n: number;
  mPorUnidad: number;
  metros: number;
  precision: number;
  /** null sin escala del plano. */
  cuadra: boolean | null;
  /** Diferencia (fracción) con la escala del plano. */
  desviacion: number | null;
}

export function leerCota(t: TramoCota, px: number, userUnit: number, declarada: number | null): LecturaCota | null {
  const metros = metrosDe(t);
  if (!t.a || !t.b || metros === null) return null;
  const precision = precisionDe(t, px)!;
  const mPorUnidad = mPorUnidadDeCota(t.a, t.b, metros);
  const n = escalaN(mPorUnidad, userUnit);
  const desviacion = declarada && declarada > 0 ? Math.abs(n - declarada) / declarada : null;
  const cuadra = desviacion === null ? null : desviacion <= toleranciaComprobacion(precision, 0);
  return { n, mPorUnidad, metros, precision, cuadra, desviacion };
}

export type AvisoCalibrar =
  /** Ni escala del plano ni cota. */
  | { tipo: 'nada' }
  | { tipo: 'faltan-puntos' }
  | { tipo: 'metros' }
  | { tipo: 'corta'; precision: number }
  | { tipo: 'plausibilidad'; n: number; clase: 'fuera' | 'rara' }
  /** La cota no cuadra con la escala del plano: el usuario elige con cuál sigue. */
  | { tipo: 'no-cuadra-plano'; nCota: number; declarada: number; valor: number };

export type EstadoCiclo =
  /** `sustituye`: «Volver a medir» armado; el primer clic empieza la forma nueva. */
  | { fase: 'reposo'; armada: Armada; seleccion: string | null; sustituye: string | null }
  | { fase: 'dibujando'; armada: Herramienta; puntos: Punto[]; sustituye: string | null; cruce: boolean }
  | { fase: 'nombrando'; armada: Herramienta; puntos: Punto[]; sustituye: string | null; texto: string }
  | { fase: 'creada'; armada: Herramienta; lineId: string }
  | {
      fase: 'calibrando';
      /** Herramienta que vuelve a quedar armada al terminar. */
      armada: Armada;
      /** Opcional si se sabe la escala del plano. */
      cota: TramoCota;
      aviso: AvisoCalibrar | null;
      /** El usuario confirmó una escala poco plausible («Sí, es correcta»). */
      plausibleOk: boolean;
    };

/** Una forma a medio dibujar o sin nombrar: lo que guarda un borrador. */
export type FormaEnCurso = Extract<EstadoCiclo, { fase: 'dibujando' | 'nombrando' }>;

export type EventoCiclo =
  /** `px`: píxeles de pantalla por unidad de página. `motivo`: por qué la
   *  herramienta armada no puede medir aquí (null = habilitada). `forma`: la
   *  forma bajo el cursor con Mano. `detalle`: nº de clic de la ráfaga (2 = el
   *  segundo de un doble clic, que nunca añade vértices). */
  | { tipo: 'clic'; p: Punto; px: number; mayus?: boolean; detalle?: number; forma?: string | null; motivo?: MotivoCiclo | null }
  | { tipo: 'dobleClic' }
  /** En NOMBRANDO, `motivo` es el de la medida preparada (kg/m sin resolver…). */
  | { tipo: 'enter'; componiendo?: boolean; motivo?: MotivoCiclo | null }
  | { tipo: 'terminar' }
  | { tipo: 'retroceso' }
  | { tipo: 'esc' }
  | { tipo: 'supr' }
  | { tipo: 'herramienta'; armada: Armada }
  /** `encaja` (solo `partida`): la herramienta de la forma encaja en la nueva. */
  | { tipo: 'contexto'; que: Contexto; encaja?: boolean }
  /** [A1] Retomar un borrador (§5.8). */
  | { tipo: 'seguir'; forma: FormaEnCurso }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'creada'; lineId: string }
  | { tipo: 'stale' }
  | { tipo: 'volverAMedir'; lineId: string; herramienta: Herramienta }
  | { tipo: 'calibrar' }
  | { tipo: 'metros'; texto: string }
  | { tipo: 'moverPunto'; cual: 'a' | 'b'; p: Punto; px?: number }
  /** Arrastrar un vértice antes de confirmar la forma (DIBUJANDO). */
  | { tipo: 'moverVertice'; i: number; p: Punto }
  /** `declarada`: la N de «1:N» del plano (la del cajetín o la tecleada). Con
   *  ella no hace falta cota; con las dos, la cota la confirma. */
  | { tipo: 'confirmar'; px: number; userUnit: number; declarada?: number | null }
  /** Quita la cota marcada (y su aviso). */
  | { tipo: 'rehacerCota' }
  | { tipo: 'esCorrecta'; px: number; userUnit: number; declarada?: number | null }
  /** La cota y la escala del plano no cuadran: seguir con una de las dos. */
  | { tipo: 'usar'; cual: 'cota' | 'plano'; px: number; userUnit: number; declarada?: number | null };

/** Lo que resulta de una calibración: el visor le pone `rev` y `at`. */
export interface Calibrada {
  mPorUnidad: number;
  n: number;
  /** Sin cota si se usó la escala del plano tal cual. */
  ref?: { a: Punto; b: Punto; metros: number };
  /** [A1] T9: la cota cuadra con la escala del plano y hace de comprobación. */
  comprobacion?: { fuente: 'cajetin'; escalaDeclarada: number; desviacion: number };
  /** La N de «1:N» del plano con que queda la página. */
  escalaDeclarada?: number;
  /** [A1] `mPorUnidad` llevada a la declarada exacta (la cota cuadraba dentro de su precisión). */
  ajustada?: boolean;
  /** La «1:N» que daba la cota cuando se ajustó a una escala habitual. */
  nMedida?: number;
}

export type EfectoCiclo =
  | { tipo: 'seleccionar'; forma: string | null }
  | { tipo: 'borrar'; forma: string }
  | { tipo: 'motivo'; motivo: MotivoCiclo }
  | { tipo: 'rechazo'; razon: 'cruce' | FormaInvalida | 'demasiados-puntos' }
  /** Entra en NOMBRANDO: el visor prepara la medida (vista previa). */
  | { tipo: 'preparar' }
  /** Enter con la medida preparada sin motivo: el visor la crea en el store. */
  | { tipo: 'crear' }
  /** Esc en reposo: salir de pantalla completa o, si no, cerrar el visor. */
  | { tipo: 'escReposo' }
  | { tipo: 'descartada'; que: Contexto }
  /** [A1] La forma sale del ciclo sin perderse: el visor la guarda (§5.8). */
  | { tipo: 'borrador'; que: Contexto; forma: FormaEnCurso }
  /** «Volver a medir» que no llegó a sustituir: la forma vieja vuelve a verse. */
  | { tipo: 'restaurar'; lineId: string }
  | { tipo: 'calibrada'; datos: Calibrada };

export interface Paso {
  estado: EstadoCiclo;
  efectos: EfectoCiclo[];
}

export const REPOSO: EstadoCiclo = { fase: 'reposo', armada: 'mano', seleccion: null, sustituye: null };

export function reposo(armada: Armada, sustituye: string | null = null): EstadoCiclo {
  return { fase: 'reposo', armada, seleccion: null, sustituye };
}

const quieto = (estado: EstadoCiclo): Paso => ({ estado, efectos: [] });

/** Salir de DIBUJANDO/NOMBRANDO (o de un «Volver a medir» armado) sin crear:
 *  la forma vieja vuelve a verse. */
function salir(e: { sustituye: string | null; armada: Armada }, extra: EfectoCiclo[] = []): Paso {
  const efectos = [...extra];
  if (e.sustituye) efectos.push({ tipo: 'restaurar', lineId: e.sustituye });
  return { estado: reposo(e.armada), efectos };
}

export const aMedio = (e: EstadoCiclo): e is FormaEnCurso => e.fase === 'dibujando' || e.fase === 'nombrando';

/** Cambios que guardan la forma como borrador en vez de descartarla (§5.8). */
const GUARDAN: ReadonlySet<Contexto> = new Set(['partida', 'pagina', 'plano', 'ocupante', 'vista']);

/** Empieza una forma con un clic (reposo o creada con una herramienta de medir). */
function empezar(armada: Herramienta, p: Punto, sustituye: string | null = null): Paso {
  return { estado: { fase: 'dibujando', armada, puntos: [p], sustituye, cruce: false }, efectos: [] };
}

/** Cierra la forma en curso si es válida: pasa a NOMBRANDO y pide preparar. */
function cerrar(e: Extract<EstadoCiclo, { fase: 'dibujando' }>, puntos: Punto[] = e.puntos): Paso {
  const invalida = formaInvalida(e.armada, puntos);
  if (invalida) return { estado: e, efectos: [{ tipo: 'rechazo', razon: invalida }] };
  if (e.armada === 'superficie' && cruzaLaForma(puntos, null, true))
    return { estado: { ...e, cruce: true }, efectos: [{ tipo: 'rechazo', razon: 'cruce' }] };
  return {
    estado: { fase: 'nombrando', armada: e.armada, puntos, sustituye: e.sustituye, texto: '' },
    efectos: [{ tipo: 'preparar' }],
  };
}

function clicDibujando(e: Extract<EstadoCiclo, { fase: 'dibujando' }>, ev: Extract<EventoCiclo, { tipo: 'clic' }>): Paso {
  if ((ev.detalle ?? 1) >= 2) return quieto(e); // el 2.º clic de un doble clic no añade vértices
  const ultimo = e.puntos[e.puntos.length - 1]!;
  const p = ev.mayus && e.armada !== 'recuento' ? ajustar45(ultimo, ev.p) : ev.p;
  if (e.armada !== 'recuento' && demasiadoCerca(ultimo, p, ev.px)) return quieto(e);
  if (e.puntos.length >= TOPES.puntosPorOrigen) return { estado: e, efectos: [{ tipo: 'rechazo', razon: 'demasiados-puntos' }] };
  switch (e.armada) {
    case 'rectangulo':
      if (e.puntos.length === 2) return cerrar(e, rectanguloTresClics(e.puntos[0]!, e.puntos[1]!, p));
      return quieto({ ...e, puntos: [...e.puntos, p] });
    case 'superficie':
      if (e.puntos.length >= 3 && sobrePrimerVertice(p, e.puntos[0]!, ev.px)) return cerrar(e);
      if (cruzaLaForma(e.puntos, p)) return { estado: { ...e, cruce: true }, efectos: [{ tipo: 'rechazo', razon: 'cruce' }] };
      return quieto({ ...e, puntos: [...e.puntos, p], cruce: false });
    default:
      return quieto({ ...e, puntos: [...e.puntos, p], cruce: false });
  }
}

/* ---- calibración -------------------------------------------------------------- */

const TRAMO_VACIO: TramoCota = { a: null, b: null, metros: '' };

function metrosDe(t: TramoCota): number | null {
  const v = parseEsNumber(t.metros.trim());
  return v !== null && Number.isFinite(v) && v > 0 ? v : null;
}

type Calibrando = Extract<EstadoCiclo, { fase: 'calibrando' }>;

function clicCalibrando(e: Calibrando, ev: Extract<EventoCiclo, { tipo: 'clic' }>): Paso {
  if ((ev.detalle ?? 1) >= 2) return quieto(e);
  const t = e.cota;
  let nuevo: TramoCota;
  if (!t.a || t.b) nuevo = { metros: t.metros, a: ev.p, b: null, pxA: ev.px }; // primer clic (o empezar de nuevo)
  else {
    const p = ev.mayus ? ajustar45(t.a, ev.p) : ev.p;
    if (demasiadoCerca(t.a, p, ev.px)) return quieto(e);
    nuevo = { ...t, b: p, pxB: ev.px };
  }
  return quieto({ ...e, cota: nuevo, aviso: null });
}

const calibrada = (e: Calibrando, datos: Calibrada): Paso => ({
  estado: reposo(e.armada),
  efectos: [{ tipo: 'calibrada', datos }],
});

const redondear6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** La página a la escala del plano, sin cota: el tamaño del papel sale del PDF. */
const aEscalaDelPlano = (e: Calibrando, declarada: number, userUnit: number): Paso =>
  calibrada(e, { mPorUnidad: mPorUnidadDeEscala(declarada, userUnit), n: declarada, escalaDeclarada: declarada });

/**
 * Un solo paso (§2): con la escala del plano basta; con una cota, la cota da
 * la escala (ajustada a la habitual que cae dentro de su precisión); con las
 * dos, si cuadran queda la del plano exacta y, si no, el usuario elige.
 */
function confirmarCalibracion(e: Calibrando, px: number, userUnit: number, declarada: number | null = null): Paso {
  const conAviso = (aviso: AvisoCalibrar): Paso => quieto({ ...e, aviso });
  const cota = e.cota;
  const dec = declarada && declarada > 0 ? declarada : null;
  if (!cota.a && !cota.b) return dec ? aEscalaDelPlano(e, dec, userUnit) : conAviso({ tipo: 'nada' });
  if (!cota.a || !cota.b) return conAviso({ tipo: 'faltan-puntos' });
  const l = leerCota(cota, px, userUnit, dec);
  if (!l) return conAviso({ tipo: 'metros' });
  if (!(l.precision <= DESVIACION_TOPE)) return conAviso({ tipo: 'corta', precision: l.precision });
  const ref = { a: cota.a, b: cota.b, metros: l.metros };
  if (dec) {
    // [A1] T9: la cota cuadra con la escala del plano dentro de su precisión:
    // hace de comprobación y la escala queda la exacta (sin el error del clic).
    if (!l.cuadra) return conAviso({ tipo: 'no-cuadra-plano', nCota: l.n, declarada: dec, valor: l.desviacion! });
    return calibrada(e, {
      mPorUnidad: mPorUnidadDeEscala(dec, userUnit),
      n: dec,
      ref,
      comprobacion: { fuente: 'cajetin', escalaDeclarada: dec, desviacion: redondear6(l.desviacion!) },
      escalaDeclarada: dec,
      ajustada: true,
    });
  }
  // Solo la cota: si una escala habitual cae dentro de su precisión, se ajusta a ella.
  const exacta = escalaParaAjustar(l.n, l.precision);
  const n = exacta ?? l.n;
  const clase = plausibilidad(n);
  if (clase !== 'ok' && !e.plausibleOk) return conAviso({ tipo: 'plausibilidad', n, clase });
  return calibrada(e, {
    mPorUnidad: exacta ? mPorUnidadDeEscala(exacta, userUnit) : l.mPorUnidad,
    n,
    ref,
    ...(exacta && exacta !== l.n ? { nMedida: l.n } : {}),
  });
}

/** «Usar la cota» o «Usar la escala del plano» cuando no cuadran: lo decide el usuario. */
function usar(e: Calibrando, cual: 'cota' | 'plano', px: number, userUnit: number, declarada: number | null): Paso {
  const dec = declarada && declarada > 0 ? declarada : null;
  if (cual === 'plano') return dec ? aEscalaDelPlano(e, dec, userUnit) : quieto(e);
  const l = leerCota(e.cota, px, userUnit, null);
  if (!l || !e.cota.a || !e.cota.b) return quieto(e);
  return calibrada(e, { mPorUnidad: l.mPorUnidad, n: l.n, ref: { a: e.cota.a, b: e.cota.b, metros: l.metros } });
}

/* ---- el reductor ---------------------------------------------------------------- */

export function cicloReducer(e: EstadoCiclo, ev: EventoCiclo): Paso {
  // Cambio de herramienta, en cualquier fase.
  if (ev.tipo === 'herramienta') {
    if (aMedio(e)) return { ...salir(e, [{ tipo: 'descartada', que: 'herramienta' }]), estado: reposo(ev.armada) };
    if (e.fase === 'reposo' && e.sustituye) return { ...salir(e), estado: reposo(ev.armada) };
    return quieto(reposo(ev.armada));
  }
  if (ev.tipo === 'contexto') {
    if (aMedio(e)) {
      if (ev.que === 'partida' && ev.encaja) return quieto(e); // pasa a la partida nueva
      if (GUARDAN.has(ev.que)) return { estado: reposo(e.armada), efectos: [{ tipo: 'borrador', que: ev.que, forma: e }] };
      return salir(e, [{ tipo: 'descartada', que: ev.que }]);
    }
    if (e.fase === 'reposo' && e.sustituye) return salir(e);
    if (e.fase === 'calibrando' && (ev.que === 'pagina' || ev.que === 'plano' || ev.que === 'ocupante'))
      return quieto(reposo(e.armada));
    if (e.fase === 'creada') return quieto(reposo(e.armada));
    if (e.fase === 'reposo' && e.seleccion) return { estado: { ...e, seleccion: null }, efectos: [{ tipo: 'seleccionar', forma: null }] };
    return quieto(e);
  }
  if (ev.tipo === 'seguir') {
    // Solo desde reposo o creada: nunca pisa otra forma ni una calibración.
    return quieto(e.fase === 'reposo' || e.fase === 'creada' ? ev.forma : e);
  }
  if (ev.tipo === 'volverAMedir') {
    const previo = aMedio(e) || (e.fase === 'reposo' && e.sustituye) ? salir(e as { sustituye: string | null; armada: Armada }).efectos : [];
    return { estado: reposo(ev.herramienta, ev.lineId), efectos: previo };
  }
  if (ev.tipo === 'calibrar') {
    const previo = aMedio(e)
      ? salir(e, [{ tipo: 'descartada', que: 'herramienta' }]).efectos
      : e.fase === 'reposo' && e.sustituye
        ? salir(e).efectos
        : [];
    return {
      estado: {
        fase: 'calibrando',
        armada: e.armada,
        cota: { ...TRAMO_VACIO },
        aviso: null,
        plausibleOk: false,
      },
      efectos: previo,
    };
  }

  switch (e.fase) {
    case 'reposo':
      switch (ev.tipo) {
        case 'clic':
          if (e.armada === 'mano') {
            const forma = ev.forma ?? null;
            if (forma === e.seleccion) return quieto(e);
            return { estado: { ...e, seleccion: forma }, efectos: [{ tipo: 'seleccionar', forma }] };
          }
          if (ev.motivo) return { estado: e, efectos: [{ tipo: 'motivo', motivo: ev.motivo }] };
          return empezar(e.armada, ev.p, e.sustituye);
        case 'supr':
          if (e.armada === 'mano' && e.seleccion) return { estado: e, efectos: [{ tipo: 'borrar', forma: e.seleccion }] };
          return quieto(e);
        case 'esc':
          if (e.sustituye) return salir(e);
          if (e.seleccion) return { estado: { ...e, seleccion: null }, efectos: [{ tipo: 'seleccionar', forma: null }] };
          return { estado: e, efectos: [{ tipo: 'escReposo' }] };
        default:
          return quieto(e);
      }

    case 'dibujando':
      switch (ev.tipo) {
        case 'clic':
          return clicDibujando(e, ev);
        case 'dobleClic':
          if ((e.armada === 'longitud' && e.puntos.length >= 2) || (e.armada === 'superficie' && e.puntos.length >= 3))
            return cerrar(e);
          return quieto(e);
        case 'enter':
        case 'terminar':
          if (e.armada === 'rectangulo' && e.puntos.length < 3)
            return { estado: e, efectos: [{ tipo: 'rechazo', razon: 'pocos-vertices' }] };
          return cerrar(e);
        case 'retroceso':
          if (e.puntos.length >= 2) return quieto({ ...e, puntos: e.puntos.slice(0, -1), cruce: false });
          return quieto(reposo(e.armada, e.sustituye)); // «Volver a medir» sigue armado
        case 'moverVertice': {
          if (ev.i < 0 || ev.i >= e.puntos.length) return quieto(e);
          const puntos = e.puntos.map((q, i) => (i === ev.i ? ev.p : q));
          // En Superficie, un vértice arrastrado no puede cruzar la forma.
          if (e.armada === 'superficie' && puntos.some((q, k) => k >= 2 && cruzaLaForma(puntos.slice(0, k), q)))
            return { estado: { ...e, cruce: true }, efectos: [{ tipo: 'rechazo', razon: 'cruce' }] };
          return quieto({ ...e, puntos, cruce: false });
        }
        case 'esc':
          return salir(e);
        default:
          return quieto(e);
      }

    case 'nombrando':
      switch (ev.tipo) {
        case 'texto':
          return quieto({ ...e, texto: ev.texto });
        case 'enter':
          if (ev.componiendo) return quieto(e);
          if (ev.motivo) return { estado: e, efectos: [{ tipo: 'motivo', motivo: ev.motivo }] };
          return { estado: e, efectos: [{ tipo: 'crear' }] };
        case 'creada':
          return quieto({ fase: 'creada', armada: e.armada, lineId: ev.lineId });
        case 'stale':
          return { estado: e, efectos: [{ tipo: 'preparar' }] };
        case 'esc':
          return salir(e);
        default:
          return quieto(e);
      }

    case 'creada':
      switch (ev.tipo) {
        case 'clic':
          if (ev.motivo) return { estado: e, efectos: [{ tipo: 'motivo', motivo: ev.motivo }] };
          return empezar(e.armada, ev.p);
        case 'esc':
          return quieto(reposo(e.armada));
        default:
          return quieto(e);
      }

    case 'calibrando':
      switch (ev.tipo) {
        case 'clic':
          return clicCalibrando(e, ev);
        case 'moverPunto': {
          const t = e.cota;
          if (!t[ev.cual]) return quieto(e);
          const zoom = ev.px ? { [ev.cual === 'a' ? 'pxA' : 'pxB']: ev.px } : {};
          return quieto({ ...e, cota: { ...t, [ev.cual]: ev.p, ...zoom }, aviso: null });
        }
        case 'metros':
          return quieto({ ...e, cota: { ...e.cota, metros: ev.texto }, aviso: null });
        case 'confirmar':
          return confirmarCalibracion(e, ev.px, ev.userUnit, ev.declarada ?? null);
        case 'enter':
          return quieto(e); // Enter lo traduce el visor a «confirmar» con px y userUnit
        case 'esCorrecta':
          return confirmarCalibracion({ ...e, plausibleOk: true }, ev.px, ev.userUnit, ev.declarada ?? null);
        case 'usar':
          return usar(e, ev.cual, ev.px, ev.userUnit, ev.declarada ?? null);
        case 'rehacerCota':
          return quieto({ ...e, cota: { ...TRAMO_VACIO }, aviso: null, plausibleOk: false });
        case 'esc':
          return quieto(reposo(e.armada));
        default:
          return quieto(e);
      }
  }
}

/** ¿El visor tiene algo en curso que consume Esc (no está en reposo)? */
export function cicloOcupado(e: EstadoCiclo): boolean {
  return e.fase !== 'reposo';
}

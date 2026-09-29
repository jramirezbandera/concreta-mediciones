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
     reposo ──Calibrar──► calibrando.cota ──► calibrando.comprobacion ──► reposo

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
  cifra,
  cruzaLaForma,
  demasiadoCerca,
  desviacion,
  dist,
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

/** Una cota (o la comprobación): dos puntos y la distancia real tecleada.
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

export type AvisoCalibrar =
  | { tipo: 'faltan-puntos' }
  | { tipo: 'metros' }
  /** `cual`: la cota o la comprobación. */
  | { tipo: 'corta'; cual: 'cota' | 'comprobacion'; precision: number }
  /** `nCota`/`nComp`: la «1:N» que da cada una; `tolerancia`: lo admitido. */
  | { tipo: 'desviacion'; valor: number; tolerancia: number; nCota: number; nComp: number }
  | { tipo: 'plausibilidad'; n: number; clase: 'fuera' | 'rara' }
  /** La cota no cuadra con la escala del plano (cajetín o tecleada): se pide la comprobación. */
  | { tipo: 'no-cuadra-plano'; nCota: number; declarada: number };

export type EstadoCiclo =
  /** `sustituye`: «Volver a medir» armado; el primer clic empieza la forma nueva. */
  | { fase: 'reposo'; armada: Armada; seleccion: string | null; sustituye: string | null }
  | { fase: 'dibujando'; armada: Herramienta; puntos: Punto[]; sustituye: string | null; cruce: boolean }
  | { fase: 'nombrando'; armada: Herramienta; puntos: Punto[]; sustituye: string | null; texto: string }
  | { fase: 'creada'; armada: Herramienta; lineId: string }
  | {
      fase: 'calibrando';
      paso: 'cota' | 'comprobacion';
      /** Herramienta que vuelve a quedar armada al terminar. */
      armada: Armada;
      cota: TramoCota;
      comprobacion: TramoCota;
      aviso: AvisoCalibrar | null;
      /** El usuario confirmó una escala poco plausible («Sí, es correcta»). */
      plausibleOk: boolean;
      /** [A1] Solo añadir la comprobación a una escala «sin comprobar»: la
       *  cota es la de la escala y se compara con su `mPorUnidad`. */
      soloComprobar?: { mPorUnidad: number };
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
  /** [A1] «Comprobar» una escala sin comprobación: empieza en el paso 2. */
  | { tipo: 'comprobar'; mPorUnidad: number; ref: { a: Punto; b: Punto; metros: number } }
  | { tipo: 'metros'; cual: 'cota' | 'comprobacion'; texto: string }
  | { tipo: 'moverPunto'; cual: 'a' | 'b'; p: Punto; px?: number }
  /** Arrastrar un vértice antes de confirmar la forma (DIBUJANDO). */
  | { tipo: 'moverVertice'; i: number; p: Punto }
  /** `cajetin`: la N de «1:N» del plano: la que declara el texto de la página
   *  (A1) o la que teclea el usuario. Con ella basta una cota. */
  | { tipo: 'confirmar'; px: number; userUnit: number; cajetin?: number | null }
  | { tipo: 'rehacerCota' }
  | { tipo: 'rehacerComprobacion' }
  | { tipo: 'esCorrecta'; px: number; userUnit: number; cajetin?: number | null };

/** Lo que resulta de una calibración completa: el visor le pone `rev` y `at`. */
export interface Calibrada {
  mPorUnidad: number;
  n: number;
  ref: { a: Punto; b: Punto; metros: number };
  comprobacion:
    | { fuente: 'cota'; a: Punto; b: Punto; metros: number; medidos: number; desviacion: number }
    /** [A1] T9: el cajetín cuadra a menos del 1 % y hace de comprobación. */
    | { fuente: 'cajetin'; escalaDeclarada: number; desviacion: number };
  /** [A1] La N de «1:N» del cajetín, si la página declara una. */
  escalaDeclarada?: number;
  /** [A1] `mPorUnidad` llevada a la declarada exacta (cuadraba dentro de la precisión). */
  ajustada?: boolean;
  /** La «1:N» que daban las cotas cuando se ajustó a una escala exacta. */
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
  | { tipo: 'calibrada'; datos: Calibrada }
  /** [A1] La comprobación de una escala que no la tenía (misma escala y `rev`). */
  | { tipo: 'comprobada'; comprobacion: Extract<Calibrada['comprobacion'], { fuente: 'cota' }> };

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

function clicCalibrando(e: Extract<EstadoCiclo, { fase: 'calibrando' }>, ev: Extract<EventoCiclo, { tipo: 'clic' }>): Paso {
  if ((ev.detalle ?? 1) >= 2) return quieto(e);
  const t = e[e.paso];
  let nuevo: TramoCota;
  if (!t.a || t.b) nuevo = { metros: t.metros, a: ev.p, b: null, pxA: ev.px }; // primer clic (o empezar de nuevo)
  else {
    const p = ev.mayus ? ajustar45(t.a, ev.p) : ev.p;
    if (demasiadoCerca(t.a, p, ev.px)) return quieto(e);
    nuevo = { ...t, b: p, pxB: ev.px };
  }
  return quieto({ ...e, [e.paso]: nuevo, aviso: null } as typeof e);
}

function confirmarCalibracion(
  e: Extract<EstadoCiclo, { fase: 'calibrando' }>,
  px: number,
  userUnit: number,
  cajetin: number | null = null,
): Paso {
  const conAviso = (aviso: AvisoCalibrar): Paso => quieto({ ...e, aviso });
  const cota = e.cota;
  const declarada = cajetin && cajetin > 0 ? { escalaDeclarada: cajetin } : {};
  const redondear6 = (v: number) => Math.round(v * 1e6) / 1e6;
  if (e.paso === 'cota') {
    if (!cota.a || !cota.b) return conAviso({ tipo: 'faltan-puntos' });
    const metros = metrosDe(cota);
    if (metros === null) return conAviso({ tipo: 'metros' });
    const prec = precisionDe(cota, px)!;
    if (!(prec <= DESVIACION_TOPE)) return conAviso({ tipo: 'corta', cual: 'cota', precision: prec });
    // [A1] T9: si el plano tiene escala (la del cajetín o la tecleada) y la
    // cota cuadra con ella dentro de su precisión, la cota hace de control y
    // la escala se ajusta a la exacta (se quita el error del clic). Si no
    // cuadra (un A1 exportado a A3…), la cota manda y se pide la comprobación.
    if (cajetin && cajetin > 0 && !e.soloComprobar) {
      const nCal = escalaN(mPorUnidadDeCota(cota.a, cota.b, metros), userUnit);
      const desv = Math.abs(nCal - cajetin) / cajetin;
      if (!(desv <= toleranciaComprobacion(prec, 0)))
        return quieto({ ...e, paso: 'comprobacion', aviso: { tipo: 'no-cuadra-plano', nCota: nCal, declarada: cajetin } });
      return {
        estado: reposo(e.armada),
        efectos: [
          {
            tipo: 'calibrada',
            datos: {
              mPorUnidad: mPorUnidadDeEscala(cajetin, userUnit),
              n: cajetin,
              ref: { a: cota.a, b: cota.b, metros },
              comprobacion: { fuente: 'cajetin', escalaDeclarada: cajetin, desviacion: redondear6(desv) },
              escalaDeclarada: cajetin,
              ajustada: true,
            },
          },
        ],
      };
    }
    return quieto({ ...e, paso: 'comprobacion', aviso: null });
  }
  const comp = e.comprobacion;
  if (!comp.a || !comp.b) return conAviso({ tipo: 'faltan-puntos' });
  const metrosComp = metrosDe(comp);
  if (metrosComp === null) return conAviso({ tipo: 'metros' });
  const precComp = precisionDe(comp, px)!;
  if (!(precComp <= DESVIACION_TOPE)) return conAviso({ tipo: 'corta', cual: 'comprobacion', precision: precComp });
  const dComp = dist(comp.a, comp.b);
  const nComp = escalaN(metrosComp / dComp, userUnit);
  if (e.soloComprobar) {
    // La escala guardada es la referencia: solo cuenta la precisión de la comprobación.
    const medidos = dComp * e.soloComprobar.mPorUnidad;
    const desv = desviacion(medidos, metrosComp);
    const tol = toleranciaComprobacion(0, precComp);
    if (!(desv <= tol))
      return conAviso({ tipo: 'desviacion', valor: desv, tolerancia: tol, nCota: escalaN(e.soloComprobar.mPorUnidad, userUnit), nComp });
    return {
      estado: reposo(e.armada),
      efectos: [
        {
          tipo: 'comprobada',
          comprobacion: { fuente: 'cota', a: comp.a, b: comp.b, metros: metrosComp, medidos: redondear6(medidos), desviacion: redondear6(desv) },
        },
      ],
    };
  }
  const metrosCota = metrosDe(cota);
  if (!cota.a || !cota.b || metrosCota === null) return quieto({ ...e, paso: 'cota', aviso: { tipo: 'faltan-puntos' } });
  const precCota = precisionDe(cota, px)!;
  const dCota = dist(cota.a, cota.b);
  // La desviación admitida crece con la imprecisión de las dos cotas: dos
  // cotas cortas bien marcadas no pueden cuadrar al 1 %.
  const tol = toleranciaComprobacion(precCota, precComp);
  const desvCruzada = desviacion(dComp * mPorUnidadDeCota(cota.a, cota.b, metrosCota), metrosComp);
  if (!(desvCruzada <= tol))
    return conAviso({ tipo: 'desviacion', valor: desvCruzada, tolerancia: tol, nCota: escalaN(metrosCota / dCota, userUnit), nComp });
  // Cuadran: la escala sale de las dos a la vez (más precisa que cualquiera)
  // y, si una escala habitual (o la del cajetín) cae dentro de su precisión,
  // se ajusta a ella exacta.
  const mMedida = (metrosCota + metrosComp) / (dCota + dComp);
  const prec = Math.hypot(precCota * dCota, precComp * dComp) / (dCota + dComp);
  const nMedida = escalaN(mMedida, userUnit);
  const exacta = escalaParaAjustar(nMedida, prec, cajetin);
  const m = exacta ? mPorUnidadDeEscala(exacta, userUnit) : mMedida;
  const n = exacta ?? nMedida;
  const clase = plausibilidad(n);
  if (clase !== 'ok' && !e.plausibleOk) return conAviso({ tipo: 'plausibilidad', n, clase });
  const medidos = dComp * m;
  return {
    estado: reposo(e.armada),
    efectos: [
      {
        tipo: 'calibrada',
        datos: {
          mPorUnidad: m,
          n,
          ref: { a: cota.a, b: cota.b, metros: metrosCota },
          comprobacion: {
            fuente: 'cota',
            a: comp.a,
            b: comp.b,
            metros: metrosComp,
            medidos: redondear6(medidos),
            desviacion: redondear6(desviacion(medidos, metrosComp)),
          },
          ...declarada,
          ...(exacta && exacta === cajetin ? { ajustada: true } : {}),
          ...(exacta && exacta !== nMedida ? { nMedida } : {}),
        },
      },
    ],
  };
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
  if (ev.tipo === 'comprobar') {
    const previo = aMedio(e)
      ? salir(e, [{ tipo: 'descartada', que: 'herramienta' }]).efectos
      : e.fase === 'reposo' && e.sustituye
        ? salir(e).efectos
        : [];
    return {
      estado: {
        fase: 'calibrando',
        paso: 'comprobacion',
        armada: e.armada,
        cota: { a: ev.ref.a, b: ev.ref.b, metros: cifra(ev.ref.metros) },
        comprobacion: { ...TRAMO_VACIO },
        aviso: null,
        plausibleOk: false,
        soloComprobar: { mPorUnidad: ev.mPorUnidad },
      },
      efectos: previo,
    };
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
        paso: 'cota',
        armada: e.armada,
        cota: { ...TRAMO_VACIO },
        comprobacion: { ...TRAMO_VACIO },
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
          const t = e[e.paso];
          if (!t[ev.cual]) return quieto(e);
          const zoom = ev.px ? { [ev.cual === 'a' ? 'pxA' : 'pxB']: ev.px } : {};
          return quieto({ ...e, [e.paso]: { ...t, [ev.cual]: ev.p, ...zoom }, aviso: null } as typeof e);
        }
        case 'metros':
          return quieto({ ...e, [ev.cual]: { ...e[ev.cual], metros: ev.texto }, aviso: null } as typeof e);
        case 'confirmar':
          return confirmarCalibracion(e, ev.px, ev.userUnit, ev.cajetin ?? null);
        case 'enter':
          return quieto(e); // Enter lo traduce el visor a «confirmar» con px y userUnit
        case 'esCorrecta':
          return confirmarCalibracion({ ...e, plausibleOk: true }, ev.px, ev.userUnit, ev.cajetin ?? null);
        case 'rehacerCota': {
          // Rehacer la cota de una escala sin comprobar es calibrar de nuevo.
          const { soloComprobar: _sc, ...resto } = e;
          void _sc;
          return quieto({ ...resto, paso: 'cota', cota: { ...TRAMO_VACIO }, aviso: null, plausibleOk: false });
        }
        case 'rehacerComprobacion':
          return quieto({ ...e, paso: 'comprobacion', comprobacion: { ...TRAMO_VACIO }, aviso: null, plausibleOk: false });
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

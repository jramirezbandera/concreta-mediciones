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

   La herramienta armada se mantiene tras crear una línea. Un cambio de
   partida, página, plano, ocupante, escala o herramienta a medio dibujo
   descarta la forma con aviso (en A0 no hay borradores).
   =========================================================================== */
import { parseEsNumber } from './money';
/** Un motivo por el que no se puede medir (el de `planoMedida` o uno del visor:
 *  sin partida, solo lectura…). El ciclo no lo interpreta: lo devuelve como efecto. */
export type MotivoCiclo = { motivo: string };
import {
  COTA_MIN_PX,
  DESVIACION_MAX,
  ajustar45,
  cifra,
  cruzaLaForma,
  demasiadoCerca,
  desviacion,
  dist,
  escalaN,
  formaInvalida,
  mPorUnidadDeCota,
  plausibilidad,
  precisionCota,
  rectanguloTresClics,
  sobrePrimerVertice,
  type FormaInvalida,
} from './planoGeom';
import { TOPES } from './planoDatos';
import type { Herramienta, Punto } from './types';

export type Armada = 'mano' | Herramienta;
/** Qué cambió bajo una forma a medio dibujar. */
export type Contexto = 'partida' | 'pagina' | 'plano' | 'ocupante' | 'escala' | 'herramienta';

/** Una cota (o la comprobación): dos puntos y la distancia real tecleada. */
export interface TramoCota {
  a: Punto | null;
  b: Punto | null;
  metros: string;
}

export type AvisoCalibrar =
  | { tipo: 'faltan-puntos' }
  | { tipo: 'metros' }
  | { tipo: 'corta'; px: number; precision: number }
  | { tipo: 'desviacion'; valor: number }
  | { tipo: 'plausibilidad'; n: number; clase: 'fuera' | 'rara' };

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
  | { tipo: 'contexto'; que: Contexto }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'creada'; lineId: string }
  | { tipo: 'stale' }
  | { tipo: 'volverAMedir'; lineId: string; herramienta: Herramienta }
  | { tipo: 'calibrar' }
  /** [A1] «Comprobar» una escala sin comprobación: empieza en el paso 2. */
  | { tipo: 'comprobar'; mPorUnidad: number; ref: { a: Punto; b: Punto; metros: number } }
  | { tipo: 'metros'; cual: 'cota' | 'comprobacion'; texto: string }
  | { tipo: 'moverPunto'; cual: 'a' | 'b'; p: Punto }
  /** Arrastrar un vértice antes de confirmar la forma (DIBUJANDO). */
  | { tipo: 'moverVertice'; i: number; p: Punto }
  /** `cajetin`: la N de «1:N» si el texto de la página declara UNA escala (A1). */
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
  /** [A1] `mPorUnidad` llevada a la declarada exacta (cuadraba a < 1 %). */
  ajustada?: boolean;
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

const aMedio = (e: EstadoCiclo): e is Extract<EstadoCiclo, { fase: 'dibujando' | 'nombrando' }> =>
  e.fase === 'dibujando' || e.fase === 'nombrando';

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
  if (!t.a || t.b) nuevo = { ...t, a: ev.p, b: null }; // primer clic (o empezar de nuevo)
  else {
    const p = ev.mayus ? ajustar45(t.a, ev.p) : ev.p;
    if (demasiadoCerca(t.a, p, ev.px)) return quieto(e);
    nuevo = { ...t, b: p };
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
  if (e.paso === 'cota') {
    if (!cota.a || !cota.b) return conAviso({ tipo: 'faltan-puntos' });
    const metros = metrosDe(cota);
    if (metros === null) return conAviso({ tipo: 'metros' });
    const largoPx = dist(cota.a, cota.b) * px;
    if (largoPx < COTA_MIN_PX) return conAviso({ tipo: 'corta', px: largoPx, precision: precisionCota(largoPx) });
    // [A1] T9: si el cajetín declara UNA escala y la cota cuadra con ella a
    // menos del 1 %, el cajetín hace de comprobación y la escala se ajusta a
    // la exacta (se quita el error del clic). Si no cuadra, la cota manda y se
    // pide la comprobación de siempre.
    if (cajetin && cajetin > 0 && !e.soloComprobar) {
      const nCal = escalaN(mPorUnidadDeCota(cota.a, cota.b, metros), userUnit);
      const desv = Math.abs(nCal - cajetin) / cajetin;
      if (desv <= DESVIACION_MAX)
        return {
          estado: reposo(e.armada),
          efectos: [
            {
              tipo: 'calibrada',
              datos: {
                mPorUnidad: (cajetin * userUnit * 0.0254) / 72,
                n: cajetin,
                ref: { a: cota.a, b: cota.b, metros },
                comprobacion: { fuente: 'cajetin', escalaDeclarada: cajetin, desviacion: Math.round(desv * 1e6) / 1e6 },
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
  const redondear6 = (v: number) => Math.round(v * 1e6) / 1e6;
  if (e.soloComprobar) {
    if (!comp.a || !comp.b) return conAviso({ tipo: 'faltan-puntos' });
    const metros = metrosDe(comp);
    if (metros === null) return conAviso({ tipo: 'metros' });
    const medidos = dist(comp.a, comp.b) * e.soloComprobar.mPorUnidad;
    const desv = desviacion(medidos, metros);
    if (!(desv <= DESVIACION_MAX)) return conAviso({ tipo: 'desviacion', valor: desv });
    return {
      estado: reposo(e.armada),
      efectos: [
        {
          tipo: 'comprobada',
          comprobacion: { fuente: 'cota', a: comp.a, b: comp.b, metros, medidos: redondear6(medidos), desviacion: redondear6(desv) },
        },
      ],
    };
  }
  const metrosCota = metrosDe(cota);
  if (!cota.a || !cota.b || metrosCota === null) return quieto({ ...e, paso: 'cota', aviso: { tipo: 'faltan-puntos' } });
  if (!comp.a || !comp.b) return conAviso({ tipo: 'faltan-puntos' });
  const metrosComp = metrosDe(comp);
  if (metrosComp === null) return conAviso({ tipo: 'metros' });
  const m = mPorUnidadDeCota(cota.a, cota.b, metrosCota);
  const medidos = dist(comp.a, comp.b) * m;
  const desv = desviacion(medidos, metrosComp);
  if (!(desv <= DESVIACION_MAX)) return conAviso({ tipo: 'desviacion', valor: desv });
  const n = escalaN(m, userUnit);
  const clase = plausibilidad(n);
  if (clase !== 'ok' && !e.plausibleOk) return conAviso({ tipo: 'plausibilidad', n, clase });
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
            desviacion: redondear6(desv),
          },
          ...declarada,
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
    if (aMedio(e)) return salir(e, [{ tipo: 'descartada', que: ev.que }]);
    if (e.fase === 'reposo' && e.sustituye) return salir(e);
    if (e.fase === 'calibrando' && (ev.que === 'pagina' || ev.que === 'plano' || ev.que === 'ocupante'))
      return quieto(reposo(e.armada));
    if (e.fase === 'creada') return quieto(reposo(e.armada));
    if (e.fase === 'reposo' && e.seleccion) return { estado: { ...e, seleccion: null }, efectos: [{ tipo: 'seleccionar', forma: null }] };
    return quieto(e);
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
          return quieto({ ...e, [e.paso]: { ...t, [ev.cual]: ev.p }, aviso: null } as typeof e);
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

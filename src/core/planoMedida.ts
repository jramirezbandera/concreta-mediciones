/* ===========================================================================
   core/planoMedida — de una medida sobre el plano a líneas de medición.
   Especificación · Etapa A, §3 (docs/plan-medir-planos-pdf.md).

   La herramienta da una MAGNITUD y la forma de medir de la partida
   (`medFormaDe`) decide en qué casilla se escribe. La tabla va como DATOS (una
   celda por herramienta × forma) y el test la recorre entera:

     medida (puntos + escala) ─► TABLA_MEDIDA[herramienta][forma]
                                   · no encaja  → motivo (y la que sí encaja)
                                   · encaja     → magnitud, slots, fijas
                              ─► valoresDesdeOrigen (la ÚNICA regla de valores:
                                 crear, recalcular [A1], copiar [A1], vértices [B])
                              ─► línea: casillas + `expr` + `origen`

   Reglas que no dependen de la celda:
   · Toda casilla visible se rellena o no se mide: una casilla vacía vale ×1
     (`core/medicion`), así que cada casilla de la forma que el plano no da
     sale de una fija OBLIGATORIA.
   · Restar = signo de `uds`. Fuera de Recuento `uds` es 1 o −1 y no entra en
     `valores`; en Recuento `uds = ±N` y sí entra.
   · Una línea es «retocada» si alguna casilla de `slots` difiere de `valores`.
   =========================================================================== */
import { evalEsExpr } from './expresion';
import { MED_SLOTS, medFormaDe, medFormaDef } from './medForma';
import { lineParcial } from './medicion';
import { resumenCantidad, type ResumenCantidad } from './medPaste';
import { round2 } from './money';
import { nombrePerfil, perfilEnTexto } from './perfiles';
import { TOPES, etiquetaDe, origenLegible } from './planoDatos';
import {
  areaMetros,
  cifra,
  cruzaLaForma,
  formaInvalida,
  ladosRectangulo,
  redondearPunto,
  tramosMetros,
  type FormaInvalida,
} from './planoGeom';
import type {
  Escala,
  Herramienta,
  Magnitud,
  MedDim,
  MedForma,
  MedLine,
  OrigenPlano,
  Partida,
  PlanoMeta,
  Punto,
} from './types';

/* ---- la tabla herramienta × forma (§3.1) ------------------------------------ */

export type CeldaMedida =
  | {
      encaja: true;
      magnitud: Magnitud;
      /** Casillas que escribe el plano. */
      slots: MedDim[];
      /** Fijas OBLIGATORIAS: las casillas de la forma que el plano no da. */
      fijas: MedDim[];
      /** Lleva la h de «(tramos)×h» (obligatoria). */
      factor?: true;
    }
  /** La herramienta no encaja: el motivo nombra la que sí y la selecciona. */
  | { encaja: false; usa: Herramienta }
  /** Superficie en una partida L×A: pasa a Superficie directa (§3.2). */
  | { encaja: 'pasa-a-area' };

const recuento = (fijas: MedDim[]): CeldaMedida => ({ encaja: true, magnitud: 'recuento', slots: ['uds'], fijas });
const no = (usa: Herramienta): CeldaMedida => ({ encaja: false, usa });

export const TABLA_MEDIDA: Record<Herramienta, Record<MedForma, CeldaMedida>> = {
  recuento: {
    ud: recuento([]),
    lin: recuento(['largo']),
    sup: recuento(['largo', 'ancho']),
    area: recuento(['largo']),
    vol: recuento(['largo', 'ancho', 'alto']),
    areaEsp: recuento(['largo', 'ancho']),
    peso: recuento(['largo', 'ancho']),
  },
  longitud: {
    ud: no('recuento'),
    lin: { encaja: true, magnitud: 'longitud', slots: ['largo'], fijas: [] },
    sup: { encaja: true, magnitud: 'longitud', slots: ['largo'], fijas: ['ancho'] },
    area: { encaja: true, magnitud: 'longitudPorFactor', slots: ['largo'], fijas: [], factor: true },
    vol: { encaja: true, magnitud: 'longitud', slots: ['largo'], fijas: ['ancho', 'alto'] },
    areaEsp: { encaja: true, magnitud: 'longitudPorFactor', slots: ['largo'], fijas: ['ancho'], factor: true },
    peso: { encaja: true, magnitud: 'longitud', slots: ['largo'], fijas: ['ancho'] },
  },
  superficie: {
    ud: no('recuento'),
    lin: { encaja: true, magnitud: 'perimetro', slots: ['largo'], fijas: [] },
    sup: { encaja: 'pasa-a-area' },
    area: { encaja: true, magnitud: 'area', slots: ['largo'], fijas: [] },
    vol: no('rectangulo'),
    areaEsp: { encaja: true, magnitud: 'area', slots: ['largo'], fijas: ['ancho'] },
    peso: no('longitud'),
  },
  rectangulo: {
    ud: no('recuento'),
    lin: { encaja: true, magnitud: 'perimetro', slots: ['largo'], fijas: [] },
    sup: { encaja: true, magnitud: 'lados', slots: ['largo', 'ancho'], fijas: [] },
    area: { encaja: true, magnitud: 'area', slots: ['largo'], fijas: [] },
    vol: { encaja: true, magnitud: 'lados', slots: ['largo', 'ancho'], fijas: ['alto'] },
    areaEsp: { encaja: true, magnitud: 'area', slots: ['largo'], fijas: ['ancho'] },
    peso: no('longitud'),
  },
};

export const NOMBRE_HERRAMIENTA: Record<Herramienta, string> = {
  longitud: 'Longitud',
  superficie: 'Superficie',
  rectangulo: 'Rectángulo',
  recuento: 'Recuento',
};

/** Celda efectiva: con Superficie en L×A, la de Superficie directa. */
export function celdaDe(herramienta: Herramienta, forma: MedForma): CeldaMedida {
  const c = TABLA_MEDIDA[herramienta][forma];
  return c.encaja === 'pasa-a-area' ? TABLA_MEDIDA[herramienta].area : c;
}

/** Rótulo de una fija («Anchura», «kg/m», «Anchura (altura del paramento)»). */
export function rotuloFija(forma: MedForma, slot: MedDim, magnitud: Magnitud): string {
  const label = medFormaDef(forma).cols[MED_SLOTS.indexOf(slot)] ?? slot;
  if (forma === 'sup' && slot === 'ancho' && (magnitud === 'longitud' || magnitud === 'perimetro'))
    return 'Anchura (altura del paramento)';
  return label;
}
export const ROTULO_FACTOR = 'Altura (multiplica)';

/* ---- valores desde la geometría (§3.4) ---------------------------------------- */

/** Lo que el plano escribe en las casillas de `origen.slots` y su `expr`. La
 *  MISMA función para crear, recalcular [A1], copiar [A1] y editar vértices [B].
 *  `signo` solo cuenta en Recuento (uds = ±N). */
export function valoresDesdeOrigen(
  o: Pick<OrigenPlano, 'herramienta' | 'magnitud' | 'puntos' | 'slots' | 'factor'>,
  opts: { mPorUnidad: number; signo?: 1 | -1 },
): { valores: Partial<Record<MedDim, number>>; expr: Partial<Record<MedDim, string>> } {
  const m = opts.mPorUnidad;
  const cerrado = o.herramienta !== 'longitud';
  const suma = (t: number[]) => t.map(cifra).join('+');
  const valores: Partial<Record<MedDim, number>> = {};
  const expr: Partial<Record<MedDim, string>> = {};
  const conExpr = (slot: MedDim, e: string) => {
    expr[slot] = e;
    valores[slot] = evalEsExpr(e) ?? NaN;
  };
  switch (o.magnitud) {
    case 'recuento':
      valores.uds = (opts.signo ?? 1) * o.puntos.length;
      break;
    case 'longitud':
    case 'perimetro':
      conExpr('largo', suma(tramosMetros(o.puntos, m, cerrado)));
      break;
    case 'longitudPorFactor': {
      const t = tramosMetros(o.puntos, m, cerrado);
      const h = cifra(round2(o.factor ?? NaN));
      conExpr('largo', `${t.length > 1 ? `(${suma(t)})` : suma(t)}×${h}`);
      break;
    }
    case 'lados': {
      const { largo, ancho } = ladosRectangulo(o.puntos, m);
      valores.largo = largo;
      valores.ancho = ancho;
      break;
    }
    case 'area':
      if (o.herramienta === 'rectangulo') {
        const { largo, ancho } = ladosRectangulo(o.puntos, m);
        conExpr('largo', `${cifra(largo)}×${cifra(ancho)}`);
      } else valores.largo = areaMetros(o.puntos, m);
      break;
  }
  // Solo las casillas de `slots` (una fuera de ellas nunca la escribe el plano).
  for (const k of Object.keys(valores) as MedDim[]) if (!o.slots.includes(k)) delete valores[k];
  for (const k of Object.keys(expr) as MedDim[]) if (!o.slots.includes(k)) delete expr[k];
  return { valores, expr };
}

/* ---- líneas medidas --------------------------------------------------------- */

/** ¿La línea tiene alguna casilla de `slots` distinta de lo que escribió el plano? */
export function lineaRetocada(l: MedLine): boolean {
  const o = l.origen;
  if (!origenLegible(o)) return false;
  return o.slots.some((s) => l[s] !== o.valores[s]);
}

/** Restar se lee del signo de `uds`. */
export const esResta = (l: Pick<MedLine, 'uds'>): boolean => typeof l.uds === 'number' && l.uds < 0;

/** Prefijo fijo del comentario: «P1 · » o «Pág. 3 · » sin etiqueta. La revisión
 *  NO entra (no ensucia los exportes). */
export function prefijoComentario(plano: PlanoMeta, pagina: number): string {
  return `${etiquetaDe(plano, pagina) ?? `Pág. ${pagina}`} · `;
}

/** Línea nueva de un plano, antes de que el store le dé id. */
export type NewPlanoLine = Omit<MedLine, 'id'> & { origen: OrigenPlano };

/** Valor tecleado en un campo de dimensión fija (ya leído con `leerCelda`). */
export interface ValorFijo {
  value: number;
  expr?: string;
}

/** Motivo por el que no se puede medir (o crear la línea). Los textos, en
 *  `features/planos/motivos` (§7.2). */
export type MotivoMedida =
  | { motivo: 'sin-calibrar' }
  | { motivo: 'no-encaja'; forma: MedForma; usa: Herramienta }
  | { motivo: 'superficie-en-sup' }
  | { motivo: 'falta-dimension'; slot: MedDim | 'factor'; rotulo: string }
  | { motivo: 'kgm-sin-resolver' }
  | { motivo: 'perfiles-en-conflicto'; comentario: string; campo: string }
  | { motivo: 'forma-invalida'; cual: FormaInvalida }
  | { motivo: 'forma-cruzada' }
  | { motivo: 'demasiados-puntos' };

export interface EntradaMedida {
  herramienta: Herramienta;
  /** En coordenadas de página (se redondean a 0,01 aquí). */
  puntos: Punto[];
  plano: Pick<PlanoMeta, 'id' | 'huella'>;
  pagina: number;
  /** Escala activa de la página, o `null` (sin calibrar). */
  escala: Escala | null;
  partida: Pick<Partida, 'medForma' | 'ud' | 'med' | 'cantidad' | 'precio'>;
  /** Dimensiones fijas de la franja, por casilla. */
  fijas: Partial<Record<MedDim, ValorFijo>>;
  /** La h de «(tramos)×h». */
  factor?: number;
  restar: boolean;
  /** Comentario completo (prefijo + lo tecleado). */
  comentario: string;
  /** Superficie en una partida L×A CON líneas: el usuario aceptó medirla por
   *  Superficie directa (§3.2). Sin líneas el cambio es automático. */
  aceptaSupDirecta?: boolean;
  formaId: string;
  at: string;
  coefK?: number;
}

export interface MedidaPreparada {
  ok: true;
  lineas: NewPlanoLine[];
  /** La partida pasa a medirse por Superficie directa con esta medida (§3.2). */
  cambioForma?: 'area';
  resumen: {
    parcial: number;
    antes: ResumenCantidad;
    despues: ResumenCantidad;
  };
}

export type ResultadoMedida = MedidaPreparada | ({ ok: false } & MotivoMedida);

/** Estado de una herramienta antes de dibujar (barra de herramientas): el
 *  motivo si no se puede medir con ella en esta partida y esta página. */
export function motivoHerramienta(
  herramienta: Herramienta,
  ctx: {
    partida: Pick<Partida, 'medForma' | 'ud' | 'med'>;
    escala: Escala | null;
    fijas: Partial<Record<MedDim, ValorFijo>>;
    factor?: number;
    aceptaSupDirecta?: boolean | null;
  },
): MotivoMedida | null {
  if (herramienta !== 'recuento' && !ctx.escala) return { motivo: 'sin-calibrar' };
  const forma = medFormaDe(ctx.partida);
  const raw = TABLA_MEDIDA[herramienta][forma];
  if (raw.encaja === false) return { motivo: 'no-encaja', forma, usa: raw.usa };
  if (raw.encaja === 'pasa-a-area' && ctx.partida.med.length > 0) {
    if (ctx.aceptaSupDirecta === false) return { motivo: 'no-encaja', forma, usa: 'rectangulo' };
    if (ctx.aceptaSupDirecta !== true) return { motivo: 'superficie-en-sup' };
  }
  const celda = celdaDe(herramienta, forma) as Extract<CeldaMedida, { encaja: true }>;
  const formaFinal = raw.encaja === 'pasa-a-area' ? 'area' : forma;
  for (const s of celda.fijas) {
    if (formaFinal === 'peso' && s === 'ancho') continue; // kg/m: el comentario puede darlo
    if (!fijaValida(ctx.fijas[s])) return { motivo: 'falta-dimension', slot: s, rotulo: rotuloFija(formaFinal, s, celda.magnitud) };
  }
  if (celda.factor && !(Number.isFinite(ctx.factor) && (ctx.factor as number) > 0))
    return { motivo: 'falta-dimension', slot: 'factor', rotulo: ROTULO_FACTOR };
  return null;
}

const fijaValida = (v: ValorFijo | undefined): v is ValorFijo => !!v && Number.isFinite(v.value) && v.value > 0;

/**
 * Prepara una medida: líneas finales, cambio de forma y resumen, o el motivo
 * por el que no se puede. La usan la vista previa (NOMBRANDO), la confirmación
 * y la acción del store, que vuelve a preparar contra el estado vivo con esta
 * MISMA función (§4.2).
 */
export function prepararMedida(e: EntradaMedida): ResultadoMedida {
  const puntos = e.puntos.map(redondearPunto);
  if (puntos.length > TOPES.puntosPorOrigen) return { ok: false, motivo: 'demasiados-puntos' };
  const previo = motivoHerramienta(e.herramienta, {
    partida: e.partida,
    escala: e.escala,
    fijas: e.fijas,
    factor: e.factor,
    aceptaSupDirecta: e.aceptaSupDirecta ?? null,
  });
  if (previo) return { ok: false, ...previo };
  const invalida = formaInvalida(e.herramienta, puntos);
  if (invalida) return { ok: false, motivo: 'forma-invalida', cual: invalida };
  if (e.herramienta === 'superficie' && cruzaLaForma(puntos, null, true)) return { ok: false, motivo: 'forma-cruzada' };

  const formaPartida = medFormaDe(e.partida);
  const cambioForma = TABLA_MEDIDA[e.herramienta][formaPartida].encaja === 'pasa-a-area' ? ('area' as const) : undefined;
  const forma: MedForma = cambioForma ?? formaPartida;
  const celda = celdaDe(e.herramienta, forma) as Extract<CeldaMedida, { encaja: true }>;

  // Dimensiones fijas (y el kg/m de Peso, que puede salir del comentario).
  const fijas: Partial<Record<MedDim, ValorFijo>> = {};
  for (const s of celda.fijas) {
    if (forma === 'peso' && s === 'ancho') {
      const kgm = resolverKgm(e.fijas.ancho, e.comentario);
      if ('motivo' in kgm) return { ok: false, ...kgm };
      fijas.ancho = kgm;
      continue;
    }
    const v = e.fijas[s];
    if (!fijaValida(v)) return { ok: false, motivo: 'falta-dimension', slot: s, rotulo: rotuloFija(forma, s, celda.magnitud) };
    fijas[s] = { value: v.value, ...(v.expr ? { expr: v.expr } : {}) };
  }

  const signo: 1 | -1 = e.restar ? -1 : 1;
  const conEscala = e.herramienta !== 'recuento';
  const factor = celda.factor ? round2(e.factor as number) : undefined;
  const base = {
    planoId: e.plano.id,
    huella: e.plano.huella,
    pagina: e.pagina,
    formaId: e.formaId,
    magnitud: celda.magnitud,
    slots: [...celda.slots],
    valores: {} as Partial<Record<MedDim, number>>,
    ...(Object.keys(fijas).length
      ? { fijas: Object.fromEntries(Object.entries(fijas).map(([k, v]) => [k, v!.value])) as Partial<Record<MedDim, number>> }
      : {}),
    ...(factor !== undefined ? { factor } : {}),
    at: e.at,
  };
  const origen: OrigenPlano = conEscala
    ? ({
        ...base,
        herramienta: e.herramienta as 'longitud' | 'superficie',
        puntos,
        calRev: e.escala!.rev,
        mPorUnidad: e.escala!.mPorUnidad,
        n: e.escala!.n,
        ...(e.escala!.ajustada ? { escalaAjustada: true } : {}),
      } as OrigenPlano)
    : { ...base, herramienta: 'recuento', puntos, mPorUnidad: 1 };
  const { valores, expr } = valoresDesdeOrigen(origen, { mPorUnidad: origen.mPorUnidad, signo });
  if (Object.values(valores).some((v) => !Number.isFinite(v))) return { ok: false, motivo: 'forma-invalida', cual: 'longitud-cero' };
  origen.valores = valores;

  const linea: NewPlanoLine = {
    comment: e.comentario,
    uds: conEscala ? signo : (valores.uds as number),
    largo: '',
    ancho: '',
    alto: '',
    origen,
  };
  const exprs: Partial<Record<MedDim, string>> = { ...expr };
  for (const s of celda.slots) if (s !== 'uds') linea[s] = valores[s] as number;
  for (const [s, v] of Object.entries(fijas) as [MedDim, ValorFijo][]) {
    linea[s] = v.value;
    if (v.expr) exprs[s] = v.expr;
  }
  if (Object.keys(exprs).length) linea.expr = exprs;

  const antes = resumenCantidad(e.partida as Partida, e.coefK ?? 1);
  const despues = resumenCantidad({ ...(e.partida as Partida), med: [...e.partida.med, { ...linea, id: '' }] }, e.coefK ?? 1);
  return {
    ok: true,
    lineas: [linea],
    ...(cambioForma ? { cambioForma } : {}),
    resumen: { parcial: lineParcial(linea), antes, despues },
  };
}

/** kg/m de Peso: el campo fijo (número o perfil) o el perfil del comentario. */
function resolverKgm(campo: ValorFijo | undefined, comentario: string): ValorFijo | MotivoMedida {
  const delComentario = perfilEnTexto(comentario);
  const perfilCampo = campo?.expr ? nombrePerfil(campo.expr) : null;
  if (campo && fijaValida(campo)) {
    if (perfilCampo && delComentario && perfilCampo !== delComentario.nombre)
      return { motivo: 'perfiles-en-conflicto', comentario: delComentario.nombre, campo: perfilCampo };
    // Numérico: sin `expr`, así `pesoDesdeComentario` no lo pisa. Perfil: su nombre.
    return perfilCampo ? { value: campo.value, expr: perfilCampo } : { value: campo.value };
  }
  if (delComentario) return { value: delComentario.kgm, expr: delComentario.nombre };
  return { motivo: 'kgm-sin-resolver' };
}

/** Recuenta las líneas de cada página de un plano que llevan escala (las de
 *  Recuento no cuentan para `has-lines`). */
export function lineasConEscala(
  partidas: Record<string, readonly Pick<Partida, 'med'>[]>,
  planoId: string,
  pagina: number,
): number {
  let n = 0;
  for (const ps of Object.values(partidas))
    for (const p of ps)
      for (const l of p.med) {
        const o = l.origen as unknown;
        if (!o || typeof o !== 'object') continue;
        const r = o as { planoId?: unknown; pagina?: unknown; herramienta?: unknown };
        if (r.planoId === planoId && r.pagina === pagina && r.herramienta !== 'recuento') n++;
      }
  return n;
}

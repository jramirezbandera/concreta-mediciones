/* ===========================================================================
   store/slices/planosSlice — acciones de los planos PDF (medir sobre planos).
   Especificación · Etapa A, §4 (docs/plan-medir-planos-pdf.md).

   Todas son iguales por fuera:
   · UN `set` dentro de `structural()` (cortes de historial antes y después):
     UN paso de Deshacer, que se lleva también los planos (`planos` está en
     `DOMAIN_KEYS`);
   · reciben `expect` con lo que el usuario revisó y, si el estado vivo ya no
     cuadra, devuelven `reason: 'stale'` con qué cambió SIN tocar nada; las que
     no tocan líneas comprueban al menos el `docToken`;
   · devuelven `MedResult` (ids afectados o el motivo).

   Las líneas nuevas las prepara `core/planoMedida.prepararMedida` en el visor;
   aquí se comprueba contra el estado vivo con la MISMA regla de valores
   (`valoresDesdeOrigen`) antes de aplicarlas, todo o nada.
   =========================================================================== */
import { medFormaDe } from '../../core/medForma';
import { indiceInsercion, lineaParaDestino, lineasCertificadas } from '../../core/medPaste';
import { DESVIACION_MAX } from '../../core/planoGeom';
import { TOPES, escalaDe, escalaLegible, origenLegible, paginaValida, planoLegible } from '../../core/planoDatos';
import { lineaRetocada, lineasConEscala, valoresDesdeOrigen, type NewPlanoLine } from '../../core/planoMedida';
import { planRecalculo, recalcularLinea } from '../../core/planoRecalculo';
import { escalaConAjuste } from '../../core/planoTexto';
import type { Comprobacion, Escala, MedDim, MedForma, MedLine, Partida, PlanoMeta } from '../../core/types';
import { nextCalRev, nextMedLineId } from '../base';
import type { MedResult, ObraSlice, ObraState } from '../obraStore';
import { structural } from './estructuraSlice';

/** Lo mínimo que comprueba una acción que no toca líneas: la misma obra. */
export interface ExpectDoc {
  docToken: string;
}

/** Lo que el usuario revisó al medir (§4.2). */
export interface ExpectMedida extends ExpectDoc {
  planoId: string;
  huella: string;
  pagina: number;
  /** `rev` de la escala de la página al preparar; `null` en Recuento. */
  calRev: string | null;
}

export interface DestinoPlano {
  chapterId: string;
  partidaId: string;
  lineas: NewPlanoLine[];
  /** La partida pasa a Superficie directa con esta medida (§3.2). */
  medForma?: 'area';
  /** Detrás de qué línea (el punto de inserción del visor); null = al final. */
  afterId?: string | null;
  /** Forma de medir y unidad de la partida al preparar. */
  expectForma: MedForma;
  expectUd: string;
}

export interface ExpectRemedir extends ExpectMedida {
  /** Forma y unidad de la partida de la línea al preparar. */
  expectForma: MedForma;
  expectUd: string;
  /** Casillas y comentario de la línea al preparar: si cambiaron, `stale`. */
  valores: Pick<MedLine, 'comment' | 'uds' | 'largo' | 'ancho' | 'alto'>;
  /** El usuario confirmó sustituir una línea certificada (guarda de certificadas). */
  certificadaOk?: boolean;
}

/** Una línea tal como el usuario la vio (sus casillas). */
export interface ExpectLinea extends ExpectDoc {
  valores: Pick<MedLine, 'uds' | 'largo' | 'ancho' | 'alto'>;
}

/** Lo que el usuario revisó en la pregunta de recalcular (§4.2, §4.4). */
export interface ExpectRecalculo extends ExpectDoc {
  huella: string;
  /** `rev` de la escala activa de la página al preguntar (null: sin calibrar). */
  calRev: string | null;
  /** Casillas de cada candidata al preguntar: si alguna cambió, `stale`. */
  valores: Record<string, Pick<MedLine, 'uds' | 'largo' | 'ancho' | 'alto'>>;
}

type PlanosSlice = Pick<
  ObraState,
  | 'attachPlano'
  | 'removePlano'
  | 'renamePlano'
  | 'setPlanoPageLabel'
  | 'setPlanoPageScale'
  | 'addPlanoLines'
  | 'remeasureLine'
  | 'rescalePlanoPage'
  | 'setPlanoPageCheck'
  | 'setPlanoScaleAdjusted'
  | 'copyPlanoPageScale'
  | 'acceptLineValues'
  | 'unlinkLineOrigen'
>;

const stale = (cambio: NonNullable<MedResult['detalle']>['cambio'], extra: Partial<NonNullable<MedResult['detalle']>> = {}): MedResult => ({
  ids: [],
  reason: 'stale',
  detalle: { cambio, ...extra },
});

/** Plano legible por id (los opacos no se tocan). */
function planoDe(s: Pick<ObraState, 'planos'>, id: string): PlanoMeta | undefined {
  return s.planos.find((p) => planoLegible(p) && p.id === id);
}

function partidaDe(s: Pick<ObraState, 'partidas'>, chapterId: string, partidaId: string): Partida | undefined {
  const hit = s.partidas[chapterId]?.find((p) => p.id === partidaId);
  if (hit) return hit;
  for (const list of Object.values(s.partidas)) {
    const p = list.find((x) => x.id === partidaId);
    if (p) return p;
  }
  return undefined;
}

function lineaPorId(s: Pick<ObraState, 'partidas'>, lineId: string): { partida: Partida; index: number } | null {
  for (const list of Object.values(s.partidas))
    for (const partida of list) {
      const index = partida.med.findIndex((l) => l.id === lineId);
      if (index >= 0) return { partida, index };
    }
  return null;
}

const mismasCasillas = (l: MedLine, v: Pick<MedLine, 'uds' | 'largo' | 'ancho' | 'alto'>) =>
  l.uds === v.uds && l.largo === v.largo && l.ancho === v.ancho && l.alto === v.alto;

const iguales = (a: Partial<Record<MedDim, number>>, b: Partial<Record<MedDim, number>>) => {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k as MedDim] === b[k as MedDim]);
};

/** Comprueba una medida preparada contra el estado vivo: plano, huella, escala
 *  y valores (con la misma función pura que la preparó). */
function comprobarMedida(s: ObraState, expect: ExpectMedida, lineas: readonly NewPlanoLine[]): MedResult | null {
  if (expect.docToken !== s.docToken) return stale('obra');
  const plano = planoDe(s, expect.planoId);
  if (!plano) return { ids: [], reason: 'no-plano' };
  if (plano.huella !== expect.huella) return stale('plano');
  const escala = escalaDe(plano, expect.pagina);
  const conEscala = lineas.some((l) => l.origen.herramienta !== 'recuento');
  if (conEscala) {
    if (!escala) return { ids: [], reason: 'sin-calibrar' };
    if (escala.rev !== expect.calRev) return stale('escala');
    if (!escala.comprobacion) return { ids: [], reason: 'sin-comprobar' };
  }
  for (const l of lineas) {
    if (!origenLegible(l.origen) || l.origen.planoId !== plano.id || l.origen.pagina !== expect.pagina)
      return stale('plano');
    if (l.origen.puntos.length > TOPES.puntosPorOrigen) return stale('plano');
    const signo = (typeof l.uds === 'number' && l.uds < 0 ? -1 : 1) as 1 | -1;
    const m = l.origen.herramienta === 'recuento' ? 1 : escala!.mPorUnidad;
    if (!iguales(valoresDesdeOrigen(l.origen, { mPorUnidad: m, signo }).valores, l.origen.valores))
      return stale('escala');
  }
  return null;
}

export const createPlanosSlice: ObraSlice<PlanosSlice> = (set, get) => ({
  attachPlano: ({ meta, expect, nuevo }) => {
    const s0 = get();
    if (expect.docToken !== s0.docToken) return stale('obra');
    if (!planoLegible(meta) || meta.paginas > TOPES.paginasPorPlano) return { ids: [], reason: 'noop' };
    // Volver a adjuntar el mismo PDF revive un plano quitado con sus escalas y líneas.
    const quitado = nuevo
      ? undefined
      : s0.planos.find((p): p is PlanoMeta => planoLegible(p) && !!p.quitado && p.huella === meta.huella);
    if (!quitado && s0.planos.filter((p) => planoLegible(p) && !p.quitado).length >= TOPES.planos)
      return { ids: [], reason: 'noop' };
    const id = quitado?.id ?? meta.id;
    structural(() =>
      set((s) => {
        if (quitado) {
          const p = s.planos.find((x) => planoLegible(x) && x.id === quitado.id);
          if (p) delete p.quitado;
        } else s.planos.push(JSON.parse(JSON.stringify(meta)) as PlanoMeta);
      }),
    );
    return { ids: [id] };
  },

  removePlano: ({ planoId, expect }) => {
    const s0 = get();
    if (expect.docToken !== s0.docToken) return stale('obra');
    const p0 = planoDe(s0, planoId);
    if (!p0) return { ids: [], reason: 'no-plano' };
    if (p0.quitado) return { ids: [], reason: 'noop' };
    const at = new Date().toISOString();
    structural(() =>
      set((s) => {
        const p = planoDe(s, planoId);
        if (p) p.quitado = at; // el blob no se borra: Deshacer lo recupera entero
      }),
    );
    return { ids: [planoId] };
  },

  renamePlano: ({ planoId, nombre, expect }) => {
    const s0 = get();
    if (expect.docToken !== s0.docToken) return stale('obra');
    const p0 = planoDe(s0, planoId);
    if (!p0) return { ids: [], reason: 'no-plano' };
    const n = nombre.trim();
    if (!n || n === p0.nombre) return { ids: [], reason: 'noop' };
    structural(() =>
      set((s) => {
        const p = planoDe(s, planoId);
        if (p) p.nombre = n;
      }),
    );
    return { ids: [planoId] };
  },

  setPlanoPageLabel: ({ planoId, pagina, etiqueta, expect }) => {
    const s0 = get();
    if (expect.docToken !== s0.docToken) return stale('obra');
    const p0 = planoDe(s0, planoId);
    if (!p0) return { ids: [], reason: 'no-plano' };
    if (!paginaValida(pagina, p0.paginas)) return { ids: [], reason: 'noop' };
    const e = etiqueta.trim();
    const actual = (p0.etiquetas as Record<string, unknown> | undefined)?.[String(pagina)];
    if ((actual ?? '') === e) return { ids: [], reason: 'noop' };
    structural(() =>
      set((s) => {
        const p = planoDe(s, planoId);
        if (!p) return;
        if (e) (p.etiquetas ??= {})[pagina] = e;
        else if (p.etiquetas) {
          delete p.etiquetas[pagina];
          if (Object.keys(p.etiquetas).length === 0) delete p.etiquetas;
        }
      }),
    );
    return { ids: [planoId] };
  },

  setPlanoPageScale: ({ planoId, pagina, escala, expect }) => {
    const s0 = get();
    if (expect.docToken !== s0.docToken) return stale('obra');
    const p0 = planoDe(s0, planoId);
    if (!p0) return { ids: [], reason: 'no-plano' };
    if (!paginaValida(pagina, p0.paginas) || !escalaLegible(escala)) return { ids: [], reason: 'noop' };
    // Una calibración activa por página: con líneas medidas (las de Recuento no
    // cuentan) recalcular llega en A1; aquí la escala no cambia.
    const n = lineasConEscala(s0.partidas, planoId, pagina);
    if (n > 0) return { ids: [], reason: 'has-lines', detalle: { n } };
    const copia = JSON.parse(JSON.stringify(escala)) as Escala;
    structural(() =>
      set((s) => {
        const p = planoDe(s, planoId);
        if (p) p.escalas[pagina] = copia;
      }),
    );
    return { ids: [planoId] };
  },

  addPlanoLines: ({ destinos, expect }) => {
    const s0 = get();
    if (!destinos.length || destinos.some((d) => !d.lineas.length)) return { ids: [], reason: 'no-lines' };
    const fallo = comprobarMedida(s0, expect, destinos.flatMap((d) => d.lineas));
    if (fallo) return fallo;
    // Todo o nada: cada destino se valida antes de tocar nada.
    for (const d of destinos) {
      const p = partidaDe(s0, d.chapterId, d.partidaId);
      if (!p) return { ids: [], reason: 'no-partida', detalle: { partidaId: d.partidaId } };
      if (medFormaDe(p) !== d.expectForma || p.ud !== d.expectUd)
        return stale('forma', { partidaId: d.partidaId });
    }
    const altas = destinos.map((d) => {
      const forma = d.medForma ?? d.expectForma;
      return {
        d,
        nuevas: d.lineas.map((l) => ({ ...lineaParaDestino({ ...l, id: '' }, forma), id: nextMedLineId() })),
      };
    });
    structural(() =>
      set((s) => {
        for (const { d, nuevas } of altas) {
          const p = partidaDe(s, d.chapterId, d.partidaId);
          if (!p) continue;
          if (d.medForma) p.medForma = d.medForma; // mismo paso de Deshacer que la medida
          p.med.splice(indiceInsercion(p.med, d.afterId ?? null), 0, ...nuevas);
          p.fromBase = false;
        }
      }),
    );
    return { ids: altas.flatMap((a) => a.nuevas.map((l) => l.id)) };
  },

  remeasureLine: ({ lineId, preparada, expect }) => {
    const s0 = get();
    const hit = lineaPorId(s0, lineId);
    if (!hit) return { ids: [], reason: 'no-lines' };
    const fallo = comprobarMedida(s0, expect, [preparada]);
    if (fallo) return fallo;
    const { partida } = hit;
    if (medFormaDe(partida) !== expect.expectForma || partida.ud !== expect.expectUd)
      return stale('forma', { partidaId: partida.id });
    const l0 = partida.med[hit.index]!;
    const v = expect.valores;
    if (l0.comment !== v.comment || l0.uds !== v.uds || l0.largo !== v.largo || l0.ancho !== v.ancho || l0.alto !== v.alto)
      return stale('linea', { linea: hit.index + 1 });
    const cert = lineasCertificadas(s0.certs, partida.id, [lineId]);
    if (cert.lineIds.length && !expect.certificadaOk)
      return { ids: [], reason: 'certificada', detalle: { linea: hit.index + 1, certNums: cert.certNums } };
    const forma = medFormaDe(partida);
    const nueva = lineaParaDestino({ ...preparada, id: lineId }, forma);
    // Fuera de Recuento, `uds` no sale del plano: se conserva (un 2 tecleado, el signo).
    if (preparada.origen.herramienta !== 'recuento') nueva.uds = l0.uds;
    structural(() =>
      set((s) => {
        const h = lineaPorId(s, lineId);
        if (!h) return;
        h.partida.med[h.index] = nueva;
        h.partida.fromBase = false;
      }),
    );
    return { ids: [lineId] };
  },

  rescalePlanoPage: ({ planoId, pagina, escala, lineIds, expect }) => {
    const s0 = get();
    if (expect.docToken !== s0.docToken) return stale('obra');
    const p0 = planoDe(s0, planoId);
    if (!p0) return { ids: [], reason: 'no-plano' };
    if (p0.huella !== expect.huella) return stale('plano');
    if (!paginaValida(pagina, p0.paginas) || !escalaLegible(escala)) return { ids: [], reason: 'noop' };
    if ((escalaDe(p0, pagina)?.rev ?? null) !== expect.calRev) return stale('escala');
    // Se vuelve a planificar contra el estado vivo con la MISMA función: solo
    // se aplica si las candidatas y sus casillas son las que el usuario vio.
    const plan = planRecalculo(s0, planoId, pagina, escala);
    const ids = plan.candidatas.map((c) => c.lineId);
    if (ids.length !== lineIds.length || ids.some((id) => !lineIds.includes(id))) return stale('lineas');
    const nuevas = new Map<string, MedLine>();
    for (const c of plan.candidatas) {
      const h = lineaPorId(s0, c.lineId)!;
      const l = h.partida.med[h.index]!;
      const v = expect.valores[c.lineId];
      if (!v || v.uds !== l.uds || v.largo !== l.largo || v.ancho !== l.ancho || v.alto !== l.alto)
        return stale('linea', { linea: c.numero, partidaId: c.partidaId });
      nuevas.set(c.lineId, recalcularLinea(l, escala));
    }
    const copia = JSON.parse(JSON.stringify(escala)) as Escala;
    structural(() =>
      set((s) => {
        const p = planoDe(s, planoId);
        if (!p) return;
        p.escalas[pagina] = copia;
        for (const [id, l] of nuevas) {
          const h = lineaPorId(s, id);
          if (!h) continue;
          h.partida.med[h.index] = l;
          h.partida.fromBase = false;
        }
      }),
    );
    return { ids: [planoId, ...ids] };
  },

  acceptLineValues: ({ lineId, expect }) => {
    const s0 = get();
    if (expect.docToken !== s0.docToken) return stale('obra');
    const hit = lineaPorId(s0, lineId);
    if (!hit) return { ids: [], reason: 'no-lines' };
    const l0 = hit.partida.med[hit.index]!;
    if (!mismasCasillas(l0, expect.valores)) return stale('linea', { linea: hit.index + 1 });
    const o = l0.origen;
    if (!origenLegible(o) || o.aceptada || !lineaRetocada(l0)) return { ids: [], reason: 'noop' };
    structural(() =>
      set((s) => {
        const h = lineaPorId(s, lineId);
        const og = h?.partida.med[h.index]?.origen;
        if (og && origenLegible(og)) og.aceptada = true; // `valores` sigue siendo lo que dio la geometría
      }),
    );
    return { ids: [lineId] };
  },

  unlinkLineOrigen: ({ lineId, expect }) => {
    const s0 = get();
    if (expect.docToken !== s0.docToken) return stale('obra');
    const hit = lineaPorId(s0, lineId);
    if (!hit) return { ids: [], reason: 'no-lines' };
    const l0 = hit.partida.med[hit.index]!;
    if (!mismasCasillas(l0, expect.valores)) return stale('linea', { linea: hit.index + 1 });
    if (l0.origen === undefined) return { ids: [], reason: 'noop' };
    structural(() =>
      set((s) => {
        const h = lineaPorId(s, lineId);
        if (!h) return;
        delete h.partida.med[h.index]!.origen; // los números (y su `expr`) se quedan
        h.partida.fromBase = false;
      }),
    );
    return { ids: [lineId] };
  },

  setPlanoScaleAdjusted: ({ planoId, pagina, ajustada, userUnit, expect }) => {
    const s0 = get();
    if (expect.docToken !== s0.docToken) return stale('obra');
    const p0 = planoDe(s0, planoId);
    if (!p0) return { ids: [], reason: 'no-plano' };
    const e = escalaDe(p0, pagina);
    if (!e) return { ids: [], reason: 'sin-calibrar' };
    if (e.rev !== expect.calRev) return stale('escala');
    if (!e.escalaDeclarada || !!e.ajustada === ajustada) return { ids: [], reason: 'noop' };
    const n = lineasConEscala(s0.partidas, planoId, pagina);
    if (n > 0) return { ids: [], reason: 'has-lines', detalle: { n } };
    const nueva = escalaConAjuste(e, ajustada, userUnit, nextCalRev(), new Date().toISOString());
    if (!nueva || !escalaLegible(nueva)) return { ids: [], reason: 'noop' };
    structural(() =>
      set((s) => {
        const p = planoDe(s, planoId);
        if (p) p.escalas[pagina] = nueva;
      }),
    );
    return { ids: [planoId] };
  },

  copyPlanoPageScale: ({ planoId, desde, paginas, expect }) => {
    const s0 = get();
    if (expect.docToken !== s0.docToken) return stale('obra');
    const p0 = planoDe(s0, planoId);
    if (!p0) return { ids: [], reason: 'no-plano' };
    const e = escalaDe(p0, desde);
    if (!e) return { ids: [], reason: 'sin-calibrar' };
    if (e.rev !== expect.calRev) return stale('escala');
    const destino = [...new Set(paginas)].filter((n) => n !== desde && paginaValida(n, p0.paginas));
    if (!destino.length) return { ids: [], reason: 'noop' };
    // Solo a páginas sin escala: una página calibrada entretanto no se pisa.
    if (destino.some((n) => escalaDe(p0, n))) return stale('escala');
    const at = new Date().toISOString();
    const copias = destino.map((n) => {
      const c = JSON.parse(JSON.stringify(e)) as Escala;
      c.rev = nextCalRev();
      c.at = at;
      delete c.comprobacion; // «sin comprobar»: cada página pide la suya
      return [n, c] as const;
    });
    structural(() =>
      set((s) => {
        const p = planoDe(s, planoId);
        if (!p) return;
        for (const [n, c] of copias) p.escalas[n] = c;
      }),
    );
    return { ids: [planoId] };
  },

  setPlanoPageCheck: ({ planoId, pagina, comprobacion, expect }) => {
    const s0 = get();
    if (expect.docToken !== s0.docToken) return stale('obra');
    const p0 = planoDe(s0, planoId);
    if (!p0) return { ids: [], reason: 'no-plano' };
    const e = escalaDe(p0, pagina);
    if (!e) return { ids: [], reason: 'sin-calibrar' };
    if (e.rev !== expect.calRev) return stale('escala');
    if (e.comprobacion) return { ids: [], reason: 'noop' };
    if (!(comprobacion.desviacion >= 0 && comprobacion.desviacion <= DESVIACION_MAX)) return { ids: [], reason: 'noop' };
    const copia = JSON.parse(JSON.stringify(comprobacion)) as Comprobacion;
    structural(() =>
      set((s) => {
        const p = planoDe(s, planoId);
        const esc = p?.escalas[pagina];
        if (esc) esc.comprobacion = copia; // misma escala y misma `rev`
      }),
    );
    return { ids: [planoId] };
  },
});

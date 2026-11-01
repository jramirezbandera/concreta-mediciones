/* ===========================================================================
   core/ofertas — ofertas de las constructoras y su comparativo (v10).
   Plan: docs/plan-ofertas.md (O2).

   · Una oferta guarda, por id de partida NUESTRA, el precio unitario que pone
     la constructora (ejecución material, €) y las cantidades que trae
     distintas. Se casa UNA vez, al entrar: cambiar el presupuesto después no la
     recalcula, y una partida nueva sale «sin precio en esta oferta».
   · Casar: por el código con el que viajó la partida en el .bc3 sin precios
     (`bc3CodigosPartidas`, homónimos `.2` incluidos); si no, por título y
     unidad cuando el emparejamiento es único; lo demás, a `sinCasar`.
   · Comparar con NUESTRAS cantidades: importe = round(cantidad × precio
     ofertado). El total con las cantidades de la constructora sale aparte.
   · Puro, sin React ni store. Importes en céntimos.
   =========================================================================== */
import type { ImportedObra } from './bc3import';
import { buildPresupuestoListado, type PresupuestoListado } from './listado';
import { importeCents, round2, sumCents, type Cents } from './money';
import type { Chapter, Ilegible, PartidasMap, SubChapter } from './types';

/** Una partida tal como viene en la oferta (del .bc3 o del Excel). */
export interface OfertaFila {
  code: string;
  title: string;
  ud: string;
  cantidad: number;
  /** Precio unitario ofertado (€). 0 = sin precio. */
  precio: number;
}

export interface Oferta {
  id: string;
  /** Nombre de la constructora (editable). */
  empresa: string;
  /** Cuándo entró (ISO). */
  fecha: string;
  /** Nombre del fichero de donde salió. */
  fichero: string;
  /** Id de partida → precio unitario ofertado (€, ejecución material). */
  precios: Record<string, number>;
  /** Id de partida → cantidad de la oferta, solo si difiere de la nuestra al casar. */
  cantidades: Record<string, number>;
  /** Partidas de la oferta que no son de este presupuesto. */
  sinCasar: OfertaFila[];
}

/** Tolerancia para dar por igual una cantidad (las del .bc3 van a 2 dec). */
const TOL_CANTIDAD = 0.005;

/** Título o unidad comparables: sin acentos, mayúsculas, signos ni espacios
 *  dobles. NFKD además lleva «m²» a «m2», como lo teclea quien no tiene el ². */
export function normalizar(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Lo que hace falta de una partida nuestra para casarla. */
export interface PartidaCasable {
  id: string;
  /** Código con el que viajó en el .bc3 (o el suyo, si no hay mapa). */
  code: string;
  title: string;
  ud: string;
  cantidad: number;
}

export interface Casamiento {
  precios: Record<string, number>;
  cantidades: Record<string, number>;
  sinCasar: OfertaFila[];
  /** Partidas nuestras con precio de la oferta. */
  casadas: number;
  /** Filas de la oferta que casaron pero vienen sin precio. */
  sinPrecio: number;
}

/**
 * Casa las filas de una oferta con las partidas del presupuesto. Las filas y
 * las partidas con el mismo código se emparejan EN ORDEN (un concepto
 * compartido del .bc3 aparece una vez por cada sitio donde se usa).
 */
export function casarOferta(filas: OfertaFila[], nuestras: PartidaCasable[]): Casamiento {
  const precios: Record<string, number> = {};
  const cantidades: Record<string, number> = {};
  let sinPrecio = 0;
  const asignar = (p: PartidaCasable, f: OfertaFila) => {
    if (!(f.precio > 0)) {
      sinPrecio += 1;
      return;
    }
    precios[p.id] = f.precio;
    if (Math.abs(f.cantidad - p.cantidad) > TOL_CANTIDAD) cantidades[p.id] = f.cantidad;
  };

  // 1) Por código, en orden.
  const porCodigo = new Map<string, PartidaCasable[]>();
  for (const p of nuestras) {
    const k = p.code.trim();
    if (k) porCodigo.set(k, [...(porCodigo.get(k) ?? []), p]);
  }
  const libres = new Set(nuestras);
  const restoFilas: OfertaFila[] = [];
  const usadas = new Map<string, number>();
  for (const f of filas) {
    const k = f.code.trim();
    const cand = k ? porCodigo.get(k) : undefined;
    const i = usadas.get(k) ?? 0;
    if (cand && i < cand.length) {
      usadas.set(k, i + 1);
      libres.delete(cand[i]!);
      asignar(cand[i]!, f);
    } else if (cand) {
      // Más apariciones en la oferta que en el presupuesto: el precio es el
      // mismo concepto, la fila de más no aporta partida nuestra.
      continue;
    } else restoFilas.push(f);
  }

  // 2) Por título y unidad, solo si el emparejamiento es único en los dos lados.
  const clave = (x: { title: string; ud: string }) => `${normalizar(x.title)}|${normalizar(x.ud)}`;
  const cuenta = <T extends { title: string; ud: string }>(xs: Iterable<T>) => {
    const m = new Map<string, T[]>();
    for (const x of xs) m.set(clave(x), [...(m.get(clave(x)) ?? []), x]);
    return m;
  };
  const nuestrasPorClave = cuenta(libres);
  const filasPorClave = cuenta(restoFilas);
  const sinCasar: OfertaFila[] = [];
  for (const f of restoFilas) {
    const k = clave(f);
    const ps = nuestrasPorClave.get(k);
    if (normalizar(f.title) && ps?.length === 1 && filasPorClave.get(k)?.length === 1) asignar(ps[0]!, f);
    else sinCasar.push(f);
  }

  return { precios, cantidades, sinCasar, casadas: Object.keys(precios).length, sinPrecio };
}

/** Filas de una oferta que llega en .bc3 (ya pasada por `bc3ToObra`). El
 *  precio es el unitario de ejecución material del fichero: con los costes
 *  indirectos de su `~K` ya dentro, como en cualquier importación. */
export function filasDeObra(data: Pick<ImportedObra, 'chapters' | 'partidas' | 'rates'>): OfertaFila[] {
  const k = data.rates.coefK || 1;
  return buildPresupuestoListado(data.chapters, data.partidas, k).capitulos.flatMap((c) =>
    c.grupos.flatMap((g) =>
      g.rows.map((r) => ({ code: r.code, title: r.title, ud: r.ud, cantidad: r.cantidad, precio: round2(r.precioExacto) })),
    ),
  );
}

/** Partidas del presupuesto listas para casar, con el código con el que
 *  viajaron en el .bc3 sin precios (`bc3CodigosPartidas`). */
export function partidasCasables(
  chapters: Chapter[],
  partidas: PartidasMap,
  codigos: ReadonlyMap<string, string>,
): PartidaCasable[] {
  return buildPresupuestoListado(chapters, partidas).capitulos.flatMap((c) =>
    c.grupos.flatMap((g) =>
      g.rows.map((r) => ({ id: r.id, code: codigos.get(r.id) ?? r.code, title: r.title, ud: r.ud, cantidad: r.cantidad })),
    ),
  );
}

/** Nombre de la constructora a partir del fichero: lo que se ve hasta que se renombra. */
export function empresaDeFichero(fichero: string): string {
  return fichero.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Oferta';
}

/* ---- comparativo ------------------------------------------------------------ */

/** Lo que pone una oferta en una partida. `null` = sin precio en esa oferta. */
export interface CeldaOferta {
  precio: number;
  importe: Cents;
  /** (importe − presupuesto) / presupuesto, en %; `null` si el presupuesto es 0. */
  desviacion: number | null;
  /** La más barata de la fila (puede haber empate). */
  minima: boolean;
  /** Cantidad de la oferta si la trae distinta (no entra en el importe). */
  cantidadOferta?: number;
}

export interface ComparativoFila {
  id: string;
  pos: string;
  code: string;
  title: string;
  ud: string;
  cantidad: number;
  /** Precio del presupuesto, con K. */
  precio: number;
  importe: Cents;
  ofertas: (CeldaOferta | null)[];
}

export interface ComparativoGrupo {
  sub: SubChapter | null;
  depth: number;
  rows: ComparativoFila[];
}

export interface ComparativoCapitulo {
  id: string;
  code: string;
  title: string;
  grupos: ComparativoGrupo[];
  total: Cents;
  /** Total de cada oferta en el capítulo (solo lo que trae precio). */
  totales: Cents[];
}

export interface ResumenOferta {
  id: string;
  empresa: string;
  /** Σ de lo que trae precio, con nuestras cantidades. */
  total: Cents;
  /** (total − PEM) / PEM en %, `null` si el PEM es 0 o faltan precios. */
  desviacion: number | null;
  /** Partidas del presupuesto sin precio en esta oferta. */
  sinPrecio: number;
  /** Partidas en que la oferta trae otra cantidad. */
  cantidadesDistintas: number;
  /** Total con las cantidades de la constructora donde las cambió. */
  totalSusCantidades: Cents;
  /** Partidas de la oferta que no son de este presupuesto. */
  sinCasar: number;
  /** La más barata de las que vienen completas. */
  mejor: boolean;
}

export interface Comparativo {
  capitulos: ComparativoCapitulo[];
  pem: Cents;
  ofertas: ResumenOferta[];
}

const desv = (importe: Cents, base: Cents): number | null => (base > 0 ? ((importe - base) / base) * 100 : null);

/** Cuadro comparativo del presupuesto frente a las ofertas, en ejecución material. */
export function compararOfertas(
  chapters: Chapter[],
  partidas: PartidasMap,
  ofertas: Oferta[],
  coefK = 1,
): Comparativo {
  const pres: PresupuestoListado = buildPresupuestoListado(chapters, partidas, coefK);
  const n = ofertas.length;
  const sinPrecio = new Array<number>(n).fill(0);
  const distintas = new Array<number>(n).fill(0);
  const susCantidades: Cents[][] = ofertas.map(() => []);
  const capitulos = pres.capitulos.map((c): ComparativoCapitulo => {
    const totales: Cents[][] = ofertas.map(() => []);
    const grupos = c.grupos.map(
      (g): ComparativoGrupo => ({
        sub: g.sub,
        depth: g.depth,
        rows: g.rows.map((r): ComparativoFila => {
          const celdas = ofertas.map((o, i): CeldaOferta | null => {
            const precio = o.precios[r.id];
            if (precio == null) {
              sinPrecio[i]! += 1;
              return null;
            }
            const importe = importeCents(r.cantidad, precio);
            totales[i]!.push(importe);
            const cantidadOferta = o.cantidades[r.id];
            if (cantidadOferta != null) distintas[i]! += 1;
            susCantidades[i]!.push(cantidadOferta != null ? importeCents(cantidadOferta, precio) : importe);
            return {
              precio,
              importe,
              desviacion: desv(importe, r.importe),
              minima: false,
              ...(cantidadOferta != null && { cantidadOferta }),
            };
          });
          const conPrecio = celdas.filter((x): x is CeldaOferta => x != null);
          if (conPrecio.length > 1) {
            const min = Math.min(...conPrecio.map((x) => x.importe));
            for (const x of conPrecio) x.minima = x.importe === min;
          }
          return {
            id: r.id,
            pos: r.pos,
            code: r.code,
            title: r.title,
            ud: r.ud,
            cantidad: r.cantidad,
            precio: r.precio,
            importe: r.importe,
            ofertas: celdas,
          };
        }),
      }),
    );
    return { id: c.id, code: c.code, title: c.title, grupos, total: c.total, totales: totales.map(sumCents) };
  });

  const resumen = ofertas.map((o, i): ResumenOferta => {
    const total = sumCents(capitulos.map((c) => c.totales[i]!));
    return {
      id: o.id,
      empresa: o.empresa,
      total,
      desviacion: sinPrecio[i] === 0 ? desv(total, pres.pem) : null,
      sinPrecio: sinPrecio[i]!,
      cantidadesDistintas: distintas[i]!,
      totalSusCantidades: sumCents(susCantidades[i]!),
      sinCasar: o.sinCasar.length,
      mejor: false,
    };
  });
  const completas = resumen.filter((r) => r.sinPrecio === 0);
  if (completas.length > 1) {
    const min = Math.min(...completas.map((r) => r.total));
    for (const r of completas) r.mejor = r.total === min;
  }
  return { capitulos, pem: pres.pem, ofertas: resumen };
}

/* ---- comprobación al cargar (v10) -------------------------------------------- */

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const mapaNumeros = (x: unknown) => isRecord(x) && Object.values(x).every((v) => typeof v === 'number' && Number.isFinite(v));

/** Lo mínimo para que la vista y el comparativo no rompan. */
export function ofertaLegible(x: unknown): x is Oferta {
  return (
    isRecord(x) &&
    typeof x.id === 'string' &&
    typeof x.empresa === 'string' &&
    typeof x.fecha === 'string' &&
    typeof x.fichero === 'string' &&
    mapaNumeros(x.precios) &&
    mapaNumeros(x.cantidades) &&
    Array.isArray(x.sinCasar) &&
    x.sinCasar.every((f) => isRecord(f) && typeof f.title === 'string' && typeof f.precio === 'number')
  );
}

/** Como en los anejos: una oferta mal formada no manda la obra a recuperación;
 *  se aparta a `_ilegible` con su valor crudo y la obra se abre sin ella. */
export function apartarOfertasIlegibles<T extends { ofertas?: unknown; _ilegible?: Ilegible[] }>(d: T): T {
  if (d.ofertas === undefined) return d;
  if (!Array.isArray(d.ofertas)) {
    console.warn('Concreta: las ofertas de la obra no se pueden leer; se apartan.', d.ofertas);
    return { ...d, ofertas: undefined, _ilegible: [...(d._ilegible ?? []), { donde: 'ofertas', valor: d.ofertas }] };
  }
  const fuera: Ilegible[] = [];
  const buenas = d.ofertas.filter((o, i) => {
    if (ofertaLegible(o)) return true;
    fuera.push({ donde: `ofertas/${i}`, valor: o });
    return false;
  });
  if (!fuera.length) return d;
  console.warn(`Concreta: ${fuera.length} ofertas no se pueden leer; se apartan.`, fuera);
  return { ...d, ofertas: buenas, _ilegible: [...(d._ilegible ?? []), ...fuera] };
}

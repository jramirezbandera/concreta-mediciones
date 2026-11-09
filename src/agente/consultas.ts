/* ===========================================================================
   agente/consultas — lo que el agente lee de una obra (MCP `resumen`, `arbol`,
   `partida`, `buscar`).
   ---------------------------------------------------------------------------
   Funciones PURAS sobre el estado del store: los importes salen de los mismos
   selectores que pinta la app (`selectResumen`, `partidaImporte`…), nunca de una
   cuenta propia, así que lo que lee el agente es lo que ve el técnico. Importes
   en euros, porcentajes en %.
   =========================================================================== */
import { buildSearchIndex, searchPartidas } from '../core/buscar';
import { lineParcial, partidaCantidad, partidaImporte } from '../core/medicion';
import { toEur } from '../core/money';
import { findNode, resolveContainerRef, resolvePartidaRef, subtreeIds } from '../core/tree';
import type { Chapter, MedLine, Partida, SubChapter } from '../core/types';
import { selectCounts, selectResumen, type ObraState } from '../store';

const pct = (fraccion: number) => Math.round(fraccion * 10000) / 100;

/* ---- resumen --------------------------------------------------------------- */

export function resumenObra(st: ObraState) {
  const r = selectResumen(st);
  const c = selectCounts(st);
  const o = st.obra;
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
  const sub = (k: string) =>
    typeof o[k] === 'object' && o[k] !== null ? (o[k] as Record<string, unknown>) : {};
  return {
    obra: {
      denominacion: o.denominacion,
      direccion: texto(o.direccion),
      localidad: texto(o.localidad),
      provincia: texto(o.provincia),
      promotor: texto(sub('promotor').nombre),
      constructor: texto(sub('constructor').nombre),
      superficieConstruida: o.superficieConstruida ?? undefined,
      plantasSobreRasante: o.plantasSobreRasante ?? undefined,
      plantasBajoRasante: o.plantasBajoRasante ?? undefined,
    },
    recuento: { capitulos: c.chapters, partidas: c.partidas, lineas: c.lineas },
    porcentajes: {
      gg: pct(st.rates.gg),
      bi: pct(st.rates.bi),
      iva: pct(st.rates.iva),
      ci: pct(st.rates.ci),
    },
    coefK: st.rates.coefK,
    capitulos: r.rows.map((x) => ({
      codigo: x.code,
      titulo: x.title,
      importe: toEur(x.importe),
      pct: x.pct,
    })),
    importes: {
      costesDirectos: toEur(r.cd),
      costesIndirectos: toEur(r.ci),
      pem: toEur(r.pem),
      gastosGenerales: toEur(r.gg),
      beneficioIndustrial: toEur(r.bi),
      pec: toEur(r.pec),
      iva: toEur(r.iva),
      total: toEur(r.total),
    },
    certificaciones: st.certs.map((cert, i) => ({
      num: cert.num,
      periodo: cert.period || undefined,
      emitida: !!cert.emitidaAt,
      enCurso: i === st.curCert,
    })),
  };
}

/* ---- árbol ------------------------------------------------------------------ */

export interface OpcionesArbol {
  /** Solo este capítulo o subcapítulo (código, título o id). */
  capitulo?: string;
  /** Niveles de contenedores bajo la raíz (sin tope por defecto). */
  profundidad?: number;
  /** Incluir las partidas (por defecto, sí). */
  partidas?: boolean;
}

function filaPartida(p: Partida, coefK: number) {
  return {
    pos: p.pos,
    id: p.id,
    codigo: p.code,
    titulo: p.title,
    ud: p.ud,
    cantidad: partidaCantidad(p),
    precio: p.precio,
    importe: toEur(partidaImporte(p, coefK)),
    lineas: p.med.length,
  };
}

interface NodoArbol {
  tipo: 'capitulo' | 'subcapitulo';
  id: string;
  codigo: string;
  titulo: string;
  importe: number;
  partidas?: ReturnType<typeof filaPartida>[];
  hijos?: NodoArbol[];
}

function nodo(
  st: ObraState,
  ch: Chapter,
  n: Chapter | SubChapter,
  nivel: number,
  o: OpcionesArbol,
): NodoArbol {
  const todas = st.partidas[ch.id] ?? [];
  const esCap = n === ch;
  const enSubarbol = esCap
    ? todas
    : todas.filter((p) => p.sub != null && subtreeIds(n as SubChapter).has(p.sub));
  const directas = todas.filter((p) =>
    esCap ? p.sub == null || !findNode([ch], p.sub) : p.sub === n.id,
  );
  const out: NodoArbol = {
    tipo: esCap ? 'capitulo' : 'subcapitulo',
    id: n.id,
    codigo: n.code,
    titulo: n.title,
    importe: toEur(enSubarbol.reduce((s, p) => s + partidaImporte(p, st.rates.coefK), 0)),
  };
  if (o.partidas !== false && directas.length)
    out.partidas = directas.map((p) => filaPartida(p, st.rates.coefK));
  if (n.children?.length && (o.profundidad === undefined || nivel < o.profundidad)) {
    out.hijos = n.children.map((c) => nodo(st, ch, c, nivel + 1, o));
  }
  return out;
}

export type Arbol = { ok: true; capitulos: NodoArbol[] } | { ok: false; mensaje: string };

export function arbolObra(st: ObraState, o: OpcionesArbol = {}): Arbol {
  if (o.capitulo) {
    const hit =
      resolveContainerRef(st.chapters, o.capitulo) ?? findNode(st.chapters, o.capitulo.trim());
    if (!hit) return { ok: false, mensaje: `no encuentro el capítulo «${o.capitulo}»` };
    return { ok: true, capitulos: [nodo(st, hit.chapter, hit.node, 0, o)] };
  }
  return { ok: true, capitulos: st.chapters.map((ch) => nodo(st, ch, ch, 0, o)) };
}

/* ---- una partida -------------------------------------------------------------- */

function filaLinea(l: MedLine, n: number) {
  const dim = (v: number | '') => (v === '' ? null : v);
  return {
    n,
    id: l.id,
    comentario: l.comment,
    uds: dim(l.uds),
    largo: dim(l.largo),
    ancho: dim(l.ancho),
    alto: dim(l.alto),
    ...(l.expr && Object.keys(l.expr).length ? { formulas: l.expr } : {}),
    parcial: lineParcial(l),
    ...(l.origen ? { plano: { planoId: l.origen.planoId, pagina: l.origen.pagina } } : {}),
  };
}

export type DetallePartida =
  | { ok: true; partida: ReturnType<typeof detalle> }
  | { ok: false; mensaje: string };

function detalle(st: ObraState, p: Partida, chapterId: string) {
  const ch = st.chapters.find((c) => c.id === chapterId);
  const cont = p.sub ? findNode(st.chapters, p.sub)?.node : ch;
  return {
    pos: p.pos,
    id: p.id,
    codigo: p.code,
    titulo: p.title,
    ud: p.ud,
    descripcion: p.desc,
    capitulo: cont ? { codigo: cont.code, titulo: cont.title } : undefined,
    precio: p.precio,
    precioManual: !!p.precioManual,
    cantidad: partidaCantidad(p),
    ...(p.med.length === 0 ? { cantidadFija: p.cantidad ?? 0 } : {}),
    importe: toEur(partidaImporte(p, st.rates.coefK)),
    ...(p.baseSource ? { base: p.baseSource } : {}),
    lineas: p.med.map((l, i) => filaLinea(l, i + 1)),
    descompuesto: p.items.map((it) => {
      const rec = st.recursos[it.code];
      const precio = rec?.precio ?? it.precio ?? 0;
      return {
        codigo: it.code,
        tipo: it.type,
        rendimiento: it.cantidad,
        ud: rec?.ud ?? it.ud ?? '',
        descripcion: rec?.desc ?? it.desc ?? '',
        precio,
        importe: Math.round(it.cantidad * precio * 100) / 100,
      };
    }),
    certificada: st.certs
      .filter((c) => (c.data[p.id] ?? 0) > 0)
      .map((c) => ({ cert: c.num, cantidadAOrigen: c.data[p.id]!, emitida: !!c.emitidaAt })),
  };
}

export function partidaObra(st: ObraState, ref: string): DetallePartida {
  const hit = resolvePartidaRef(st.partidas, ref);
  if (!hit)
    return {
      ok: false,
      mensaje: `no encuentro la partida ${ref} (usa su número en el árbol, «1.2.3», o su id)`,
    };
  return { ok: true, partida: detalle(st, hit.partida, hit.chapterId) };
}

/* ---- buscar --------------------------------------------------------------------- */

export function buscarEnObra(st: ObraState, texto: string, tope = 30) {
  const r = searchPartidas(buildSearchIndex(st.chapters, st.partidas), texto, tope);
  return {
    aciertos: r.hits.map((h) => ({
      pos: h.p.pos,
      id: h.p.id,
      codigo: h.p.code,
      titulo: h.p.title,
      ud: h.p.ud,
      ubicacion: h.path.map((x) => `${x.code} ${x.title}`).join(' › '),
    })),
    truncado: r.truncated,
  };
}

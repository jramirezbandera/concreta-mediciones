/* ===========================================================================
   core/planoRecalculo — recalcular las líneas de una página al cambiar su
   escala (§4.4, A1). Puro: lo usan la pregunta del visor («¿La escala anterior
   estaba mal?») y la acción `rescalePlanoPage`, que vuelve a planificar contra
   el estado vivo con ESTA misma función antes de aplicar.

   · Candidatas: las líneas de la página con `calRev` distinta de la nueva, que
     no son de Recuento, ni retocadas, ni aceptadas, ni certificadas.
   · Aparte, sin cambiar (conservan su escala: «escala histórica»): retocadas,
     aceptadas y certificadas, cada una con su motivo.
   · Valores y `expr` salen de `valoresDesdeOrigen`, la regla única; se
     actualizan `origen.valores`, `mPorUnidad`, `calRev` y `n`.
   =========================================================================== */
import { lineasCertificadas } from './medPaste';
import { partidaCantidad } from './medicion';
import { escalaDe, origenLegible, planoLegible } from './planoDatos';
import { esResta, lineaRetocada, valoresDesdeOrigen } from './planoMedida';
import type { Cert, Escala, MedDim, MedLine, OrigenConEscala, OrigenPlano, Partida, PlanoMeta } from './types';

export interface LineaRef {
  chapterId: string;
  partidaId: string;
  lineId: string;
  /** Nº de la línea en su partida. */
  numero: number;
}

export interface ApartePlano extends LineaRef {
  motivo: 'retocada' | 'aceptada' | 'certificada';
  /** Certificaciones en las que está (motivo `certificada`). */
  certNums?: number[];
}

export interface PartidaRecalculo {
  chapterId: string;
  partidaId: string;
  pos: string;
  code: string;
  title: string;
  ud: string;
  lineas: number;
  antes: number;
  despues: number;
  /** Lo certificado a origen si la medición nueva queda por debajo. */
  porDebajoDe?: { certNum: number; cantidad: number };
}

export interface PlanRecalculo {
  candidatas: LineaRef[];
  /** Candidatas agrupadas por su escala antigua («12 líneas a 1:50 · 3 a 1:20»). */
  porEscala: { n: number; lineas: number }[];
  aparte: ApartePlano[];
  porPartida: PartidaRecalculo[];
}

type Medida = OrigenPlano & OrigenConEscala;

/** Origen con escala de una línea de esta página, o null. */
function origenDePagina(l: MedLine, planoId: string, pagina: number): Medida | null {
  const o = l.origen;
  if (!origenLegible(o) || o.planoId !== planoId || o.pagina !== pagina || o.herramienta === 'recuento') return null;
  return o as Medida;
}

/** La línea con sus casillas recalculadas a `escala` (valores, `expr` y origen). */
export function recalcularLinea(l: MedLine, escala: Pick<Escala, 'rev' | 'mPorUnidad' | 'n' | 'ajustada'>): MedLine {
  const o = l.origen as Medida;
  const signo = (esResta(l) ? -1 : 1) as 1 | -1;
  const { valores, expr } = valoresDesdeOrigen(o, { mPorUnidad: escala.mPorUnidad, signo });
  const out: MedLine = JSON.parse(JSON.stringify(l)) as MedLine;
  for (const s of o.slots) {
    if (s === 'uds') continue; // fuera de Recuento, `uds` no sale del plano
    out[s] = valores[s] as number;
    const e = expr[s];
    if (e) (out.expr ??= {})[s] = e;
    else if (out.expr) delete out.expr[s];
  }
  if (out.expr && Object.keys(out.expr).length === 0) delete out.expr;
  const origen = out.origen as Medida;
  origen.valores = valores as Partial<Record<MedDim, number>>;
  origen.mPorUnidad = escala.mPorUnidad;
  origen.calRev = escala.rev;
  origen.n = escala.n;
  if (escala.ajustada) origen.escalaAjustada = true;
  else delete origen.escalaAjustada;
  return out;
}

/** Lo certificado a origen más alto de una partida, con su certificación. */
function certificadoDe(certs: readonly Cert[], partidaId: string): { certNum: number; cantidad: number } | null {
  let mejor: { certNum: number; cantidad: number } | null = null;
  for (const c of certs) {
    const q = c.data?.[partidaId];
    if (typeof q === 'number' && Number.isFinite(q) && q > 0 && (!mejor || q > mejor.cantidad)) mejor = { certNum: c.num, cantidad: q };
  }
  return mejor;
}

/**
 * Qué pasaría al poner `escala` en la página: candidatas, las que quedan
 * aparte y el cambio de cantidad por partida.
 */
export function planRecalculo(
  s: { partidas: Record<string, readonly Partida[]>; certs: readonly Cert[] },
  planoId: string,
  pagina: number,
  escala: Pick<Escala, 'rev' | 'mPorUnidad' | 'n' | 'ajustada'>,
): PlanRecalculo {
  const candidatas: LineaRef[] = [];
  const aparte: ApartePlano[] = [];
  const porN = new Map<number, number>();
  const porPartida: PartidaRecalculo[] = [];
  for (const [chapterId, ps] of Object.entries(s.partidas))
    for (const p of ps) {
      const dePagina = p.med
        .map((l, i) => ({ l, i, o: origenDePagina(l, planoId, pagina) }))
        .filter((x): x is { l: MedLine; i: number; o: Medida } => !!x.o && x.o.calRev !== escala.rev);
      if (!dePagina.length) continue;
      const cert = lineasCertificadas(
        s.certs,
        p.id,
        dePagina.map((x) => x.l.id),
      );
      const certNumsDe = (lineId: string) =>
        s.certs.filter((c) => (c.lineQty?.[p.id]?.[lineId] ?? 0) !== 0).map((c) => c.num);
      const nuevas = new Map<string, MedLine>();
      for (const { l, i, o } of dePagina) {
        const ref = { chapterId, partidaId: p.id, lineId: l.id, numero: i + 1 };
        if (cert.lineIds.includes(l.id)) aparte.push({ ...ref, motivo: 'certificada', certNums: certNumsDe(l.id) });
        else if (o.aceptada) aparte.push({ ...ref, motivo: 'aceptada' });
        else if (lineaRetocada(l)) aparte.push({ ...ref, motivo: 'retocada' });
        else {
          candidatas.push(ref);
          porN.set(o.n, (porN.get(o.n) ?? 0) + 1);
          nuevas.set(l.id, recalcularLinea(l, escala));
        }
      }
      if (!nuevas.size) continue;
      const antes = partidaCantidad(p as Partida);
      const despues = partidaCantidad({ ...(p as Partida), med: p.med.map((l) => nuevas.get(l.id) ?? l) });
      const certificado = certificadoDe(s.certs, p.id);
      porPartida.push({
        chapterId,
        partidaId: p.id,
        pos: p.pos,
        code: p.code,
        title: p.title,
        ud: p.ud,
        lineas: nuevas.size,
        antes,
        despues,
        ...(certificado && despues < certificado.cantidad ? { porDebajoDe: certificado } : {}),
      });
    }
  const porEscala = [...porN.entries()].map(([n, lineas]) => ({ n, lineas })).sort((a, b) => b.lineas - a.lineas || a.n - b.n);
  return { candidatas, porEscala, aparte, porPartida };
}

/** Líneas medidas de un plano cuya escala no es la activa de su página (las
 *  que un recálculo se saltó): «N líneas con otra escala». */
export function lineasConOtraEscala(partidas: Record<string, readonly Pick<Partida, 'med'>[]>, plano: PlanoMeta): number {
  if (!planoLegible(plano)) return 0;
  let n = 0;
  for (const ps of Object.values(partidas))
    for (const p of ps)
      for (const l of p.med) {
        const o = l.origen;
        if (!origenLegible(o) || o.planoId !== plano.id || o.herramienta === 'recuento') continue;
        const e = escalaDe(plano, o.pagina);
        if (e && (o as Medida).calRev !== e.rev) n++;
      }
  return n;
}

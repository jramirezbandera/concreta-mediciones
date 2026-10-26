/* ===========================================================================
   core/pcc/coherencia — ¿dicen lo mismo la valoración del plan y el capítulo
   de control del presupuesto? (§9 del plan, K-PCC.61, A2 y O1a)

   Cada partida del capítulo se casa con su fila de la valoración:

     1. por `pcc.ensayo` (las creadas con «Crear capítulo», o casadas a mano):
        aunque cambie el título;
     2. por el código del banco: el de la copia de precios o el del enlace
        curado, solo con ensayos que estén en la valoración;
     3. por el texto, solo como PROPUESTA que el usuario confirma.

   Nunca por importe: 210 € son a la vez la química del acero y la compresión
   del suelo-cemento. Luego compara cantidad (los precios que pide la fila,
   O4) y precio unitario sin K, y avisa (nunca corrige): ensayo valorado sin
   partida, partida sin ensayo en el plan, cantidad, precio o unidad distintos.
   =========================================================================== */
import { partidaCantidad, partidaImporte } from '../medicion';
import type { Partida, Rates } from '../types';
import { codigosDelEnlace } from './precios';
import { normaliza } from './reglas';
import type { Aviso, FilaValoracion, PartidaCapitulo, PlanCalidadDatos, PropuestaCasar } from './tipos';
import { unidadPcc } from './unidades';

export interface EntradaCoherenciaPcc {
  /** Partidas del capítulo (o subcapítulo) de control enlazado. */
  partidas: Array<{ chapterId: string; p: Partida }>;
  valoracion: readonly FilaValoracion[];
  plan: Pick<PlanCalidadDatos, 'precios'>;
  rates: Pick<Rates, 'coefK'>;
}

export interface ResultadoCoherenciaPcc {
  partidas: PartidaCapitulo[];
  propuestas: PropuestaCasar[];
  /** Céntimos, con K: lo que suman sus partidas en el presupuesto. */
  importe: number;
  /** Céntimos, sin K: a precio de laboratorio, como la valoración. */
  importeSinK: number;
  avisos: Aviso[];
}

const MEDIDAS = new Set(['m3', 'm2', 'm', 'kg', 't']);
const fmt = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 2 });
const eur = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const corta = (s: string) => (s.length > 60 ? `${s.slice(0, 57)}…` : s);

/** Palabras con peso de un texto (sin tildes, de 4 letras o más). */
function palabras(s: string): Set<string> {
  return new Set(normaliza(s).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 4));
}

/** Parte de las palabras del ensayo que están en el texto de la partida. */
function parecido(ensayo: Set<string>, partida: Set<string>): number {
  if (!ensayo.size) return 0;
  let n = 0;
  for (const w of ensayo) if (partida.has(w)) n += 1;
  return n / ensayo.size;
}

export function coherenciaCapitulo(e: EntradaCoherenciaPcc): ResultadoCoherenciaPcc {
  const avisos: Aviso[] = [];
  const filas = new Map(e.valoracion.map((v) => [v.ensayo, v]));

  // Código del banco → ensayo, solo con los que valora el plan.
  const porCodigo = new Map<string, string>();
  for (const v of e.valoracion) {
    const copia = e.plan.precios?.[v.ensayo]?.codigo;
    const codigos = copia ? copia.split(' + ') : codigosDelEnlace(v.ensayo);
    if (codigos.length === 1) porCodigo.set(codigos[0]!.trim().toUpperCase(), v.ensayo);
  }

  const partidas: PartidaCapitulo[] = e.partidas.map(({ chapterId, p }) => {
    let ensayo: string | null = null;
    let como: PartidaCapitulo['como'] = null;
    if (p.pcc?.estado === 'capituloControl' && p.pcc.ensayo) {
      ensayo = p.pcc.ensayo;
      como = 'ensayo';
    } else {
      const porCod = porCodigo.get(p.code.trim().toUpperCase());
      if (porCod) {
        ensayo = porCod;
        como = 'codigo';
      }
    }
    return {
      partidaId: p.id,
      chapterId,
      code: p.code,
      title: p.title,
      ud: p.ud,
      cantidad: partidaCantidad(p),
      precio: p.precio ?? 0,
      importe: partidaImporte(p, e.rates.coefK),
      ensayo,
      como,
    };
  });

  // Por el texto, solo propuestas: el mejor parecido, si no hay empate y pasa del 70 %.
  const casados = new Set(partidas.map((x) => x.ensayo).filter(Boolean));
  const libres = e.valoracion.filter((v) => !casados.has(v.ensayo)).map((v) => ({ v, w: palabras(v.descripcion) }));
  const propuestas: PropuestaCasar[] = [];
  for (const x of partidas) {
    if (x.ensayo) continue;
    const p = e.partidas.find((y) => y.p.id === x.partidaId)!.p;
    const w = palabras(`${p.title} ${p.desc ?? ''}`);
    const puntos = libres.map((l) => ({ l, s: parecido(l.w, w) })).sort((a, b) => b.s - a.s);
    const [mejor, segundo] = puntos;
    if (mejor && mejor.s >= 0.7 && (!segundo || segundo.s < mejor.s))
      propuestas.push({ partidaId: x.partidaId, chapterId: x.chapterId, ensayo: mejor.l.v.ensayo, descripcion: mejor.l.v.descripcion });
  }

  /* ---- avisos ---- */
  for (const x of partidas) {
    if (x.ensayo && filas.has(x.ensayo)) continue;
    const prop = propuestas.find((y) => y.partidaId === x.partidaId);
    avisos.push({
      id: `capitulo:sinEnsayo:${x.partidaId}`,
      partidaId: x.partidaId,
      texto: prop
        ? `La partida ${x.code} «${corta(x.title)}» del capítulo de control parece «${corta(prop.descripcion)}»: confírmalo en la valoración.`
        : x.ensayo
          ? `La partida ${x.code} «${corta(x.title)}» del capítulo de control es de un ensayo que el plan ya no valora.`
          : `La partida ${x.code} «${corta(x.title)}» del capítulo de control no corresponde a ningún ensayo del plan.`,
    });
  }
  for (const v of e.valoracion) {
    const ps = partidas.filter((x) => x.ensayo === v.ensayo);
    if (!ps.length) {
      avisos.push({ id: `capitulo:sinPartida:${v.ensayo}`, texto: `«${corta(v.descripcion)}»: el plan lo valora (${fmt(v.precios)} ${v.unidad}) y el capítulo de control no tiene partida.` });
      continue;
    }
    const cantidad = ps.reduce((s, x) => s + x.cantidad, 0);
    if (Math.abs(cantidad - v.precios) > 1e-6)
      avisos.push({ id: `capitulo:cantidad:${v.ensayo}`, texto: `«${corta(v.descripcion)}»: el plan pide ${fmt(v.precios)} ${v.unidad} y el capítulo de control tiene ${fmt(cantidad)}.` });
    if (v.precio.valor != null) {
      const distinto = ps.find((x) => Math.abs(x.precio - v.precio.valor!) > 0.005);
      if (distinto)
        avisos.push({ id: `capitulo:precio:${v.ensayo}`, texto: `«${corta(v.descripcion)}»: precio de ${eur(v.precio.valor)} en el plan y de ${eur(distinto.precio)} en la partida ${distinto.code}.` });
    }
    const uv = unidadPcc(v.unidad);
    const otra = ps.find((x) => {
      const up = unidadPcc(x.ud);
      return MEDIDAS.has(uv) && MEDIDAS.has(up) && uv !== up;
    });
    if (otra) avisos.push({ id: `capitulo:ud:${v.ensayo}`, texto: `«${corta(v.descripcion)}»: el plan lo mide en ${v.unidad} y la partida ${otra.code} en ${otra.ud}.` });
  }

  const importe = partidas.reduce((s, x) => s + x.importe, 0);
  const importeSinK = e.partidas.reduce((s, { p }) => s + partidaImporte(p, 1), 0);
  return { partidas, propuestas, importe, importeSinK, avisos };
}

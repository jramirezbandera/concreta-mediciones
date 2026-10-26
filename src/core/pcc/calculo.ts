/* ===========================================================================
   core/pcc/calculo — el plan de control de calidad entero, desde el
   presupuesto (§1 del plan). Función pura, como `calcularEstudioRcd`: sin
   store, sin React, sin bancos ni reloj (A1); el mismo plan da siempre el
   mismo resultado.

     1. Partidas: las propuestas y las que hay que revisar (O6) no cuentan y
        salen en «Antes de entregar»; el capítulo de control enlazado no
        genera controles (K-PCC.70).
     2. Estructura: `calcularEstructura` (lotes, durabilidad, armaduras,
        ejecución) y sus filas del catálogo.
     3. Por familia presente: recepción documental, ensayos del catálogo con
        su tipo de lote (A–I), control de ejecución con la frecuencia en
        número y pruebas de obra terminada.
     4. Andalucía: los ensayos acústicos de la IT 5 (Decreto 50/2025).
     5. Valoración: lo que paga la propiedad, con la fuente de cada precio
        (banco copiado, hoja de la Junta, tecleado); lo del instalador o del
        organismo de control, listado sin importe (D2).
   =========================================================================== */
import { fmtCents, fmtNum } from '../money';
import { partidaCantidad } from '../medicion';
import { comunidadDeProvincia } from '../rcd/calculo';
import { costesDirectos, pem } from '../totales';
import { findNode, subtreeIds } from '../tree';
import type { Banco, Chapter, Obra, Partida, PartidasMap, Rates } from '../types';
import { coherenciaCapitulo } from './coherencia';
import { calcularEstructura, type PartidaEstructura } from './estructura';
import { leerDesignacion } from './hormigon';
import { ENLACE_VERSION, cubreDelEnlace } from './precios';
import { necesitaRevision, normaliza } from './reglas';
import catalogoJson from './tablas/catalogo.json';
import ejecucionJson from './tablas/ejecucion.json';
import familiasJson from './tablas/familias.json';
import type {
  Aviso,
  BloqueEjecucion,
  BloqueRecepcion,
  CoberturaPrecio,
  ControlPartida,
  DatosFamilia,
  DocumentoExigido,
  FilaControl,
  FilaSinCoste,
  FilaValoracion,
  InspeccionEjecucion,
  Pendiente,
  PlanCalidad,
  PlanCalidadDatos,
  PrecioFila,
  PruebaObraTerminada,
  Quien,
  ResultadoEstructura,
} from './tipos';
import { unidadPcc, type UnidadPcc } from './unidades';

export interface EntradaPcc {
  chapters: Chapter[];
  partidas: PartidasMap;
  /** Recursos de la obra: la descomposición ya la leyeron las reglas; aquí no se usa. */
  banco: Banco;
  rates: Rates;
  obra: Obra;
  plan: PlanCalidadDatos;
  /** Hoy (ISO): la fecha del plan si no tiene una. */
  hoy: string;
}

/* ---- tablas ----------------------------------------------------------------- */

interface Lote {
  tipo: string;
  n: number | null;
  tamano?: number | null;
  ud?: string | null;
  porVisita?: number;
  calculo?: string;
  momento?: string;
}
interface Ensayo {
  id: string;
  capitulo: string;
  apartado: string;
  nivel: 1 | 2 | 3;
  ensayo: string;
  norma: string | null;
  lote: Lote;
  precio: number | null;
  unidad: string;
  obs: string | null;
  cubre?: CoberturaPrecio;
  alternativaDe?: string;
}
interface Frecuencia {
  tipo: string;
  cada?: number;
  ud?: string;
  fila?: string;
  dato?: string;
}
interface Prueba {
  id: string;
  nombre: string;
  ensayos: string[];
  oblig: 'R' | 'P' | 'C';
  quien: 'LAB' | 'INST' | 'OC';
  cita: string;
  propuesta?: boolean;
  condicion?: string;
  soloPlurifamiliar?: boolean;
  dato?: string;
}
interface Familia {
  id: string;
  nombre: string;
  grupo: string;
  estructura?: string;
  recepcion: DocumentoExigido[];
  ejecucion: Array<{ id: string; fase: string; comprobacion: string; frecuencia: Frecuencia; rechazo: string; cita: string }>;
  ensayos: string[];
  ensayosPorTexto?: Array<{ texto: string; apartados: string[] }>;
  pruebas?: Prueba[];
}

const CATALOGO = catalogoJson.ensayos as Ensayo[];
const POR_ID = new Map(CATALOGO.map((e) => [e.id, e]));
const FAMILIAS = familiasJson.familias as Familia[];
const FAMILIA = new Map(FAMILIAS.map((f) => [f.id, f]));
const PROPIOS = new Map(familiasJson.propios.map((p) => [p.id, p]));
const PRUEBAS_GENERALES = familiasJson.pruebasGenerales as Prueba[];
const IT5 = familiasJson.andalucia.it5;

const codigosApartado = (e: Ensayo): string[] => e.apartado.split(' · ').map((x) => x.split(' ')[0]!);
const enApartado = (e: Ensayo, prefijo: string): boolean =>
  codigosApartado(e).some((c) => c === prefijo || c.startsWith(`${prefijo}.`));

/* ---- utilidades -------------------------------------------------------------- */

const techo = (x: number): number => Math.ceil(x - 1e-9);
const num = (n: number): string => (Number.isInteger(n) ? fmtNum(n, 0) : fmtNum(n, 2));
const plural = (n: number, uno: string, varios: string): string => `${num(n)} ${n === 1 ? uno : varios}`;
const eur = (cents: number): string => fmtCents(cents);
const UD_TXT: Record<UnidadPcc, string> = { m3: 'm³', m2: 'm²', m: 'm', kg: 'kg', t: 't', ud: 'ud', otra: 'ud' };

/** Unidad de lote de la hoja normalizada: «m³», «m2», «t», «Tubo», «Nº pilotes», «UD»… */
function unidadLote(ud: string | null | undefined): UnidadPcc | 'pilote' | 'vivienda' | null {
  if (!ud) return null;
  const t = normaliza(ud);
  if (/vivienda/.test(t)) return 'vivienda';
  if (/^(tubo|pilote|n.o pilotes|nº pilotes|anclaje)/.test(t)) return 'pilote';
  const u = unidadPcc(t.replace(/\s*\(.*\)$/, ''));
  return u === 'otra' ? null : u;
}

interface PartidaPlan {
  id: string;
  code: string;
  title: string;
  titulo: string;
  ud: string;
  u: UnidadPcc;
  cantidad: number;
  control: ControlPartida;
}

interface Ctx {
  plan: PlanCalidadDatos;
  estructura: ResultadoEstructura;
  viviendas: number | null;
  plurifamiliar: boolean;
  /** Hay elementos prefabricados (placas alveolares…): la inspección de sus uniones. */
  prefabricados: boolean;
  pend: (p: Pendiente) => void;
  avisa: (a: Aviso) => void;
}

/** Medición de las partidas de una familia en una unidad (con kg ↔ t y m³ por unidad del hormigón). */
function medicionEn(ps: PartidaPlan[], u: UnidadPcc): number | null {
  let total = 0;
  let alguna = false;
  for (const p of ps) {
    let q: number | null = null;
    if (p.u === u) q = p.cantidad;
    else if (u === 't' && p.u === 'kg') q = p.cantidad / 1000;
    else if (u === 'kg' && p.u === 't') q = p.cantidad * 1000;
    else if (u === 'm3' && p.control.hormigon?.m3PorUd) q = p.cantidad * p.control.hormigon.m3PorUd;
    if (q != null) {
      total += q;
      alguna = true;
    }
  }
  return alguna ? total : null;
}

/* ---- recuento por tipo de lote (D §3.2) ------------------------------------------ */

interface Recuento {
  cantidad: number;
  regla: string;
  unidad?: string;
}

function recuento(e: Ensayo, familia: Familia, ps: PartidaPlan[], ctx: Ctx): Recuento {
  const l = e.lote;
  const n = l.n ?? 1;
  const datos: DatosFamilia = ctx.plan.familias?.[familia.id] ?? {};
  const veces = (k: number, base: string): Recuento => ({ cantidad: techo(k * n), regla: n === 1 ? base : `${base} × ${num(n)}` });
  const falta = (dato: string, id = `${familia.id}:${dato}`): Recuento => {
    ctx.pend({ id: `dato:${id}`, texto: `${familia.nombre}: ${dato}.` });
    return { cantidad: 0, regla: `pendiente: ${dato}` };
  };
  switch (l.tipo) {
    case 'A': {
      const u = unidadLote(l.ud);
      const tam = l.tamano ?? 1;
      let med: number | null;
      let udTxt: string;
      if (u === 'pilote') {
        med = datos.pilotes ?? medicionEn(ps, 'ud');
        udTxt = 'ud';
        if (med == null) return falta('falta el número de pilotes, micropilotes o anclajes');
      } else if (u == null || u === 'vivienda') return falta(`lote «${l.ud}» que la app no sabe medir`);
      else {
        med = medicionEn(ps, u);
        udTxt = UD_TXT[u];
        if (med == null) return falta(`la medición no está en ${udTxt} (lote de ${num(tam)} ${udTxt})`, `${familia.id}:${e.id}`);
      }
      const lotes = Math.max(1, techo(med / tam));
      const porTipo = /tipo/i.test(l.ud ?? '') ? (datos.tipos ?? 1) : 1;
      return veces(lotes * porTipo, `${num(med)} ${udTxt} / ${num(tam)} → ${plural(lotes, 'lote', 'lotes')}${porTipo > 1 ? ` × ${porTipo} tipos` : ''}`);
    }
    case 'B': {
      const u = unidadLote(l.ud);
      let N: number | null;
      let base: string;
      if (u === 'vivienda') {
        N = ctx.viviendas;
        base = 'viviendas';
        if (N == null) return falta('falta el número de viviendas o unidades de uso');
      } else if (u === 'ud') {
        N = medicionEn(ps, 'ud');
        base = 'ud';
        if (N == null) return falta(`faltan las unidades (${l.ud})`, `${familia.id}:${e.id}`);
      } else {
        const clave = normaliza(l.ud ?? '');
        N = datos.unidades?.[clave] ?? null;
        base = l.ud ?? '';
        if (N == null) return falta(`falta el número de «${l.ud}»`, `${familia.id}:${clave}`);
      }
      const pct = l.tamano ?? 1;
      const pruebas = Math.max(1, techo(N * pct)) * n;
      const quien = base === 'viviendas' ? plural(N, 'vivienda', 'viviendas') : `${num(N)} ${base}`;
      const txt = `${quien} × ${num(pct * 100)} % → ${plural(pruebas, 'prueba', 'pruebas')}`;
      if (l.porVisita) {
        const visitas = Math.max(1, techo(pruebas / l.porVisita));
        return { cantidad: visitas, regla: `${txt}, ${l.porVisita} por visita → ${plural(visitas, 'visita', 'visitas')}` };
      }
      return { cantidad: pruebas, regla: txt };
    }
    case 'C': {
      const clave = normaliza(l.ud ?? '');
      const k = datos.unidades?.[clave] ?? 1;
      return veces(k, `${plural(k, (l.ud ?? 'ud').toLowerCase(), (l.ud ?? 'ud').toLowerCase())}`);
    }
    case 'D': {
      const tipos = datos.tipos ?? 1;
      if (datos.tipos == null)
        ctx.avisa({ id: `tipos:${familia.id}`, texto: `${familia.nombre}: se supone un solo tipo de producto para los ensayos por tipo; dilo si hay más.` });
      return veces(tipos, plural(tipos, 'tipo de producto', 'tipos de producto'));
    }
    case 'E': {
      const k = datos.procedencias ?? 1;
      return veces(k, plural(k, 'procedencia', 'procedencias'));
    }
    case 'F': {
      if (datos.dias == null) return falta('faltan los días de trabajo (ensayos por día)');
      return veces(datos.dias, plural(datos.dias, 'día de trabajo', 'días de trabajo'));
    }
    default:
      return { cantidad: 0, regla: 'a juicio de la dirección facultativa' };
  }
}

/* ---- filas de la estructura (lote G) ---------------------------------------------- */

function recuentoG(e: Ensayo, familia: Familia, ps: PartidaPlan[], ctx: Ctx): Recuento | null {
  const est = ctx.estructura;
  const c = e.lote.calculo;
  const conv = est.grupos.filter((g) => g.designacion.consistencia !== 'AC');
  const ac = est.grupos.filter((g) => g.designacion.consistencia === 'AC');
  const suma = (gs: typeof conv, k: keyof (typeof conv)[number]['ensayos']) => gs.reduce((s, g) => s + g.ensayos[k], 0);
  const regla = (gs: typeof conv) => gs.map((g) => g.cuenta).join(' · ');
  if (c === 'resistencia' || c === 'consistencia' || c === 'escurrimiento' || c === 'anilloJapones') {
    if (enApartado(e, '03.01.05.03')) return null; // encepados: ya cuentan en la fila de cimentaciones
    const gs = enApartado(e, '03.01.02') ? ac : conv;
    if (!gs.length) return null;
    return { cantidad: suma(gs, c), regla: regla(gs) };
  }
  if (c === 'penetracion' || c === 'aireOcluido') {
    const ds = est.durabilidad.filter((d) => (c === 'penetracion' ? d.penetracion : d.aireOcluido) > 0);
    if (!ds.length) return null;
    const total = (d: (typeof ds)[number]) => (c === 'penetracion' ? d.penetracion : d.aireOcluido);
    const cantidad = e.lote.momento === 'inicio' ? ds.length : ds.reduce((s, d) => s + total(d) - 1, 0);
    if (!cantidad) return null;
    return { cantidad, regla: `${e.lote.momento === 'inicio' ? 'al inicio' : 'durante el suministro'}: ${ds.map((d) => d.cuenta).join(' · ')}` };
  }
  if (c === 'armaduras' || c === 'mallas') {
    const lotes = est.armaduras.filter((a) => (c === 'mallas' ? a.control === 'mallas' : a.control !== 'mallas'));
    const k = /geom/i.test(e.ensayo) ? 'geometria' : /doblad/i.test(e.ensayo) ? 'doblado' : /despegue/i.test(e.ensayo) ? 'despegue' : 'traccion';
    const cantidad = lotes.reduce((s, a) => s + (a.ensayos[k] ?? 0), 0);
    if (!cantidad) return null;
    return { cantidad, regla: lotes.map((a) => a.cuenta).join(' · ') };
  }
  if (c?.startsWith('pilotes') || c === 'integridadPilotes') return recuentoPilotes(e, familia, ps, ctx);
  if (c?.startsWith('pantallas')) return recuentoPantallas(e, familia, ps, ctx);
  return null;
}

/** Pilotes in situ: lo que dice la hoja de la Junta (UNE-EN 1536) e integridad del DB SE-C 5.4.2.1.9. */
function recuentoPilotes(e: Ensayo, familia: Familia, ps: PartidaPlan[], ctx: Ctx): Recuento | null {
  const insitu = ps.filter((p) => !/prefabric/.test(p.titulo));
  if (!insitu.length) return null;
  const datos = ctx.plan.familias?.[familia.id] ?? {};
  const K = datos.pilotes ?? medicionEn(insitu, 'ud');
  if (K == null) {
    ctx.pend({ id: `dato:${familia.id}:pilotes`, texto: `${familia.nombre}: falta el número de pilotes.` });
    return { cantidad: 0, regla: 'pendiente: falta el número de pilotes' };
  }
  const fck = Math.max(0, ...insitu.map((p) => leerDesignacion(p.title)?.designacion.fck ?? 0));
  const alto = fck >= 35;
  const sub = codigosApartado(e).at(-1) ?? '';
  const c = e.lote.calculo;
  if (c === 'integridadPilotes') {
    if (e.id !== 'j03-060') return null; // alternativas con más tubos
    const d = datos.diametro ?? null;
    const f = datos.aislados ? (d != null && d > 1000 ? 5 : d != null && d >= 450 ? 2 : 1) : 1;
    const cantidad = techo(K / 20) * f;
    return { cantidad, regla: `${plural(K, 'pilote', 'pilotes')} / 20 × ${f} (DB SE-C 5.4.2.1.9)` };
  }
  if (sub.endsWith('.01.01')) return { cantidad: Math.min(3, K), regla: 'una serie por cada uno de los 3 primeros pilotes' };
  if (sub.endsWith('.01.02')) {
    if (datos.m3 == null) {
      ctx.pend({ id: `dato:${familia.id}:m3`, texto: `${familia.nombre}: faltan los m³ de hormigón de los pilotes (consistencia cada 10 m³).` });
      return { cantidad: 0, regla: 'pendiente: faltan los m³ de hormigón' };
    }
    return { cantidad: techo(datos.m3 / 10), regla: `${num(datos.m3)} m³ / 10 (UNE-EN 1536, según la hoja de la Junta)` };
  }
  if (sub.endsWith('.01.03') !== !alto) return null; // la otra clase de resistencia
  const cantidad = alto ? Math.max(0, K - 3) : Math.max(0, techo(K / 5) - 3);
  if (!cantidad) return null;
  return { cantidad, regla: alto ? `${plural(K, 'pilote', 'pilotes')}: una serie por pilote, menos las 3 del inicio` : `${plural(K, 'pilote', 'pilotes')} / 5, menos las 3 del inicio` };
}

/** Muros pantalla: lo que dice la hoja de la Junta (UNE-EN 1538). */
function recuentoPantallas(e: Ensayo, familia: Familia, _ps: PartidaPlan[], ctx: Ctx): Recuento | null {
  const datos = ctx.plan.familias?.[familia.id] ?? {};
  const sub = codigosApartado(e).at(-1) ?? '';
  if (sub.endsWith('.01.01')) {
    if (datos.paneles == null) {
      ctx.pend({ id: `dato:${familia.id}:paneles`, texto: `${familia.nombre}: falta el número de paneles.` });
      return { cantidad: 0, regla: 'pendiente: falta el número de paneles' };
    }
    return { cantidad: datos.paneles, regla: `${plural(datos.paneles, 'panel', 'paneles')}: una consistencia por panel` };
  }
  if (datos.dias == null || datos.m3 == null) {
    ctx.pend({ id: `dato:${familia.id}:dias-m3`, texto: `${familia.nombre}: faltan los días de hormigonado y los m³ de hormigón.` });
    return { cantidad: 0, regla: 'pendiente: faltan los días y los m³' };
  }
  const cantidad = Math.max(3 * datos.dias, 3 * techo(datos.m3 / 100));
  return { cantidad, regla: `max(3 × ${num(datos.dias)} días, 3 × ⌈${num(datos.m3)} m³ / 100⌉) (UNE-EN 1538, según la hoja de la Junta)` };
}

/* ---- cálculo ---------------------------------------------------------------------- */

export function calcularPlanCalidad(e: EntradaPcc): PlanCalidad {
  const { chapters, partidas, rates, obra, plan } = e;
  const pendientes: Pendiente[] = [];
  const avisos: Aviso[] = [];
  const pend = (p: Pendiente) => {
    if (!pendientes.some((x) => x.id === p.id)) pendientes.push(p);
  };
  const avisa = (a: Aviso) => {
    if (!avisos.some((x) => x.id === a.id)) avisos.push(a);
  };
  const fecha = plan.fecha ?? e.hoy;
  const comunidad = plan.comunidad ?? comunidadDeProvincia(typeof obra.provincia === 'string' ? obra.provincia : undefined);
  const viviendas = plan.viviendas ?? (plan.unifamiliar ? 1 : null);
  const plurifamiliar = viviendas != null ? viviendas > 1 : plan.unifamiliar === false;

  /* 1. Partidas -------------------------------------------------------------------- */
  const control = contenedores(chapters, plan.capituloControl ?? null);
  const enControl = (chapterId: string, p: Partida) =>
    !!control && chapterId === control.chapterId && (control.todo || control.ids.has(p.sub ?? chapterId));
  let sinRevisar = 0;
  const revisar: string[] = [];
  const confirmadas: PartidaPlan[] = [];
  for (const ch of chapters)
    for (const p of partidas[ch.id] ?? []) {
      if (enControl(ch.id, p)) continue;
      const c = p.pcc;
      if (!c) continue;
      if (c.estado === 'propuesta') {
        sinRevisar += 1;
        continue;
      }
      if (c.estado !== 'confirmada') continue;
      if (necesitaRevision(c, p)) {
        revisar.push(p.id);
        avisa({ id: `revisar:${p.id}`, partidaId: p.id, texto: `${p.code} «${corta(p.title)}» ha cambiado desde que se confirmó su control: revísalo (no entra en el plan hasta entonces).` });
        continue;
      }
      confirmadas.push({ id: p.id, code: p.code, title: p.title, titulo: normaliza(p.title), ud: p.ud, u: unidadPcc(p.ud), cantidad: partidaCantidad(p), control: c });
    }
  if (sinRevisar) pend({ id: 'sinRevisar', texto: `${plural(sinRevisar, 'partida', 'partidas')} con el control propuesto sin revisar: no entran en el plan.` });

  // Hormigón «incluso armadura» y acero aparte: el técnico dice cuál cuenta (O3).
  const aceroEnHormigon = confirmadas.filter((p) => p.control.hormigon && p.control.acero);
  const aceroAparte = confirmadas.filter((p) => !p.control.hormigon && p.control.acero);
  if (aceroEnHormigon.length && aceroAparte.length)
    avisa({ id: 'dobleComputo', texto: `Hay acero dentro de partidas de hormigón (${aceroEnHormigon.map((p) => p.code).join(', ')}) y en partidas aparte (${aceroAparte.map((p) => p.code).join(', ')}): quita el que no cuente para no medirlo dos veces.` });
  for (const p of confirmadas)
    if (p.control.familia === 'forjado-viguetas' && !p.control.hormigon)
      pend({ id: `designacion:${p.id}`, partidaId: p.id, texto: `${p.code} «${corta(p.title)}»: falta la designación del hormigón del forjado para contarlo en los lotes.` });

  /* 2. Estructura ------------------------------------------------------------------ */
  const estructura = calcularEstructura({
    partidas: confirmadas.filter((p) => p.control.hormigon || p.control.acero).map((p): PartidaEstructura => ({ id: p.id, code: p.code, title: p.title, ud: p.ud, cantidad: p.cantidad, control: p.control })),
    plan,
  });
  for (const x of estructura.pendientes) pend(x);
  for (const x of estructura.avisos) avisa(x);
  const prefabricados = confirmadas.some((p) => /\b(alveolar|prefabricad)/.test(p.titulo));
  const ctx: Ctx = { plan, estructura, viviendas, plurifamiliar, prefabricados, pend, avisa };

  /* 3. Familias presentes ---------------------------------------------------------- */
  const porFamilia = new Map<string, PartidaPlan[]>();
  for (const p of confirmadas) if (p.control.familia) porFamilia.set(p.control.familia, [...(porFamilia.get(p.control.familia) ?? []), p]);
  // La estructura crea su bloque aunque sus partidas sean de otra familia (forjados) o no tengan (acero de un hormigón).
  if (estructura.grupos.length && !porFamilia.has('hormigon-estructural')) porFamilia.set('hormigon-estructural', []);
  if (estructura.armaduras.some((a) => a.control !== 'mallas') && !porFamilia.has('acero-armar')) porFamilia.set('acero-armar', []);
  if (estructura.armaduras.some((a) => a.control === 'mallas') && !porFamilia.has('mallas')) porFamilia.set('mallas', []);

  const recepcion: BloqueRecepcion[] = [];
  const ejecucion: BloqueEjecucion[] = [];
  const obraTerminada: PruebaObraTerminada[] = [];
  const orden = FAMILIAS.map((f) => f.id);
  const presentes = [...porFamilia.keys()].sort((a, b) => orden.indexOf(a) - orden.indexOf(b));
  for (const id of presentes) {
    const familia = FAMILIA.get(id);
    if (!familia) {
      avisa({ id: `familia:${id}`, texto: `La familia «${id}» no está en la tabla de familias: sus partidas no entran en el plan.` });
      continue;
    }
    const ps = porFamilia.get(id)!;
    const filas = ensayosRecepcion(familia, ps, ctx);
    const documental = [...familiasJson.recepcionComun, ...familia.recepcion, ...documentalesSinCuantia(familia)];
    if (id === 'acero-armar' && plan.zonaSismica == null && ps.length)
      pend({ id: 'zonaSismica', texto: 'Di si la obra está en zona sísmica: con acero para armar, el plan pide el informe de ensayos de cargas cíclicas (Código Estructural, art. 58).' });
    recepcion.push({
      familia: id,
      nombre: familia.nombre,
      partidas: ps.map((p) => ({ partidaId: p.id, code: p.code, title: p.title, cantidad: p.cantidad, ud: p.ud })),
      documental,
      ensayos: filas,
    });
    const insp = inspecciones(familia, ps, ctx);
    if (insp.length) ejecucion.push({ familia: id, nombre: familia.nombre, inspecciones: insp });
    for (const pr of familia.pruebas ?? []) {
      const o = pruebaDe(pr, familia, ps, ctx);
      if (o) obraTerminada.push(o);
    }
  }
  for (const pr of PRUEBAS_GENERALES) {
    if (comunidad === 'andalucia' && pr.id === 'acustica-in-situ') continue; // la IT 5 la hace obligatoria
    const o = pruebaDe(pr, { id: 'general', nombre: 'Edificio', grupo: 'general', recepcion: [], ejecucion: [], ensayos: [] }, [], ctx);
    if (o) obraTerminada.push(o);
  }

  /* 4. Andalucía ------------------------------------------------------------------- */
  if (comunidad === 'andalucia') {
    const o = it5(ctx);
    if (o) obraTerminada.push(o);
  }

  /* 5. Valoración ------------------------------------------------------------------ */
  const todas = [...recepcion.flatMap((b) => b.ensayos), ...obraTerminada.flatMap((o) => o.filas)];
  const valoracion = valorar(todas.filter((f) => f.estado === 'incluido' && f.quien === 'LAB' && f.cantidad > 0), plan);
  const aCargoDeOtros: FilaSinCoste[] = todas
    .filter((f) => f.estado === 'aCargoDeOtros')
    .map((f) => ({ ensayo: f.ensayo, ...(f.prueba ? { prueba: f.prueba } : {}), descripcion: f.descripcion, quien: f.quien, cantidad: f.cantidad, unidad: f.unidad, regla: f.regla, ...(f.cita ? { cita: f.cita } : {}) }));
  for (const v of valoracion)
    if (v.importe == null) pend({ id: `precio:${v.ensayo}`, texto: `${v.descripcion}: falta el precio (tómalo de un banco o tecléalo).` });
  const total = valoracion.reduce((s, v) => s + (v.importe ?? 0), 0);
  const totalCompleto = valoracion.every((v) => v.importe != null);

  // Base del %: el PEM sin el capítulo de control (Q1, O1b); y el aviso de los 300.000 € (D8).
  const sinControl: PartidasMap = {};
  for (const ch of chapters) sinControl[ch.id] = (partidas[ch.id] ?? []).filter((p) => !enControl(ch.id, p));
  const basePem = pem(costesDirectos(sinControl, rates.coefK), rates);
  const pemObra = pem(costesDirectos(partidas, rates.coefK), rates);
  const porcentaje = basePem > 0 && valoracion.length ? { valor: Math.round((total / basePem) * 1e5) / 1e3, basePem } : null;
  if (pemObra > 30_000_000)
    avisa({ id: 'niveles300k', texto: 'El PEM pasa de 300.000 €: la hoja de la Junta recomienda añadir los ensayos de nivel 2. Es una recomendación, no una norma: márcalos si los quieres.' });
  if (!confirmadas.length && !sinRevisar)
    pend({ id: 'sinPartidas', texto: 'Ninguna partida tiene control asignado: propón y confirma el control de las partidas.' });
  if (estructura.grupos.length && !estructura.totales.amasadas && estructura.modalidad === 'estadistico')
    avisa({ id: 'sinEnsayosHormigon', texto: 'La obra tiene hormigón estructural y el plan no cuenta ningún ensayo de hormigón (K-PCC.53).' });

  /* 6. Capítulo de control (§9) ------------------------------------------------------- */
  let capitulo: PlanCalidad['capitulo'] = null;
  const nodo = control ? findNode(chapters, plan.capituloControl!) : null;
  if (control && nodo) {
    const enCap: Array<{ chapterId: string; p: Partida }> = [];
    for (const ch of chapters) for (const p of partidas[ch.id] ?? []) if (enControl(ch.id, p)) enCap.push({ chapterId: ch.id, p });
    const co = coherenciaCapitulo({ partidas: enCap, valoracion, plan, rates });
    for (const a of co.avisos) avisa(a);
    const kci = rates.coefK !== 1 || rates.ci > 0;
    const aportePem = pemObra - basePem;
    // Plan pobre (D §6.9): lo que dan los ensayos de nivel 1 de las familias presentes, marcados o no.
    const nivel1 = recepcion
      .flatMap((b) => b.ensayos)
      .filter(
        (f) =>
          f.quien === 'LAB' &&
          f.cantidad > 0 &&
          !POR_ID.get(f.ensayo)?.alternativaDe &&
          ((f.estado === 'incluido' && f.nivel !== 2 && f.nivel !== 3) || (f.estado === 'noMarcado' && f.nivel === 1 && f.familia !== 'acero-laminado')),
      );
    const minimoNivel1 = valorar(nivel1, plan).reduce((s, v) => s + (v.importe ?? 0), 0);
    if (enCap.length && kci)
      avisa({
        id: 'capitulo:kci',
        texto: `El capítulo de control aporta ${eur(aportePem)} al PEM (con K = ${fmtNum(rates.coefK, 3)} y ${fmtNum(rates.ci * 100, 2)} % de costes indirectos) y la valoración del plan es de ${eur(total)}, a precios de laboratorio sin K ni costes indirectos.`,
      });
    if (minimoNivel1 > 0 && co.importeSinK < minimoNivel1)
      avisa({
        id: 'planPobre',
        texto: `El capítulo de control (${eur(co.importeSinK)}) queda por debajo de lo que dan los ensayos de nivel 1 de las familias de la obra (${eur(minimoNivel1)}), a precios de laboratorio.`,
      });
    capitulo = {
      id: nodo.node.id,
      code: nodo.node.code,
      title: nodo.node.title,
      partidas: co.partidas,
      propuestas: co.propuestas,
      importe: co.importe,
      aportePem,
      kci,
      minimoNivel1,
    };
  } else if (valoracion.length)
    pend({ id: 'capitulo', texto: 'El presupuesto no tiene capítulo de control de calidad enlazado: enlázalo o créalo desde la valoración (el presupuesto incluirá la valoración del control, CTE parte I, anejo I).' });

  return {
    version: { motor: 1, catalogo: catalogoJson.version, enlaceBcca: ENLACE_VERSION, familias: familiasJson.version, ...estructura.version },
    fecha,
    comunidad,
    marco: marcoDe(presentes, estructura, comunidad, plan),
    recepcion,
    ejecucion,
    obraTerminada,
    estructura,
    valoracion,
    aCargoDeOtros,
    total,
    totalCompleto,
    porcentaje,
    capitulo,
    sinRevisar,
    revisar,
    pendientes,
    avisos,
  };
}

/* ---- recepción ------------------------------------------------------------------- */

function ensayosRecepcion(familia: Familia, ps: PartidaPlan[], ctx: Ctx): FilaControl[] {
  const prefijos = new Set(familia.ensayos);
  for (const x of familia.ensayosPorTexto ?? []) {
    const re = new RegExp(x.texto);
    if (ps.some((p) => re.test(p.titulo))) for (const a of x.apartados) prefijos.add(a);
  }
  // La estructura: sus filas del catálogo aunque las partidas sean de otra familia.
  if (familia.id === 'hormigon-estructural') for (const a of ['03.01.01', '03.01.02', '03.01.03', '03.06']) prefijos.add(a);
  const filas: FilaControl[] = [];
  const marcados = ctx.plan.marcados ?? {};
  for (const e of CATALOGO) {
    if (![...prefijos].some((a) => enApartado(e, a))) continue;
    if (e.lote.tipo === 'I') continue; // exigencia documental: va a la recepción documental
    const estado = filtroFamilia(familia, e, ctx) ?? estadoRecepcion(e, marcados);
    // Lo que no entra en el plan no pide datos ni avisa.
    const c = estado === 'incluido' ? ctx : silencioso(ctx);
    if (e.lote.tipo === 'D' && enApartado(e, '03.01.02.01')) {
      // característicos del autocompactante: uno por dosificación AC
      const ac = new Set(ctx.estructura.grupos.filter((g) => g.designacion.consistencia === 'AC').map((g) => g.dosificacion));
      if (!ac.size) continue;
      filas.push(fila(e, familia, { cantidad: ac.size * (e.lote.n ?? 1), regla: plural(ac.size, 'dosificación autocompactante', 'dosificaciones autocompactantes') }, estado));
      continue;
    }
    const r = e.lote.tipo === 'G' ? recuentoG(e, familia, ps, c) : recuento(e, familia, ps, c);
    if (!r) continue;
    filas.push(fila(e, familia, r, estado));
  }
  // Ensayos del Código sin fila en el catálogo: partidas propias de la app (masa por metro, dimensiones…).
  if (familia.id === 'acero-armar' || familia.id === 'mallas') filas.push(...propiosAcero(familia, ctx));
  return filas;
}

const silencioso = (ctx: Ctx): Ctx => ({ ...ctx, pend: () => {}, avisa: () => {} });

/**
 * Lo que una familia decide de una fila del catálogo antes que el nivel. Acero
 * estructural (§5.7, K-PCC.33): el taller lo controla el fabricante con su marcado CE
 * (UNE-EN 1090-1); los ensayos de soldadura, solo con soldadura en obra y por tipo de
 * cordón; los conectores, si los hay; la protección, a criterio. El apriete, siempre.
 */
function filtroFamilia(familia: Familia, e: Ensayo, ctx: Ctx): FilaControl['estado'] | null {
  if (familia.id !== 'acero-laminado') return null;
  const marcado = ctx.plan.marcados?.[e.id];
  if (marcado != null) return marcado ? 'incluido' : 'noMarcado';
  const datos = ctx.plan.familias?.[familia.id] ?? {};
  if (enApartado(e, '03.02.03')) return 'noMarcado';
  if (enApartado(e, '03.02.04.03')) return datos.conectores ? null : 'noMarcado';
  if (enApartado(e, '03.02.04')) {
    if (datos.soldaduraObra == null) {
      ctx.pend({ id: 'dato:acero-laminado:soldadura', texto: 'Estructura de acero: di si hay soldadura en obra y de qué tipo son los cordones (ángulo, a tope).' });
      return 'noMarcado';
    }
    if (!datos.soldaduraObra) return 'noMarcado';
    const cordones = datos.cordones ?? ['angulo'];
    if (enApartado(e, '03.02.04.02') && !cordones.includes('tope')) return 'noMarcado';
    if (enApartado(e, '03.02.04.01') && !cordones.includes('angulo') && !/visual/i.test(e.ensayo)) return 'noMarcado';
    return null;
  }
  if (enApartado(e, '03.02.06')) return 'noMarcado';
  return null;
}

function estadoRecepcion(e: Ensayo, marcados: Record<string, boolean>): FilaControl['estado'] {
  if (e.lote.tipo === 'H') return 'aCriterio';
  if (e.alternativaDe) return marcados[e.id] ? 'incluido' : 'noMarcado';
  if (e.nivel === 1) return marcados[e.id] === false ? 'noMarcado' : 'incluido';
  return marcados[e.id] ? 'incluido' : 'noMarcado';
}

function fila(e: Ensayo, familia: Familia, r: Recuento, estado: FilaControl['estado'], extra: Partial<FilaControl> = {}): FilaControl {
  return {
    ensayo: e.id,
    familia: familia.id,
    capa: 'recepcion',
    descripcion: e.ensayo,
    norma: e.norma,
    nivel: e.nivel,
    unidad: r.unidad ?? e.unidad,
    cantidad: estado === 'aCriterio' ? 0 : r.cantidad,
    regla: r.regla,
    estado,
    quien: estado === 'aCriterio' ? 'DF' : 'LAB',
    ...extra,
  };
}

function propiosAcero(familia: Familia, ctx: Ctx): FilaControl[] {
  const lotes = ctx.estructura.armaduras.filter((a) => (familia.id === 'mallas' ? a.control === 'mallas' : a.control !== 'mallas'));
  const out: FilaControl[] = [];
  const add = (id: string, cantidad: number) => {
    const p = PROPIOS.get(id)!;
    if (!cantidad) return;
    out.push({ ensayo: id, familia: familia.id, capa: 'recepcion', descripcion: p.ensayo, norma: p.norma, nivel: null, unidad: p.unidad, cantidad, regla: lotes.map((a) => a.cuenta).join(' · '), estado: 'incluido', quien: 'LAB', cita: p.cita });
  };
  const suma = (k: 'masaMetro' | 'quimica' | 'dimensiones' | 'doblado', control?: string) =>
    lotes.filter((a) => !control || a.control === control).reduce((s, a) => s + (a.ensayos[k] ?? 0), 0);
  if (familia.id === 'mallas') {
    add('app-doblado-mallas', suma('doblado'));
    add('app-masa-metro', suma('masaMetro'));
    add('app-dimensiones-mallas', suma('dimensiones'));
  } else {
    add('app-masa-metro', suma('masaMetro'));
    add('app-quimica-acero', suma('quimica'));
    add('app-dimensiones-ferralla', suma('dimensiones', 'ferralla'));
  }
  return out;
}

/** Exigencias «sin cuantía» del catálogo (cualificación de soldadores…): a la recepción documental. */
function documentalesSinCuantia(familia: Familia): DocumentoExigido[] {
  return CATALOGO.filter((e) => e.lote.tipo === 'I' && familia.ensayos.some((a) => enApartado(e, a))).map((e) => ({
    texto: e.ensayo,
    cita: e.norma ?? 'Hoja de la Junta (V04)',
  }));
}

/* ---- ejecución ------------------------------------------------------------------- */

function inspecciones(familia: Familia, ps: PartidaPlan[], ctx: Ctx): InspeccionEjecucion[] {
  const out: InspeccionEjecucion[] = [];
  const lotesEje = ctx.estructura.ejecucion.lotes;
  for (const x of familia.ejecucion) {
    const f = x.frecuencia;
    let cantidad: number | null = null;
    let cuenta: string;
    switch (f.tipo) {
      case 'loteEjecucion': {
        const ls = f.fila === 'cualquiera' ? lotesEje : lotesEje.filter((l) => l.fila === f.fila);
        if (!ls.length) continue;
        cantidad = ls.reduce((s, l) => s + l.lotes, 0);
        cuenta = `una por lote de ejecución: ${ls.map((l) => l.cuenta).join(' · ')}`;
        break;
      }
      case 'anejo15': {
        if (!lotesEje.length) continue;
        out.push(...anejo15(x, familia, lotesEje, ctx));
        continue;
      }
      case 'medicion': {
        const u = unidadPcc(f.ud ?? '');
        const med = medicionEn(ps, u);
        if (med == null) {
          cuenta = `una cada ${num(f.cada ?? 1)} ${UD_TXT[u]}; la medición no está en ${UD_TXT[u]}`;
          break;
        }
        cantidad = Math.max(1, techo(med / (f.cada ?? 1)));
        cuenta = `${num(med)} ${UD_TXT[u]} / ${num(f.cada ?? 1)} → ${cantidad}`;
        break;
      }
      case 'planta': {
        const P = ctx.plan.plantas ?? null;
        if (P == null) cuenta = 'una por planta; faltan las plantas de la obra';
        else {
          cantidad = P;
          cuenta = `una por planta: ${plural(P, 'planta', 'plantas')}`;
        }
        break;
      }
      case 'unidad': {
        const datos = ctx.plan.familias?.[familia.id] ?? {};
        const uds = medicionEn(ps, 'ud') ?? datos.pilotes ?? null;
        if (uds == null) cuenta = 'una por unidad; falta el número de unidades';
        else {
          cantidad = uds;
          cuenta = `una por unidad: ${num(uds)}`;
        }
        break;
      }
      case 'vivienda': {
        if (ctx.viviendas == null) cuenta = 'una por vivienda; falta el número de viviendas';
        else {
          cantidad = ctx.viviendas;
          cuenta = `una por vivienda: ${plural(ctx.viviendas, 'vivienda', 'viviendas')}`;
        }
        break;
      }
      case 'datos': {
        const v = (ctx.plan.familias?.[familia.id] as Record<string, unknown> | undefined)?.[f.dato ?? ''];
        if (typeof v === 'number') {
          cantidad = v;
          cuenta = `una por ${f.dato}: ${num(v)}`;
        } else cuenta = `una por ${f.dato}; falta el dato`;
        break;
      }
      default:
        cantidad = 1;
        cuenta = 'una';
    }
    out.push({ id: `${familia.id}:${x.id}`, fase: x.fase, comprobacion: x.comprobacion, cantidad, cuenta, rechazo: x.rechazo, cita: x.cita });
  }
  return out;
}

/** Unidades de inspección por lote de la tabla A15.2.1 (orientativa), nivel normal o intenso. */
function anejo15(
  x: Familia['ejecucion'][number],
  familia: Familia,
  lotes: ResultadoEstructura['ejecucion']['lotes'],
  ctx: Ctx,
): InspeccionEjecucion[] {
  const nivel = ctx.estructura.ejecucion.nivel;
  const opcionB = ctx.plan.ejecucion?.opcion === 'B';
  const n = lotes.reduce((s, l) => s + l.lotes, 0);
  return ejecucionJson.inspecciones.procesos
    .filter((p) => p.id !== 'prefabricados' || ctx.prefabricados)
    .map((p) => {
      const v = p[nivel];
      const control = Number(v.control);
      const contraste = Number(v.contraste);
      const porLote = opcionB ? contraste : control;
      const cantidad = Number.isFinite(porLote) ? porLote * n : null;
      const cuenta = `${plural(n, 'lote', 'lotes')} de ejecución × ${opcionB ? `${v.contraste} (contraste de la DF, opción B)` : `${v.control} (control, opción A)`}; nivel ${nivel} (tabla A15.2.1, orientativa)`;
      return { id: `${familia.id}:${x.id}:${p.id}`, fase: x.fase, comprobacion: p.nombre, cantidad, cuenta, rechazo: x.rechazo, cita: `${x.cita}` };
    });
}

/* ---- obra terminada ---------------------------------------------------------------- */

function pruebaDe(pr: Prueba, familia: Familia, ps: PartidaPlan[], ctx: Ctx): PruebaObraTerminada | null {
  if (pr.condicion && !ps.some((p) => new RegExp(pr.condicion!).test(p.titulo))) return null;
  if (pr.soloPlurifamiliar && !ctx.plurifamiliar) return null;
  const marcado = ctx.plan.marcados?.[pr.id];
  let incluida: boolean;
  if (pr.oblig === 'R') incluida = true;
  else if (pr.oblig === 'P') incluida = marcado === true || (!!pr.propuesta && marcado !== false);
  else {
    incluida = (ctx.plan as unknown as Record<string, unknown>)[pr.dato ?? ''] === true;
    if (ctx.plan.inspeccionInicial == null && ctx.plurifamiliar && pr.dato === 'inspeccionInicial')
      ctx.pend({ id: 'inspeccionInicial', texto: 'Di si la instalación eléctrica necesita inspección inicial por organismo de control (garaje de 25 plazas o más, piscina de más de 10 kW, recarga de vehículo eléctrico con proyecto).' });
  }
  const aLab = pr.quien === 'LAB' || (pr.quien === 'INST' && ctx.plan.aCargo?.[pr.id] === 'laboratorio');
  const quien: Quien = aLab ? 'LAB' : pr.quien;
  const estado: FilaControl['estado'] = !incluida ? 'noMarcado' : aLab ? 'incluido' : 'aCargoDeOtros';
  const c = estado === 'noMarcado' ? silencioso(ctx) : ctx;
  const filas: FilaControl[] = pr.ensayos.length
    ? pr.ensayos.map((id) => {
        const e = POR_ID.get(id)!;
        const r = e.lote.tipo === 'G' ? (recuentoG(e, familia, ps, c) ?? { cantidad: 0, regla: '—' }) : recuento(e, familia, ps, c);
        return { ...fila(e, familia, r, estado), capa: 'obraTerminada', prueba: pr.id, quien, cita: pr.cita };
      })
    : [{ ensayo: pr.id, familia: familia.id, capa: 'obraTerminada', prueba: pr.id, descripcion: pr.nombre, norma: null, nivel: null, unidad: 'ud', cantidad: 1, regla: 'una, por el dato de la obra', estado, quien, cita: pr.cita }];
  return { id: pr.id, familia: familia.id, nombre: pr.nombre, cita: pr.cita, oblig: pr.oblig, quien, incluida, filas };
}

/** IT 5 del Decreto 50/2025: obligatoria en Andalucía en obra con proyecto (K-PCC.47). */
function it5(ctx: Ctx): PruebaObraTerminada | null {
  if (ctx.plan.uso === 'otro') {
    ctx.avisa({ id: 'it5:uso', texto: 'Andalucía: la IT 5 del Decreto 50/2025 también obliga en otros usos con DB HR; ajusta el muestreo a mano.' });
    return null;
  }
  const familia: Familia = { id: 'andalucia', nombre: 'Ensayos acústicos (IT 5)', grupo: 'general', recepcion: [], ejecucion: [], ensayos: [] };
  const aislada = !!ctx.plan.aislada && !ctx.plurifamiliar;
  const ids = aislada ? IT5.aislada : IT5.ensayos;
  const filas: FilaControl[] = ids.map((id) => {
    const e = POR_ID.get(id)!;
    const r = recuento(e, familia, [], ctx);
    return { ...fila(e, familia, { ...r, regla: `${r.regla} (IT 5: al menos el 10 % de las viviendas, mínimo una)` }, 'incluido'), capa: 'obraTerminada', prueba: IT5.id, cita: IT5.cita };
  });
  if (!aislada) {
    const recintos = ctx.plan.recintosIT5 ?? {};
    for (const [clave, id] of Object.entries(IT5.recintos) as Array<[keyof typeof recintos, string]>) {
      const k = recintos[clave];
      if (k == null) {
        if (ctx.plurifamiliar)
          ctx.pend({ id: `it5:${clave}`, texto: `Andalucía, IT 5: di cuántos ${clave === 'comunes' ? 'casos de instalaciones comunes' : `recintos de ${clave} colindantes con habitables`} hay (se ensayan todos).` });
        continue;
      }
      if (!k) continue;
      const e = POR_ID.get(id)!;
      const previa = filas.find((f) => f.ensayo === id);
      if (previa) {
        previa.cantidad += k;
        previa.regla += ` + ${k} (${clave})`;
      } else filas.push({ ...fila(e, familia, { cantidad: k, regla: `todos los casos: ${k} (${clave})` }, 'incluido'), capa: 'obraTerminada', prueba: IT5.id, cita: IT5.cita });
    }
  }
  if (aislada) ctx.avisa({ id: 'it5:aislada', texto: 'Unifamiliar aislada: la IT 5 solo pide el aislamiento a ruido aéreo de fachada (ap. 10).' });
  return { id: IT5.id, familia: 'andalucia', nombre: IT5.nombre, cita: IT5.cita, oblig: 'R', quien: 'LAB', incluida: true, filas };
}

/* ---- valoración ------------------------------------------------------------------- */

function valorar(filas: FilaControl[], plan: PlanCalidadDatos): FilaValoracion[] {
  const porEnsayo = new Map<string, FilaControl[]>();
  for (const f of filas) porEnsayo.set(f.ensayo, [...(porEnsayo.get(f.ensayo) ?? []), f]);
  const out: FilaValoracion[] = [];
  for (const [id, fs] of porEnsayo) {
    const cantidad = fs.reduce((s, f) => s + f.cantidad, 0);
    const precio = precioDe(id, plan);
    const precios = cantidad * (precio.cubre?.porEnsayo ?? 1);
    out.push({
      ensayo: id,
      descripcion: fs[0]!.descripcion,
      norma: fs[0]!.norma,
      unidad: fs[0]!.unidad,
      cantidad,
      regla: [...new Set(fs.map((f) => f.regla))].join(' · '),
      precio,
      precios,
      importe: precio.valor == null ? null : Math.round(precios * precio.valor * 100),
    });
  }
  return out;
}

/** Orden de la fuente (§8): copia del banco, hoja de la Junta, tecleado, pendiente. */
export function precioDe(id: string, plan: PlanCalidadDatos): PrecioFila {
  const e = POR_ID.get(id);
  const copia = plan.precios?.[id];
  if (copia) {
    const cubre = copia.cubre ?? cubreDelEnlace(id) ?? e?.cubre;
    return { valor: copia.precio, fuente: 'banco', banco: copia.banco, fecha: copia.fecha, codigo: copia.codigo, ...(cubre ? { cubre } : {}) };
  }
  if (e?.precio != null && e.precio > 0)
    return { valor: e.precio, fuente: 'junta', fecha: catalogoJson.precios.fecha, ...(e.cubre ? { cubre: e.cubre } : {}) };
  const manual = plan.preciosManuales?.[id];
  if (manual != null) return { valor: manual, fuente: 'manual' };
  return { valor: null, fuente: 'pendiente' };
}

/* ---- marco normativo --------------------------------------------------------------- */

function marcoDe(presentes: string[], est: ResultadoEstructura, comunidad: string | null, plan: PlanCalidadDatos): string[] {
  const m = [
    'Código Técnico de la Edificación, parte I, art. 7 y anejo I',
    'Reglamento (UE) n.º 305/2011 y Reglamento (UE) 2024/3110, de productos de construcción',
    'RD 410/2010, de entidades de control y laboratorios de ensayos',
  ];
  const hay = (...ids: string[]) => ids.some((id) => presentes.includes(id));
  if (est.grupos.length || est.armaduras.length || hay('acero-laminado')) m.push('Código Estructural (RD 470/2021), con la corrección de errores de 2024');
  if (hay('saneamiento', 'fontaneria')) m.push('CTE DB HS, secciones HS 4 y HS 5');
  if (hay('electricidad')) m.push('Reglamento electrotécnico para baja tensión (REBT), ITC-BT-04 e ITC-BT-05');
  if (hay('climatizacion', 'solar-termica')) m.push('Reglamento de instalaciones térmicas en los edificios (RITE), arts. 20 y 22 e IT 2');
  if (hay('pci')) m.push('Reglamento de instalaciones de protección contra incendios (RIPCI)');
  if (hay('telecomunicaciones')) m.push('Orden ITC/1644/2011, de infraestructuras comunes de telecomunicaciones');
  if (hay('gas')) m.push('RD 919/2006, reglamento técnico de distribución y utilización de combustibles gaseosos, ITC-ICG 07');
  if (comunidad === 'andalucia') {
    m.push(...familiasJson.andalucia.marco);
    if (plan.uso !== 'otro') m.push(familiasJson.andalucia.vivienda, familiasJson.andalucia.acustica);
  }
  return m;
}

/* ---- auxiliares --------------------------------------------------------------------- */

function contenedores(chapters: Chapter[], id: string | null): { chapterId: string; ids: Set<string>; todo: boolean } | null {
  if (!id) return null;
  const f = findNode(chapters, id);
  if (!f) return null;
  if (f.depth === 0) return { chapterId: f.chapter.id, ids: new Set([f.chapter.id]), todo: true };
  return { chapterId: f.chapter.id, ids: subtreeIds(f.node as Parameters<typeof subtreeIds>[0]), todo: false };
}

function corta(s: string): string {
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}

/**
 * Todo el texto que el plan puede imprimir, para la lista de citas prohibidas. Los avisos
 * son de la app (citan lo que hay que corregir, como una «IIa» del presupuesto): no van.
 */
export function textoPlano(plan: PlanCalidad): string {
  const out: string[] = [...plan.marco];
  for (const b of plan.recepcion) {
    out.push(b.nombre, ...b.documental.flatMap((d) => [d.texto, d.cita]));
    for (const f of b.ensayos) out.push(f.descripcion, f.norma ?? '', f.regla, f.cita ?? '');
  }
  for (const b of plan.ejecucion) for (const i of b.inspecciones) out.push(i.fase, i.comprobacion, i.cuenta, i.rechazo, i.cita);
  for (const o of plan.obraTerminada) {
    out.push(o.nombre, o.cita);
    for (const f of o.filas) out.push(f.descripcion, f.norma ?? '', f.regla);
  }
  for (const g of plan.estructura.grupos) out.push(g.cuenta, ...g.notas);
  for (const d of plan.estructura.durabilidad) out.push(d.cuenta);
  for (const a of plan.estructura.armaduras) out.push(a.cuenta, ...a.notas);
  for (const l of plan.estructura.ejecucion.lotes) out.push(l.cuenta);
  out.push(plan.estructura.indirecto.motivo);
  for (const v of plan.valoracion) out.push(v.descripcion, v.norma ?? '', v.regla);
  for (const x of plan.pendientes) out.push(x.texto);
  return out.filter(Boolean).join('\n');
}

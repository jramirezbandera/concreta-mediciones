/* ===========================================================================
   core/planoTexto — lo que se lee del texto de una página del PDF (A1):

   · la escala del cajetín («E 1:50», «ESCALA 1/100»…) como comprobación de
     la calibración (§2, T9);
   · la etiqueta propuesta de la página («PLANTA BAJA» → «PB»);
   · el comentario propuesto al medir una Superficie o un Rectángulo: el texto
     dentro del polígono (§3.5), p. ej. «Dormitorio 2».

   Puro. Los textos llegan del motor de PDF en coordenadas de página
   (`TextoPdf`), a menudo partidos en fragmentos («1» «:» «50»): se unen los
   contiguos antes de leer. El texto sacado del PDF solo entra en la interfaz
   como texto de React, nunca como HTML (§4.5).
   =========================================================================== */
import { dist, escalaN, mPorUnidadDeCota, mPorUnidadDeEscala, type Caja } from './planoGeom';

export { mPorUnidadDeEscala };
import type { Escala, Punto } from './types';

export interface TextoPagina {
  texto: string;
  caja: Caja;
  tamano: number;
  dir: [number, number];
}

/* ---- unir fragmentos contiguos ----------------------------------------------- */

const centro = (c: Caja): Punto => [(c[0] + c[2]) / 2, (c[1] + c[3]) / 2];
const esquinas = (c: Caja): Punto[] => [
  [c[0], c[1]],
  [c[2], c[1]],
  [c[0], c[3]],
  [c[2], c[3]],
];

/** Extensión de una caja a lo largo de `dir` y su posición en perpendicular. */
function proyeccion(t: TextoPagina): { ini: number; fin: number; perp: number } {
  const [dx, dy] = t.dir;
  const a = esquinas(t.caja).map(([x, y]) => x * dx + y * dy);
  const [cx, cy] = centro(t.caja);
  return { ini: Math.min(...a), fin: Math.max(...a), perp: -cx * dy + cy * dx };
}

/**
 * Une los fragmentos que siguen a otro en la misma línea: misma dirección,
 * tamaño parecido, a menos de media letra en perpendicular y con un hueco de
 * menos de una letra. Con un hueco visible se une con un espacio.
 */
export function unirContiguos(textos: readonly TextoPagina[]): TextoPagina[] {
  const items = textos
    .filter((t) => t.texto.trim())
    .map((t) => ({ t: { ...t, caja: [...t.caja] as Caja, dir: [...t.dir] as [number, number] }, p: proyeccion(t) }))
    .sort((a, b) => a.p.perp - b.p.perp || a.p.ini - b.p.ini);
  const usados = new Set<number>();
  const out: TextoPagina[] = [];
  // Orden de lectura dentro de cada línea: por el inicio a lo largo de `dir`.
  const orden = [...items.keys()].sort((i, j) => items[i]!.p.ini - items[j]!.p.ini);
  for (const i of orden) {
    if (usados.has(i)) continue;
    usados.add(i);
    let cur = items[i]!.t;
    let fin = items[i]!.p.fin;
    const perp = items[i]!.p.perp;
    for (;;) {
      let siguiente = -1;
      let hueco = Infinity;
      for (const j of orden) {
        if (usados.has(j)) continue;
        const o = items[j]!;
        const mismaDir = o.t.dir[0] * cur.dir[0] + o.t.dir[1] * cur.dir[1] > 0.99;
        const ratio = o.t.tamano / cur.tamano;
        if (!mismaDir || ratio < 0.7 || ratio > 1.43) continue;
        const h = cur.tamano;
        if (Math.abs(o.p.perp - perp) > 0.5 * h) continue;
        const g = o.p.ini - fin;
        if (g < -0.3 * h || g > 1.0 * h) continue;
        if (g < hueco) {
          hueco = g;
          siguiente = j;
        }
      }
      if (siguiente < 0) break;
      usados.add(siguiente);
      const o = items[siguiente]!;
      cur = {
        texto: `${cur.texto}${hueco > 0.15 * cur.tamano ? ' ' : ''}${o.t.texto}`,
        caja: [
          Math.min(cur.caja[0], o.t.caja[0]),
          Math.min(cur.caja[1], o.t.caja[1]),
          Math.max(cur.caja[2], o.t.caja[2]),
          Math.max(cur.caja[3], o.t.caja[3]),
        ],
        tamano: Math.max(cur.tamano, o.t.tamano),
        dir: cur.dir,
      };
      fin = Math.max(fin, o.p.fin);
    }
    out.push(cur);
  }
  return out;
}

/* ---- escala del cajetín ------------------------------------------------------- */

export type EscalaTexto = { tipo: 'ninguna' } | { tipo: 'una'; n: number } | { tipo: 'varias'; ns: number[] };

/** Rango de escalas que se leen (el mismo de la plausibilidad, §2). */
const N_MIN = 1;
const N_MAX = 5000;
/** Sin «E» ni «ESCALA» delante, «1/2» o «1:5» son fracciones o pendientes. */
const N_MIN_SIN_PREFIJO = 10;

// «ESCALA 1:50», «ESC. 1/100», «E: 1:20», «1:50»… El «1» no puede ir pegado a
// otra cifra (ni a «/», «.» o «,»: fechas) y la N no puede seguir con más cifras.
const RE_ESCALA = /(?:\b(ESCALA|ESC|E)\.?\s*:?\s*)?(?<![\d/.,:])1\s*[:/]\s*(\d{1,5}(?:[.,]\d{1,2})?)(?![\d]|[/.,:]\d)/giu;

/** Escalas «1:N» del texto de una página: ninguna, una o varias (distintas). */
export function escalaDeclarada(textos: readonly TextoPagina[]): EscalaTexto {
  const ns = new Set<number>();
  for (const t of unirContiguos(textos))
    for (const m of t.texto.matchAll(RE_ESCALA)) {
      const n = Number(m[2]!.replace(',', '.'));
      const minimo = m[1] ? N_MIN : N_MIN_SIN_PREFIJO;
      if (Number.isFinite(n) && n >= minimo && n <= N_MAX) ns.add(n);
    }
  if (ns.size === 0) return { tipo: 'ninguna' };
  if (ns.size === 1) return { tipo: 'una', n: [...ns][0]! };
  return { tipo: 'varias', ns: [...ns].sort((a, b) => a - b) };
}

/** Desviación (fracción) entre la escala calibrada y la declarada. */
export function desviacionCajetin(nCalibrada: number, nDeclarada: number): number {
  return nDeclarada > 0 ? Math.abs(nCalibrada - nDeclarada) / nDeclarada : Infinity;
}

/** La escala calibrada de una `Escala` (la de su cota), con su «1:N». */
export function escalaCalibrada(e: Pick<Escala, 'ref'>, userUnit = 1): { mPorUnidad: number; n: number } {
  const m = mPorUnidadDeCota(e.ref.a, e.ref.b, e.ref.metros);
  return { mPorUnidad: m, n: escalaN(m, userUnit) };
}

/**
 * La misma calibración ajustada a la escala del cajetín (`ajustada`) o con la
 * de su cota («Usar la calibrada»). `rev` nueva: cambia `mPorUnidad`, y las
 * líneas de la página pasan por el recálculo. null si no hay escala declarada.
 */
export function escalaConAjuste(e: Escala, ajustada: boolean, userUnit: number, rev: string, at: string): Escala | null {
  const declarada = e.escalaDeclarada;
  if (!declarada || !(declarada > 0)) return null;
  const cal = escalaCalibrada(e, userUnit);
  const out: Escala = JSON.parse(JSON.stringify(e)) as Escala;
  out.rev = rev;
  out.at = at;
  if (ajustada) {
    out.mPorUnidad = mPorUnidadDeEscala(declarada, userUnit);
    out.n = declarada;
    out.ajustada = true;
  } else {
    out.mPorUnidad = cal.mPorUnidad;
    out.n = cal.n;
    delete out.ajustada;
  }
  return out;
}

/* ---- etiqueta propuesta ------------------------------------------------------ */

const sinAcentos = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();

const ORDINALES: Record<string, string> = {
  PRIMERA: '1',
  SEGUNDA: '2',
  TERCERA: '3',
  CUARTA: '4',
  QUINTA: '5',
  SEXTA: '6',
};

/** Rótulo corto de una planta nombrada en un texto, o null. */
function rotuloDePlanta(texto: string): string | null {
  const t = sinAcentos(texto);
  if (/\bSEMISOTANO\b/.test(t)) return 'SS';
  const sot = t.match(/\bSOTANO(?:\s*-?\s*(\d))?\b/);
  if (sot) return sot[1] ? `S${sot[1]}` : 'PS';
  if (/\bPLANTA\s+BAJA\b/.test(t)) return 'PB';
  if (/\bENTREPLANTA\b/.test(t)) return 'EP';
  const ord = t.match(/\bPLANTA\s+(PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA|(\d)\s*[ªºA]?)\b/);
  if (ord) return `P${ord[2] ?? ORDINALES[ord[1]!]}`;
  if (/\bATICO\b/.test(t)) return 'AT';
  if (/\bCUBIERTA\b/.test(t)) return 'CUB';
  return null;
}

/**
 * Etiqueta propuesta para la página («Esta página es: [PB]»): la planta del
 * título más grande. Si los títulos del mismo tamaño nombran plantas
 * distintas, ninguna.
 */
export function etiquetaPropuesta(textos: readonly TextoPagina[]): string | null {
  let mejor: { rotulo: string; tamano: number } | null = null;
  let empate = false;
  for (const t of unirContiguos(textos)) {
    const r = rotuloDePlanta(t.texto);
    if (!r) continue;
    if (!mejor || t.tamano > mejor.tamano + 0.1) {
      mejor = { rotulo: r, tamano: t.tamano };
      empate = false;
    } else if (Math.abs(t.tamano - mejor.tamano) <= 0.1 && r !== mejor.rotulo) empate = true;
  }
  return mejor && !empate ? mejor.rotulo : null;
}

/* ---- comentario propuesto -------------------------------------------------------- */

/** ¿Punto dentro del polígono? (par-impar) */
export function dentroDe(p: Punto, poligono: readonly Punto[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i]!;
    const [xj, yj] = poligono[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Cifras y medidas: cotas («3,45», «+64.05»), superficies («SUP. ÚTIL: 13,74m2»). */
function esCifra(texto: string): boolean {
  const t = sinAcentos(texto).trim();
  const letras = t.replace(/[^A-Z]/g, '');
  if (letras.length < 2) return true;
  if (/\d[.,]\d/.test(t)) return true;
  if (/\bM\s*[23²³]\b|\bM[²³]/.test(t)) return true;
  return /^\W*(SUP|S\.?\s?U|SUPERFICIE)\b/.test(t);
}

/** «DORMITORIO 2» → «Dormitorio 2»; el texto con minúsculas se deja como está. */
function aFrase(texto: string): string {
  const t = texto.replace(/\s+/g, ' ').trim();
  if (t !== t.toUpperCase()) return t;
  const bajo = t.toLocaleLowerCase('es');
  return bajo.charAt(0).toLocaleUpperCase('es') + bajo.slice(1);
}

/**
 * Comentario propuesto para una Superficie o un Rectángulo: el texto de la
 * página dentro del polígono con la letra más grande que no sea una cifra; a
 * igual tamaño, el más cercano al centro. null si no hay ninguno.
 */
export function comentarioPropuesto(textos: readonly TextoPagina[], poligono: readonly Punto[]): string | null {
  if (poligono.length < 3) return null;
  const c: Punto = [
    poligono.reduce((s, p) => s + p[0], 0) / poligono.length,
    poligono.reduce((s, p) => s + p[1], 0) / poligono.length,
  ];
  let mejor: { texto: string; tamano: number; d: number } | null = null;
  for (const t of unirContiguos(textos)) {
    const m = centro(t.caja);
    if (!dentroDe(m, poligono) || esCifra(t.texto)) continue;
    const d = dist(m, c);
    if (!mejor || t.tamano > mejor.tamano + 0.1 || (Math.abs(t.tamano - mejor.tamano) <= 0.1 && d < mejor.d))
      mejor = { texto: t.texto, tamano: t.tamano, d };
  }
  return mejor ? aFrase(mejor.texto) : null;
}

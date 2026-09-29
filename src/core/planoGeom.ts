/* ===========================================================================
   core/planoGeom — geometría y calibración de un plano (medir sobre planos PDF).
   Especificación · Etapa A, §2 (docs/plan-medir-planos-pdf.md).

   Todo en COORDENADAS DE PÁGINA: el espacio de usuario del PDF, con la y hacia
   arriba y SIN rotar (independiente del zoom y de /Rotate). La pantalla solo
   entra por `pxPorUnidad` (umbrales en píxeles) y por las transformaciones
   pantalla ↔ página, que viven aquí y no en el adaptador de PDF.

   Redondeo (una sola regla para crear, recalcular y copiar):
   · los puntos se guardan redondeados a 0,01 unidades de página;
   · cada tramo, lado o altura es `round2` en metros;
   · un valor con `expr` es exactamente `evalEsExpr(expr)` de esos operandos;
   · el área de un polígono es `round2` del lazo.
   =========================================================================== */
import { parseEsNumber, round2 } from './money';
import type { Punto } from './types';

/** Caja en coordenadas de página: x0, y0, x1, y1. */
export type Caja = [number, number, number, number];
export type Rotacion = 0 | 90 | 180 | 270;

/* ---- cálculos --------------------------------------------------------------- */

export function dist(a: Punto, b: Punto): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Punto redondeado a 0,01 unidades de página (lo que se guarda). */
export function redondearPunto(p: Punto): Punto {
  const r = (v: number) => Math.round(v * 100) / 100 || 0; // sin «-0»
  return [r(p[0]), r(p[1])];
}

/** Longitud de una polilínea abierta, en unidades de página. */
export function longitudPolilinea(pts: readonly Punto[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1]!, pts[i]!);
  return s;
}

/** Perímetro CERRADO de un polígono (con el tramo de cierre), en unidades de página. */
export function perimetroCerrado(pts: readonly Punto[]): number {
  if (pts.length < 2) return 0;
  return longitudPolilinea(pts) + dist(pts[pts.length - 1]!, pts[0]!);
}

/** Área por la fórmula del lazo, en unidades² de página (siempre ≥ 0). */
export function areaLazo(pts: readonly Punto[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

/** Tramos en metros, cada uno `round2` (el operando de `expr`). */
export function tramosMetros(pts: readonly Punto[], mPorUnidad: number, cerrado: boolean): number[] {
  const t: number[] = [];
  for (let i = 1; i < pts.length; i++) t.push(round2(dist(pts[i - 1]!, pts[i]!) * mPorUnidad));
  if (cerrado && pts.length > 1) t.push(round2(dist(pts[pts.length - 1]!, pts[0]!) * mPorUnidad));
  return t;
}

/** Área del polígono en m², `round2` del lazo. */
export function areaMetros(pts: readonly Punto[], mPorUnidad: number): number {
  return round2(areaLazo(pts) * mPorUnidad * mPorUnidad);
}

/** Lados de un rectángulo (4 esquinas en orden), en metros `round2`. */
export function ladosRectangulo(pts: readonly Punto[], mPorUnidad: number): { largo: number; ancho: number } {
  return {
    largo: round2(dist(pts[0]!, pts[1]!) * mPorUnidad),
    ancho: round2(dist(pts[1]!, pts[2]!) * mPorUnidad),
  };
}

/**
 * Rectángulo por tres clics: la arista con los dos primeros y la anchura con
 * el tercero, por proyección PERPENDICULAR a la arista (sirve en estancias
 * giradas). Devuelve las 4 esquinas en orden: a, b, b + w·n, a + w·n.
 */
export function rectanguloTresClics(a: Punto, b: Punto, c: Punto): [Punto, Punto, Punto, Punto] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return [a, b, b, a];
  const nx = -dy / len;
  const ny = dx / len;
  const w = (c[0] - b[0]) * nx + (c[1] - b[1]) * ny;
  return [a, b, [b[0] + w * nx, b[1] + w * ny], [a[0] + w * nx, a[1] + w * ny]];
}

/* ---- formateador de cifras de `expr` ---------------------------------------- */

/**
 * Cifra de una `expr`: coma decimal, sin separador de miles, sin notación
 * exponencial y sin ceros de cola («3,2», «25,515», «5»). UN solo formateador
 * para todo lo que escribe el plano (tramos, lados, altura).
 */
export function cifra(n: number): string {
  let s = n.toFixed(6);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (s === '-0') s = '0';
  return s.replace('.', ',');
}

/* ---- entrada segura ------------------------------------------------------- */

/** Un punto a menos de 4 px de pantalla del anterior se descarta. */
export const MIN_PX_ENTRE_PUNTOS = 4;
/** Anillo del primer vértice que cierra el polígono con un clic. */
export const ANILLO_CIERRE_PX = 8;

export function demasiadoCerca(a: Punto, b: Punto, pxPorUnidad: number): boolean {
  return dist(a, b) * pxPorUnidad < MIN_PX_ENTRE_PUNTOS;
}

export function sobrePrimerVertice(p: Punto, primero: Punto, pxPorUnidad: number): boolean {
  return dist(p, primero) * pxPorUnidad <= ANILLO_CIERRE_PX;
}

/** Orientación de c respecto a ab: >0 izquierda, <0 derecha, 0 colineal. */
function orient(a: Punto, b: Punto, c: Punto): number {
  const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const escala = Math.max(1, Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])) * Math.max(1, Math.abs(c[0] - a[0]) + Math.abs(c[1] - a[1]));
  return Math.abs(v) <= 1e-9 * escala ? 0 : v;
}

/** ¿c está sobre el segmento ab (sabiendo que son colineales)? */
function sobreSegmento(a: Punto, b: Punto, c: Punto): boolean {
  return (
    Math.min(a[0], b[0]) - 1e-9 <= c[0] &&
    c[0] <= Math.max(a[0], b[0]) + 1e-9 &&
    Math.min(a[1], b[1]) - 1e-9 <= c[1] &&
    c[1] <= Math.max(a[1], b[1]) + 1e-9
  );
}

/** ¿Se tocan los segmentos pq y rs (cruce, toque de vértice o solape colineal)? */
export function segmentosSeTocan(p: Punto, q: Punto, r: Punto, s: Punto): boolean {
  const o1 = orient(p, q, r);
  const o2 = orient(p, q, s);
  const o3 = orient(r, s, p);
  const o4 = orient(r, s, q);
  if (o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) return Math.sign(o1) !== Math.sign(o2) && Math.sign(o3) !== Math.sign(o4);
  return (
    (o1 === 0 && sobreSegmento(p, q, r)) ||
    (o2 === 0 && sobreSegmento(p, q, s)) ||
    (o3 === 0 && sobreSegmento(r, s, p)) ||
    (o4 === 0 && sobreSegmento(r, s, q))
  );
}

/**
 * ¿El tramo nuevo (del último vértice a `nuevo`) cruza la forma? Con
 * `cerrando`, además el tramo de cierre (de `nuevo`, o del último si `nuevo`
 * es null, al primero). Cuenta como cruce tocar un vértice, solaparse con un
 * tramo colineal y volver sobre el tramo anterior.
 */
export function cruzaLaForma(pts: readonly Punto[], nuevo: Punto | null, cerrando = false): boolean {
  const v = nuevo ? [...pts, nuevo] : [...pts];
  const n = v.length;
  if (n < 3) return false;
  // Tramos ya aceptados: [v_i, v_{i+1}] con i < n-2. El nuevo es [v_{n-2}, v_{n-1}].
  const nuevos: [number, number][] = [];
  if (nuevo) nuevos.push([n - 2, n - 1]);
  if (cerrando) nuevos.push([n - 1, 0]);
  const tramos: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) tramos.push([i, i + 1]);
  if (cerrando) tramos.push([n - 1, 0]);
  for (const [a, b] of nuevos) {
    for (const [c, d] of tramos) {
      if ((a === c && b === d) || (a === d && b === c)) continue;
      const comparten = a === c || a === d || b === c || b === d;
      const P = v[a]!;
      const Q = v[b]!;
      const R = v[c]!;
      const S = v[d]!;
      if (comparten) {
        // Adyacentes: solo es cruce si vuelven uno sobre otro (colineales solapados).
        const comun = a === c || a === d ? a : b;
        const otroNuevo = comun === a ? Q : P;
        const otroViejo = comun === c ? S : R;
        const C = v[comun]!;
        if (orient(C, otroNuevo, otroViejo) === 0) {
          const ux = otroNuevo[0] - C[0];
          const uy = otroNuevo[1] - C[1];
          const wx = otroViejo[0] - C[0];
          const wy = otroViejo[1] - C[1];
          if (ux * wx + uy * wy > 0) return true; // mismo sentido: se solapan
        }
        continue;
      }
      if (segmentosSeTocan(P, Q, R, S)) return true;
    }
  }
  return false;
}

/** Motivo por el que una forma no se puede cerrar, o `null` si vale. */
export type FormaInvalida = 'longitud-cero' | 'pocos-vertices' | 'area-cero';

export function formaInvalida(
  herramienta: 'longitud' | 'superficie' | 'rectangulo' | 'recuento',
  pts: readonly Punto[],
): FormaInvalida | null {
  switch (herramienta) {
    case 'recuento':
      return pts.length >= 1 ? null : 'pocos-vertices';
    case 'longitud':
      return pts.length >= 2 && longitudPolilinea(pts) > 0 ? null : 'longitud-cero';
    case 'superficie':
      if (pts.length < 3) return 'pocos-vertices';
      return areaLazo(pts) > 0 ? null : 'area-cero';
    case 'rectangulo':
      if (pts.length !== 4) return 'pocos-vertices';
      return areaLazo(pts) > 0 ? null : 'area-cero';
  }
}

/**
 * Mayús fuerza 0/45/90°: proyecta `p` sobre la dirección múltiplo de 45° más
 * cercana desde `desde`. En coordenadas de página vale para cualquier /Rotate:
 * un giro de 90° lleva las direcciones de 45° a direcciones de 45°, así que lo
 * horizontal en pantalla sigue siendo horizontal en pantalla.
 */
export function ajustar45(desde: Punto, p: Punto): Punto {
  const dx = p[0] - desde[0];
  const dy = p[1] - desde[1];
  if (dx === 0 && dy === 0) return p;
  const paso = Math.PI / 4;
  const ang = Math.round(Math.atan2(dy, dx) / paso) * paso;
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const l = dx * ux + dy * uy;
  const limpia = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
  return [desde[0] + limpia(l * ux), desde[1] + limpia(l * uy)];
}

/* ---- pantalla ↔ página ------------------------------------------------------ */

/**
 * Cómo se ve una página: su caja visible (CropBox, sin rotar), su /Rotate y
 * cuántos píxeles de lienzo mide una unidad de página. El lienzo tiene el
 * origen arriba a la izquierda (misma convención que el viewport de pdf.js).
 */
export interface VistaPagina {
  caja: Caja;
  rotacion: Rotacion;
  pxPorUnidad: number;
}

/** Tamaño del lienzo de la página entera, en px. */
export function tamanoLienzo(v: VistaPagina): [number, number] {
  const [x0, y0, x1, y1] = v.caja;
  const w = Math.abs(x1 - x0) * v.pxPorUnidad;
  const h = Math.abs(y1 - y0) * v.pxPorUnidad;
  return v.rotacion === 90 || v.rotacion === 270 ? [h, w] : [w, h];
}

export function paginaALienzo(p: Punto, v: VistaPagina): [number, number] {
  const [x0, y0, x1, y1] = v.caja;
  const s = v.pxPorUnidad;
  const [x, y] = p;
  switch (v.rotacion) {
    case 0:
      return [s * (x - x0), s * (y1 - y)];
    case 90:
      return [s * (y - y0), s * (x - x0)];
    case 180:
      return [s * (x1 - x), s * (y - y0)];
    case 270:
      return [s * (y1 - y), s * (x1 - x)];
  }
}

export function lienzoAPagina(q: [number, number], v: VistaPagina): Punto {
  const [x0, y0, x1, y1] = v.caja;
  const s = v.pxPorUnidad;
  const [a, b] = q;
  switch (v.rotacion) {
    case 0:
      return [x0 + a / s, y1 - b / s];
    case 90:
      return [x0 + b / s, y0 + a / s];
    case 180:
      return [x1 - a / s, y0 + b / s];
    case 270:
      return [x1 - b / s, y1 - a / s];
  }
}

/** Caja de página que cubre un rectángulo del lienzo (para pintar solo lo visible). */
export function regionDeLienzo(
  r: { x: number; y: number; w: number; h: number },
  v: VistaPagina,
): Caja {
  const a = lienzoAPagina([r.x, r.y], v);
  const b = lienzoAPagina([r.x + r.w, r.y + r.h], v);
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}

/* ---- calibración ------------------------------------------------------------ */

/** Desviación admitida entre la cota y la comprobación (fracción) cuando los
 *  clics son precisos; con cotas cortas se admite su imprecisión, hasta
 *  `DESVIACION_TOPE`. También: cuándo la calibración cuadra con el cajetín. */
export const DESVIACION_MAX = 0.01;
/** Por encima de esta imprecisión una cota no sirve (≈ 40 px en pantalla). */
export const DESVIACION_TOPE = 0.05;
/** Lo más lejos que se ajusta una calibración a una escala habitual (fracción). */
const AJUSTE_TOPE = 0.03;

/** Escalas habituales «1:N» (plausibilidad, §2). */
export const ESCALAS_HABITUALES = [
  1, 2, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000,
  2500, 5000,
] as const;

/** Metros por unidad de página que da una cota de `metros` entre a y b. */
export function mPorUnidadDeCota(a: Punto, b: Punto, metros: number): number {
  const d = dist(a, b);
  return d > 0 ? metros / d : NaN;
}

/** N de «1:N», con 1 decimal: mPorUnidad / (userUnit · 0,0254 / 72). */
export function escalaN(mPorUnidad: number, userUnit = 1): number {
  return Math.round((mPorUnidad / ((userUnit * 0.0254) / 72)) * 10) / 10;
}

/** Precisión (fracción) de un tramo a–b cuyos extremos se marcaron con `pxA` y
 *  `pxB` píxeles de pantalla por unidad de página: ±1 px en cada extremo, al
 *  zoom con que se marcó (acercar, marcar y alejar no la empeora). */
export function precisionTramo(a: Punto, b: Punto, pxA: number, pxB: number): number {
  const d = dist(a, b);
  return d > 0 && pxA > 0 && pxB > 0 ? (1 / pxA + 1 / pxB) / d : Infinity;
}

/** Desviación que se admite entre dos cotas de precisiones `p1` y `p2`. */
export function toleranciaComprobacion(p1: number, p2: number): number {
  return Math.min(DESVIACION_TOPE, Math.max(DESVIACION_MAX, p1 + p2));
}

/** La escala habitual (o la `declarada` del cajetín, que manda) a la que se
 *  ajusta «1:n» si está dentro de su imprecisión `precision`; null si ninguna.
 *  Quita el error del clic: un plano de CAD está a 1:50 exacto, no a 1:50,4. */
export function escalaParaAjustar(n: number, precision: number, declarada: number | null = null): number | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  const tol = Math.min(AJUSTE_TOPE, Math.max(0.005, precision));
  const cerca = (h: number) => Math.abs(n - h) / h <= tol;
  if (declarada && declarada > 0 && cerca(declarada)) return declarada;
  let mejor: number | null = null;
  for (const h of ESCALAS_HABITUALES)
    if (cerca(h) && (mejor === null || Math.abs(n - h) / h < Math.abs(n - mejor) / mejor)) mejor = h;
  return mejor;
}

/** La N de una escala tecleada: «100», «1:100», «1/100», «1:62,5». null si no
 *  es una escala de plano (fuera de 1:1–1:5000). */
export function leerEscalaTecleada(t: string): number | null {
  const m = /^\s*(?:1\s*[:/]\s*)?([\d.,]+)\s*$/.exec(t);
  const n = m ? parseEsNumber(m[1]!) : null;
  return n !== null && Number.isFinite(n) && n >= 1 && n <= 5000 ? n : null;
}

/** Tamaño físico de la página en mm (1 unidad = `userUnit`/72 pulgadas). */
export function tamanoPaginaMm(vista: Caja, userUnit = 1): { ancho: number; alto: number } {
  const k = (userUnit * 25.4) / 72;
  return { ancho: Math.abs(vista[2] - vista[0]) * k, alto: Math.abs(vista[3] - vista[1]) * k };
}

const FORMATOS_ISO: readonly [string, number, number][] = [
  ['A0', 841, 1189],
  ['A1', 594, 841],
  ['A2', 420, 594],
  ['A3', 297, 420],
  ['A4', 210, 297],
];

/** «A3» si la página es un formato ISO 216 (cualquier orientación, ±2 %); null si no. */
export function formatoPapel(anchoMm: number, altoMm: number): string | null {
  const [c, l] = anchoMm < altoMm ? [anchoMm, altoMm] : [altoMm, anchoMm];
  const f = FORMATOS_ISO.find(([, fc, fl]) => Math.abs(c - fc) / fc <= 0.02 && Math.abs(l - fl) / fl <= 0.02);
  return f ? f[0] : null;
}

/** Metros por unidad de página EXACTOS de «1:N» (1 unidad = `userUnit`/72 pulgadas). */
export function mPorUnidadDeEscala(n: number, userUnit = 1): number {
  return (n * userUnit * 0.0254) / 72;
}

/** Desviación (fracción) entre lo que da la comprobación con la escala y su valor real. */
export function desviacion(medidos: number, metros: number): number {
  return metros > 0 ? Math.abs(medidos - metros) / metros : Infinity;
}

/** ¿Es creíble «1:N» como escala de un plano? Solo pide confirmación: un PDF
 *  impreso «ajustado a la página» tiene escalas raras legítimas. */
export type Plausibilidad = 'ok' | 'rara' | 'fuera';

export function plausibilidad(n: number): Plausibilidad {
  if (!Number.isFinite(n) || n < 1 || n > 5000) return 'fuera';
  return ESCALAS_HABITUALES.some((h) => Math.abs(n - h) / h <= 0.03) ? 'ok' : 'rara';
}

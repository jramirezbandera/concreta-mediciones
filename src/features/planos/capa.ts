/* ===========================================================================
   features/planos/capa — de las líneas medidas a las formas que pinta la capa
   del visor (§5.5), y la selección con Mano. Puro: sin React.
   =========================================================================== */
import { origenLegible } from '../../core/planoDatos';
import { esResta, lineaRetocada } from '../../core/planoMedida';
import type { Caja } from '../../core/planoGeom';
import type { Herramienta, MedLine, Punto } from '../../core/types';

export interface FormaCapa {
  lineId: string;
  /** Nº de la línea en su partida (insignia). */
  numero: number;
  formaId: string;
  herramienta: Herramienta;
  puntos: Punto[];
  resta: boolean;
  retocada: boolean;
}

/** Formas de una partida en una página de un plano. */
export function formasDeLineas(med: readonly MedLine[], planoId: string, pagina: number): FormaCapa[] {
  const out: FormaCapa[] = [];
  med.forEach((l, i) => {
    const o = l.origen;
    if (!origenLegible(o) || o.planoId !== planoId || o.pagina !== pagina) return;
    out.push({
      lineId: l.id,
      numero: i + 1,
      formaId: o.formaId,
      herramienta: o.herramienta,
      puntos: o.puntos,
      resta: esResta(l),
      retocada: lineaRetocada(l),
    });
  });
  return out;
}

/** Páginas de un plano con medidas de la partida, fuera de `pagina` (el vacío
 *  de la capa: «Esta partida tiene medidas en P2 y P3»). */
export function otrasPaginas(med: readonly MedLine[], planoId: string, pagina: number): number[] {
  const s = new Set<number>();
  for (const l of med) {
    const o = l.origen;
    if (origenLegible(o) && o.planoId === planoId && o.pagina !== pagina) s.add(o.pagina);
  }
  return [...s].sort((a, b) => a - b);
}

export function cajaDe(puntos: readonly Punto[]): Caja {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of puntos) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

function dentro(p: Punto, poli: readonly Punto[]): boolean {
  let d = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i]!;
    const [xj, yj] = poli[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

function distSegmento(p: Punto, a: Punto, b: Punto): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** ¿`p` toca la forma? Tolerancia en píxeles de pantalla. */
export function tocaForma(f: Pick<FormaCapa, 'herramienta' | 'puntos'>, p: Punto, pxPorUnidad: number, tol = 6): boolean {
  const t = tol / pxPorUnidad;
  if (f.herramienta === 'recuento') return f.puntos.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) <= t + 3 / pxPorUnidad);
  const pts = f.puntos;
  for (let i = 1; i < pts.length; i++) if (distSegmento(p, pts[i - 1]!, pts[i]!) <= t) return true;
  if (f.herramienta === 'longitud') return false;
  if (distSegmento(p, pts[pts.length - 1]!, pts[0]!) <= t) return true;
  return dentro(p, pts);
}

/** La forma bajo el cursor (la de encima: la última de la lista). */
export function formaEn(formas: readonly FormaCapa[], p: Punto, pxPorUnidad: number): FormaCapa | null {
  for (let i = formas.length - 1; i >= 0; i--) if (tocaForma(formas[i]!, p, pxPorUnidad)) return formas[i]!;
  return null;
}

/** Dónde va la insignia numerada de una forma: el centro de su caja para
 *  superficies, el primer punto para longitudes y recuentos. */
export function anclaInsignia(f: Pick<FormaCapa, 'herramienta' | 'puntos'>): Punto {
  if (f.herramienta === 'superficie' || f.herramienta === 'rectangulo') {
    const [x0, y0, x1, y1] = cajaDe(f.puntos);
    return [(x0 + x1) / 2, (y0 + y1) / 2];
  }
  return f.puntos[0]!;
}

/** Páginas que conviene precargar tras pintar `n`: las vecinas primero (se
 *  pasa de una a otra) y después las que tienen trabajo (escala o medidas), de
 *  la más cercana a la más lejana; como mucho `max`, sin `n` ni repetidas. */
export function paginasAPrecargar(n: number, paginas: number, conTrabajo: Iterable<number>, max: number): number[] {
  const out: number[] = [];
  const valida = (p: number) => Number.isInteger(p) && p >= 1 && p <= paginas && p !== n && !out.includes(p);
  for (const p of [n + 1, n - 1]) if (valida(p) && out.length < max) out.push(p);
  const resto = [...new Set(conTrabajo)].filter(valida).sort((a, b) => Math.abs(a - n) - Math.abs(b - n) || a - b);
  for (const p of resto) if (out.length < max) out.push(p);
  return out;
}

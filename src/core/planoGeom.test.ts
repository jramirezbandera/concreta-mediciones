import { describe, expect, it } from 'vitest';
import { evalEsExpr } from './expresion';
import {
  ajustar45,
  areaLazo,
  areaMetros,
  cifra,
  cruzaLaForma,
  demasiadoCerca,
  desviacion,
  dist,
  escalaN,
  formaInvalida,
  ladosRectangulo,
  lienzoAPagina,
  longitudPolilinea,
  mPorUnidadDeCota,
  paginaALienzo,
  perimetroCerrado,
  plausibilidad,
  escalaParaAjustar,
  precisionTramo,
  toleranciaComprobacion,
  rectanguloTresClics,
  redondearPunto,
  regionDeLienzo,
  sobrePrimerVertice,
  tamanoLienzo,
  tramosMetros,
  type Rotacion,
  type VistaPagina,
} from './planoGeom';
import type { Punto } from './types';
import a0 from '../test/fixtures/planos/obra-v6-a0.json';

const cerca = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(eps);

describe('cálculos', () => {
  it('distancia, polilínea, perímetro cerrado y lazo de un rectángulo 4 × 3', () => {
    const r: Punto[] = [
      [0, 0],
      [4, 0],
      [4, 3],
      [0, 3],
    ];
    expect(dist([0, 0], [3, 4])).toBe(5);
    expect(longitudPolilinea(r)).toBe(11);
    expect(perimetroCerrado(r)).toBe(14);
    expect(areaLazo(r)).toBe(12);
    expect(areaLazo([...r].reverse())).toBe(12); // el sentido no cambia el área
  });

  it('tramos en metros, cada uno round2', () => {
    expect(tramosMetros([[0, 0], [100, 0], [100, 50]], 0.0123, false)).toEqual([1.23, 0.62]);
    expect(tramosMetros([[0, 0], [100, 0], [100, 50]], 0.0123, true)).toEqual([1.23, 0.62, 1.38]);
  });

  it('rectángulo por tres clics: la arista con dos y la anchura con el tercero', () => {
    const [a, b, c, d] = rectanguloTresClics([0, 0], [10, 0], [7, 4]);
    expect([a, b]).toEqual([
      [0, 0],
      [10, 0],
    ]);
    cerca(c[0], 10);
    cerca(c[1], 4);
    cerca(d[0], 0);
    cerca(d[1], 4);
  });

  it('rectángulo por tres clics también en una estancia girada 30°', () => {
    const g = Math.PI / 6;
    const rot = ([x, y]: Punto): Punto => [x * Math.cos(g) - y * Math.sin(g), x * Math.sin(g) + y * Math.cos(g)];
    const r = rectanguloTresClics(rot([0, 0]), rot([5, 0]), rot([3.3, 4]));
    const { largo, ancho } = ladosRectangulo(r, 1);
    expect(largo).toBe(5);
    expect(ancho).toBe(4);
    cerca(areaLazo(r), 20, 1e-9);
  });

  it('el área no cambia con giros ni traslaciones (propiedad, 200 polígonos)', () => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let k = 0; k < 200; k++) {
      // polígono estrellado alrededor de un centro: siempre simple
      const n = 3 + Math.floor(rnd() * 8);
      const pts: Punto[] = [];
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * 2 * Math.PI;
        const r = 10 + rnd() * 90;
        pts.push([r * Math.cos(ang), r * Math.sin(ang)]);
      }
      const g = rnd() * 2 * Math.PI;
      const tx = rnd() * 1000 - 500;
      const ty = rnd() * 1000 - 500;
      const movido = pts.map(([x, y]): Punto => [x * Math.cos(g) - y * Math.sin(g) + tx, x * Math.sin(g) + y * Math.cos(g) + ty]);
      cerca(areaLazo(movido), areaLazo(pts), 1e-6 * areaLazo(pts));
    }
  });

  it('puntos redondeados a 0,01 y sin «-0»', () => {
    expect(redondearPunto([1.23456, -0.001])).toEqual([1.23, 0]);
    expect(Object.is(redondearPunto([-0.001, 5])[0], -0)).toBe(false);
  });
});

describe('formateador de cifras de `expr`', () => {
  it('coma decimal, sin miles, sin exponente y sin ceros de cola', () => {
    expect(cifra(3.2)).toBe('3,2');
    expect(cifra(5)).toBe('5');
    expect(cifra(1234.5)).toBe('1234,5');
    expect(cifra(25.515)).toBe('25,515');
    expect(cifra(0.1 + 0.2)).toBe('0,3');
    expect(cifra(1e-9)).toBe('0');
    expect(cifra(-0)).toBe('0');
  });

  it('las `expr` del fixture A0 salen de cifras de tramos round2 y evalúan exactas', () => {
    type L = { id: string; origen?: { puntos: number[][]; mPorUnidad: number } };
    const lineas = Object.values(a0.partidas as unknown as Record<string, { med: L[] }[]>).flatMap((ps) =>
      ps.flatMap((p) => p.med),
    );
    const tab = lineas.find((l) => l.id === 'l-tabique')!;
    const o = tab.origen!;
    const t = tramosMetros(o.puntos as Punto[], o.mPorUnidad, false);
    expect(t.map(cifra).join('+')).toBe('3,2+4,15+2,1');
    expect(evalEsExpr('3,2+4,15+2,1')).toBe(9.45);
    // 3 decimales en «(tramos)×h»: viaja entero
    expect(evalEsExpr('(3,2+4,15+2,1)×2,7')).toBe(25.515);
  });
});

describe('entrada segura', () => {
  it('un punto a menos de 4 px del anterior se descarta; el anillo de cierre mide 8 px', () => {
    expect(demasiadoCerca([0, 0], [1.9, 0], 2)).toBe(true); // 3,8 px
    expect(demasiadoCerca([0, 0], [2, 0], 2)).toBe(false); // 4 px
    expect(sobrePrimerVertice([4, 0], [0, 0], 2)).toBe(true); // 8 px
    expect(sobrePrimerVertice([4.1, 0], [0, 0], 2)).toBe(false);
  });

  it('autocruce: un tramo que cruza la forma', () => {
    const pts: Punto[] = [
      [0, 0],
      [10, 0],
      [10, 10],
    ];
    expect(cruzaLaForma(pts, [0, 10])).toBe(false);
    expect(cruzaLaForma([...pts, [0, 10]], [5, -5])).toBe(true); // corta el primer tramo
  });

  it('autocruce: colineal solapado (volver sobre el tramo anterior o sobre otro)', () => {
    expect(cruzaLaForma([[0, 0], [10, 0]], [5, 0])).toBe(true); // vuelve encima del único tramo
    expect(cruzaLaForma([[0, 0], [10, 0], [10, 5]], [10, -1])).toBe(true); // vuelve sobre su tramo
    expect(cruzaLaForma([[0, 0], [10, 0], [10, 5], [5, 5]], [5, 0])).toBe(true); // toca el primer tramo en colineal
    expect(cruzaLaForma([[0, 0], [10, 0], [10, 5], [-5, 5]], [-5, 0])).toBe(false);
    expect(cruzaLaForma([[0, 0], [10, 0], [10, 5], [20, 5]], [20, 0])).toBe(false);
  });

  it('autocruce: un vértice que toca un tramo', () => {
    expect(cruzaLaForma([[0, 0], [10, 0], [10, 10], [5, 10]], [5, 0])).toBe(true);
  });

  it('autocruce: el tramo de cierre', () => {
    // ningún tramo dibujado se cruza, pero el de cierre (8,0)→(0,1) corta x = 4
    const pts: Punto[] = [
      [0, 1],
      [4, 0],
      [4, 10],
      [8, 10],
      [8, 0],
    ];
    for (let i = 3; i <= pts.length; i++) expect(cruzaLaForma(pts.slice(0, i - 1), pts[i - 1]!)).toBe(false);
    expect(cruzaLaForma(pts.slice(0, 3), null, true)).toBe(false);
    expect(cruzaLaForma(pts, null, true)).toBe(true);
    // cerrar a la vez que se añade el último punto (clic sobre el primero no añade)
    expect(cruzaLaForma(pts.slice(0, 4), [8, 0], true)).toBe(true);
    expect(cruzaLaForma([[0, 0], [10, 0], [10, 10], [0, 10]], null, true)).toBe(false);
  });

  it('formas degeneradas: longitud 0, menos de 3 vértices, área 0', () => {
    expect(formaInvalida('longitud', [[1, 1], [1, 1]])).toBe('longitud-cero');
    expect(formaInvalida('longitud', [[1, 1]])).toBe('longitud-cero');
    expect(formaInvalida('superficie', [[0, 0], [1, 0]])).toBe('pocos-vertices');
    expect(formaInvalida('superficie', [[0, 0], [1, 0], [2, 0]])).toBe('area-cero');
    expect(formaInvalida('superficie', [[0, 0], [1, 0], [1, 1]])).toBeNull();
    expect(formaInvalida('recuento', [])).toBe('pocos-vertices');
    expect(formaInvalida('recuento', [[0, 0]])).toBeNull();
  });

  it('Mayús fuerza 0/45/90° (proyección sobre la dirección más cercana)', () => {
    expect(ajustar45([0, 0], [10, 1])).toEqual([10, 0]);
    const d = ajustar45([0, 0], [10, 9]);
    cerca(d[0], d[1]);
    const v = ajustar45([0, 0], [0.5, -10]);
    expect(v[0]).toBe(0);
    cerca(v[1], -10);
  });

  it('Mayús con /Rotate 90: lo horizontal en pantalla sigue horizontal en pantalla', () => {
    const vista: VistaPagina = { caja: [0, 0, 842, 595], rotacion: 90, pxPorUnidad: 1.5 };
    const desde = lienzoAPagina([100, 200], vista);
    // el ratón va a la derecha y un poco abajo en pantalla
    const raton = lienzoAPagina([300, 212], vista);
    const p = ajustar45(desde, raton);
    const [, y0] = paginaALienzo(desde, vista);
    const [x1, y1] = paginaALienzo(p, vista);
    cerca(y1, y0, 1e-9);
    expect(x1).toBeGreaterThan(290);
  });
});

describe('pantalla ↔ página', () => {
  const rots: Rotacion[] = [0, 90, 180, 270];
  it.each(rots)('ida y vuelta con /Rotate %i y caja con origen ≠ 0', (rotacion) => {
    const vista: VistaPagina = { caja: [20, 30, 620, 430], rotacion, pxPorUnidad: 2 };
    for (const p of [
      [20, 30],
      [620, 430],
      [100.25, 311.5],
    ] as Punto[]) {
      const q = paginaALienzo(p, vista);
      const [w, h] = tamanoLienzo(vista);
      expect(q[0]).toBeGreaterThanOrEqual(-1e-9);
      expect(q[1]).toBeGreaterThanOrEqual(-1e-9);
      expect(q[0]).toBeLessThanOrEqual(w + 1e-9);
      expect(q[1]).toBeLessThanOrEqual(h + 1e-9);
      const r = lienzoAPagina(q, vista);
      cerca(r[0], p[0]);
      cerca(r[1], p[1]);
    }
  });

  it('sin rotar: la esquina superior izquierda de la página (y hacia arriba) es el origen del lienzo', () => {
    const vista: VistaPagina = { caja: [0, 0, 100, 50], rotacion: 0, pxPorUnidad: 1 };
    expect(paginaALienzo([0, 50], vista)).toEqual([0, 0]);
    expect(tamanoLienzo(vista)).toEqual([100, 50]);
    expect(tamanoLienzo({ ...vista, rotacion: 90 })).toEqual([50, 100]);
    // con /Rotate 90 la esquina superior izquierda sin rotar queda arriba a la derecha
    expect(paginaALienzo([0, 50], { ...vista, rotacion: 90 })).toEqual([50, 0]);
  });

  it('región de lienzo → caja de página', () => {
    const vista: VistaPagina = { caja: [0, 0, 100, 50], rotacion: 0, pxPorUnidad: 2 };
    expect(regionDeLienzo({ x: 0, y: 0, w: 20, h: 10 }, vista)).toEqual([0, 45, 10, 50]);
  });
});

describe('calibración', () => {
  it('cota → metros por unidad y «1:N» con userUnit', () => {
    const m = mPorUnidadDeCota([100, 700], [666.93, 700], 10);
    cerca(m, 0.017638861941, 1e-9);
    expect(escalaN(m)).toBe(50);
    expect(escalaN(m, 2)).toBe(25); // userUnit 2 dobla la unidad
  });

  it('precisión de un tramo: ±1 px en cada extremo, al zoom con que se marcó', () => {
    expect(precisionTramo([0, 0], [100, 0], 2, 2)).toBeCloseTo(0.01, 12); // 200 px
    expect(precisionTramo([0, 0], [100, 0], 2, 10)).toBeCloseTo(0.006, 12);
    expect(precisionTramo([0, 0], [0, 0], 2, 2)).toBe(Infinity);
  });

  it('tolerancia de la comprobación: la suma de precisiones, entre el 1 % y el 5 %', () => {
    expect(toleranciaComprobacion(0.002, 0.003)).toBe(0.01);
    expect(toleranciaComprobacion(0.01, 0.015)).toBeCloseTo(0.025, 12);
    expect(toleranciaComprobacion(0.03, 0.03)).toBe(0.05);
  });

  it('escala para ajustar: la habitual (o la declarada) dentro de la precisión', () => {
    expect(escalaParaAjustar(50.4, 0.01)).toBe(50);
    expect(escalaParaAjustar(50.2, 0.002)).toBe(50); // 0,5 % mínimo
    expect(escalaParaAjustar(51, 0.002)).toBeNull();
    expect(escalaParaAjustar(47, 0.01)).toBeNull();
    expect(escalaParaAjustar(47, 0.1)).toBeNull(); // tope 3 %: 50 queda a 6 %
    expect(escalaParaAjustar(63.7, 0.01, 64)).toBe(64); // la del cajetín manda
    expect(escalaParaAjustar(Number.NaN, 0.01)).toBeNull();
  });

  it('desviación entre comprobación y valor real', () => {
    expect(desviacion(6.03, 6)).toBeCloseTo(0.005, 10);
    expect(desviacion(6, 0)).toBe(Infinity);
  });

  it('plausibilidad: fuera de rango, rara y habitual', () => {
    expect(plausibilidad(5_000_000)).toBe('fuera');
    expect(plausibilidad(0.5)).toBe('fuera');
    expect(plausibilidad(63.5)).toBe('rara');
    expect(plausibilidad(30)).toBe('ok');
    expect(plausibilidad(49.7)).toBe('ok'); // a menos de un 3 % de 1:50
    expect(plausibilidad(5000)).toBe('ok');
  });

  it('las escalas del fixture A0 salen de su cota', () => {
    const e = a0.planos[0]!.escalas['1'];
    const m = mPorUnidadDeCota(e.ref.a as Punto, e.ref.b as Punto, e.ref.metros);
    cerca(m, e.mPorUnidad, 1e-9);
    expect(areaMetros([[0, 0], [10, 0], [10, 10], [0, 10]], 1)).toBe(100);
  });
});

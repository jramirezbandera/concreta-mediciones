/* Texto de la página (§2 cajetín, §3.5 comentario propuesto, etiqueta): los
   casos de §12 y otros sacados de planos reales. */
import { describe, expect, it } from 'vitest';
import { escalaN } from './planoGeom';
import {
  comentarioPropuesto,
  dentroDe,
  desviacionCajetin,
  escalaDeclarada,
  etiquetaPropuesta,
  mPorUnidadDeEscala,
  unirContiguos,
  type TextoPagina,
} from './planoTexto';
import type { Punto } from './types';

/** Texto horizontal en (x, y) de tamaño `t` (caja aproximada: media letra por carácter). */
const tx = (texto: string, x: number, y: number, t = 10): TextoPagina => ({
  texto,
  caja: [x, y, x + 0.5 * t * texto.length, y + t],
  tamano: t,
  dir: [1, 0],
});

describe('unirContiguos', () => {
  it('une los fragmentos seguidos de una misma línea y respeta los huecos', () => {
    const r = unirContiguos([tx('50', 118, 100), tx('E', 100, 100), tx('1:', 108, 100)]);
    expect(r.map((t) => t.texto)).toEqual(['E 1:50']);
  });

  it('no une líneas distintas, tamaños muy distintos ni textos lejanos', () => {
    const r = unirContiguos([tx('DORMITORIO 2', 100, 100, 4), tx('SUP. ÚTIL: 13,74m2', 100, 94.6, 4), tx('ACERA', 160, 100, 4)]);
    expect(r.map((t) => t.texto).sort()).toEqual(['ACERA', 'DORMITORIO 2', 'SUP. ÚTIL: 13,74m2']);
    expect(unirContiguos([tx('PLANTA', 100, 100, 10), tx('1', 131, 100, 3)]).map((t) => t.texto)).toHaveLength(2);
  });

  it('texto vertical (página girada): une a lo largo de su dirección', () => {
    const v = (texto: string, y: number): TextoPagina => ({ texto, caja: [200, y, 210, y + 5 * texto.length], tamano: 10, dir: [0, 1] });
    expect(unirContiguos([v('1:', 110), v('ESCALA', 78)]).map((t) => t.texto)).toEqual(['ESCALA 1:']);
  });
});

describe('escalaDeclarada', () => {
  it('«E 1:50», «ESCALA 1/50», «1:100», «ESC. 1:20» y «E: 1/75»', () => {
    for (const [t, n] of [
      ['E 1:50', 50],
      ['ESCALA 1/50', 50],
      ['1:100', 100],
      ['ESC. 1:20', 20],
      ['E: 1/75', 75],
      ['Escala 1:2', 2],
    ] as const)
      expect(escalaDeclarada([tx(t, 0, 0)])).toEqual({ tipo: 'una', n });
  });

  it('textos contiguos unidos: «ESCALA» «1» «:» «100»', () => {
    expect(escalaDeclarada([tx('ESCALA', 0, 0), tx('1', 33, 0), tx(':', 38, 0), tx('100', 43, 0)])).toEqual({ tipo: 'una', n: 100 });
  });

  it('descarta fechas, fracciones y pendientes sueltas', () => {
    for (const t of ['12/01/2025', '1/2', '1/12/2025', 'FECHA 01/10', 'Pendiente 1:5', '11/1/2020', 'FASE 1:2'])
      expect(escalaDeclarada([tx(t, 0, 0)]), t).toEqual({ tipo: 'ninguna' });
  });

  it('dos escalas distintas: «varias» (ni comprobación ni ajuste); la misma repetida es una', () => {
    expect(escalaDeclarada([tx('E 1:50', 0, 0), tx('DETALLE E 1:20', 0, 100)])).toEqual({ tipo: 'varias', ns: [20, 50] });
    expect(escalaDeclarada([tx('E 1:50', 0, 0), tx('1:50', 0, 100)])).toEqual({ tipo: 'una', n: 50 });
    expect(escalaDeclarada([])).toEqual({ tipo: 'ninguna' });
  });
});

describe('cajetín frente a la calibración', () => {
  it('dos puntos a 1:49,7 con «E 1:50»: a menos del 1 %, se ajusta a la exacta', () => {
    const m = mPorUnidadDeEscala(49.7);
    const n = escalaN(m);
    expect(n).toBe(49.7);
    expect(desviacionCajetin(n, 50)).toBeLessThan(0.01);
    expect(escalaN(mPorUnidadDeEscala(50))).toBe(50);
  });

  it('a 1:47 solo avisa (más del 1 %)', () => {
    expect(desviacionCajetin(47, 50)).toBeGreaterThan(0.01);
  });

  it('`userUnit` 2 dobla la unidad: la misma «1:50» son el doble de metros por unidad', () => {
    expect(mPorUnidadDeEscala(50, 2)).toBeCloseTo(2 * mPorUnidadDeEscala(50), 12);
    expect(escalaN(mPorUnidadDeEscala(50, 2), 2)).toBe(50);
  });
});

describe('etiquetaPropuesta', () => {
  it('la planta del título más grande', () => {
    expect(etiquetaPropuesta([tx('PLANTA BAJA. COTAS Y SUPERFICIES', 0, 0, 8.7), tx('SALIDA DE PLANTA', 0, 100, 3.5)])).toBe('PB');
    expect(etiquetaPropuesta([tx('PLANTA SÓTANO. COTAS Y SUPERFICIES', 0, 0, 8.7)])).toBe('PS');
    expect(etiquetaPropuesta([tx('CUBIERTA. COTAS Y SUPERFICIES', 0, 0, 8.7), tx('PLANTA CUBIERTA', 0, 50, 7.9)])).toBe('CUB');
    expect(etiquetaPropuesta([tx('Planta primera', 0, 0)])).toBe('P1');
    expect(etiquetaPropuesta([tx('PLANTA 2ª', 0, 0)])).toBe('P2');
    expect(etiquetaPropuesta([tx('SÓTANO -1', 0, 0)])).toBe('S1');
    expect(etiquetaPropuesta([tx('Planta ático', 0, 0)])).toBe('AT');
  });

  it('sin planta, o dos plantas distintas del mismo tamaño: ninguna', () => {
    expect(etiquetaPropuesta([tx('ALZADO ESTE Y OESTE', 0, 0)])).toBeNull();
    expect(etiquetaPropuesta([tx('PLANTA BAJA', 0, 0), tx('PLANTA PRIMERA', 0, 100)])).toBeNull();
    expect(etiquetaPropuesta([])).toBeNull();
  });
});

describe('comentarioPropuesto', () => {
  const caja = (x0: number, y0: number, x1: number, y1: number): Punto[] => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  // Un dormitorio como en un plano real: su nombre y su superficie, del mismo tamaño.
  const textos = [
    tx('DORMITORIO 2', 519.1, 648.4, 4),
    tx('SUP. ÚTIL: 13,74m2', 516, 643, 4),
    tx('3,45', 530, 700, 7),
    tx('BAÑO 2', 552.4, 615, 4),
  ];

  it('el texto dentro del polígono que no es una cifra, en frase', () => {
    expect(comentarioPropuesto(textos, caja(500, 630, 545, 680))).toBe('Dormitorio 2');
  });

  it('fuera del polígono no cuenta; una cifra sola tampoco; sin texto, ninguno', () => {
    expect(comentarioPropuesto(textos, caja(0, 0, 100, 100))).toBeNull();
    expect(comentarioPropuesto([tx('3,45', 530, 700, 7), tx('+64.05', 530, 690, 9)], caja(500, 680, 600, 720))).toBeNull();
    expect(comentarioPropuesto([], caja(0, 0, 10, 10))).toBeNull();
  });

  it('a igual tamaño gana el más cercano al centro; uno más grande gana siempre', () => {
    const r = [tx('COCINA', 100, 100, 4), tx('ASEO', 180, 180, 4)];
    expect(comentarioPropuesto(r, caja(90, 90, 170, 170))).toBe('Cocina');
    expect(comentarioPropuesto([...r, tx('VIVIENDA 1', 150, 150, 7.9)], caja(90, 90, 250, 250))).toBe('Vivienda 1');
  });

  it('un texto con minúsculas se deja como está', () => {
    expect(comentarioPropuesto([tx('Salón - comedor', 100, 100, 4)], caja(90, 90, 170, 170))).toBe('Salón - comedor');
  });

  it('dentroDe: par-impar, también en un polígono cóncavo', () => {
    const L: Punto[] = [
      [0, 0],
      [10, 0],
      [10, 4],
      [4, 4],
      [4, 10],
      [0, 10],
    ];
    expect(dentroDe([2, 8], L)).toBe(true);
    expect(dentroDe([8, 8], L)).toBe(false);
  });
});

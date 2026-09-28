/* Selección de la capa y páginas a precargar (puro). */
import { describe, expect, it } from 'vitest';
import { paginasAPrecargar } from './capa';

describe('paginasAPrecargar', () => {
  it('las vecinas primero y luego las que tienen trabajo, de la más cercana a la más lejana', () => {
    expect(paginasAPrecargar(10, 35, [27, 3, 12, 11], 5)).toEqual([11, 9, 12, 3, 27]);
  });

  it('sin la actual, sin repetidas, dentro del plano y con tope', () => {
    expect(paginasAPrecargar(1, 3, [1, 2, 2, 3, 0, 9, 2.5], 5)).toEqual([2, 3]);
    expect(paginasAPrecargar(5, 35, [20, 30, 33], 2)).toEqual([6, 4]);
    expect(paginasAPrecargar(1, 1, [1], 5)).toEqual([]);
  });

  it('a igual distancia, primero la anterior en el documento', () => {
    expect(paginasAPrecargar(10, 35, [14, 6], 4)).toEqual([11, 9, 6, 14]);
  });
});

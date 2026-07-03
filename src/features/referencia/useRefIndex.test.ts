import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RefSource } from '../../core/refdata';
import { REF_SEARCH_CAP, useRefIndex } from './useRefIndex';

/**
 * Fuente sintética de 2 capítulos: el capítulo A tiene una partida DIRECTA y otra
 * dentro de un subcapítulo (A.01); el capítulo B, una directa. Cubre el agrupado
 * por contenedor inmediato y el recuento de subárbol de la lógica de `useRefIndex`
 * (antes solo cubierta indirectamente por Referencia.test.tsx).
 */
const SOURCE: RefSource = {
  id: 'src-test',
  kind: 'base',
  name: 'Fuente de prueba',
  org: 'Test',
  chapters: [
    {
      id: 'A',
      code: '1',
      title: 'CAP UNO',
      children: [{ id: 'A.01', code: '1.1', title: 'SUB UNO', children: [] }],
    },
    { id: 'B', code: '2', title: 'CAP DOS', children: [] },
  ],
  partidas: {
    A: [
      { id: 'pA1', pos: '1.1', code: 'AAA100', title: 'Zapata de hormigón', ud: 'm3', precio: 10, items: [] },
      { id: 'pAs1', sub: 'A.01', pos: '1.1.1', code: 'BBB200', title: 'Muro de bloque', ud: 'm2', precio: 5, items: [] },
    ],
    B: [{ id: 'pB1', pos: '2.1', code: 'CCC300', title: 'Excavación en zanja', ud: 'm3', precio: 7, items: [] }],
  },
};

describe('useRefIndex', () => {
  it('agrupa las partidas por su contenedor INMEDIATO (sub o capítulo)', () => {
    const { result } = renderHook(() => useRefIndex(SOURCE, ''));
    const { bySub } = result.current;
    expect(bySub.get('A')?.map((p) => p.id)).toEqual(['pA1']); // directa del capítulo
    expect(bySub.get('A.01')?.map((p) => p.id)).toEqual(['pAs1']); // dentro del sub
    expect(bySub.get('B')?.map((p) => p.id)).toEqual(['pB1']);
  });

  it('cuenta las partidas del subárbol de cada contenedor', () => {
    const { result } = renderHook(() => useRefIndex(SOURCE, ''));
    const { subtreeCount } = result.current;
    expect(subtreeCount.get('A')).toBe(2); // directa + la del sub
    expect(subtreeCount.get('A.01')).toBe(1);
    expect(subtreeCount.get('B')).toBe(1);
  });

  it('no busca por debajo de MIN_QUERY (query vacío o de 1 carácter)', () => {
    const vacio = renderHook(() => useRefIndex(SOURCE, '')).result.current;
    expect(vacio.searching).toBe(false);
    expect(vacio.search.matches).toHaveLength(0);

    const corto = renderHook(() => useRefIndex(SOURCE, 'm')).result.current;
    expect(corto.searching).toBe(false);
    expect(corto.search.matches).toHaveLength(0);
  });

  it('busca por título y adjunta la ruta del subcapítulo', () => {
    const { result } = renderHook(() => useRefIndex(SOURCE, 'muro'));
    expect(result.current.searching).toBe(true);
    const { matches, truncated } = result.current.search;
    expect(matches.map((m) => m.p.id)).toEqual(['pAs1']);
    expect(matches[0]!.path).toContain('SUB UNO'); // ruta del sub que la contiene
    expect(truncated).toBe(false);
  });

  it('busca por código además de por título', () => {
    const { result } = renderHook(() => useRefIndex(SOURCE, 'ccc300'));
    expect(result.current.search.matches.map((m) => m.p.id)).toEqual(['pB1']);
  });

  it('topa los resultados en REF_SEARCH_CAP y marca truncated', () => {
    const big: RefSource = {
      ...SOURCE,
      chapters: [{ id: 'Z', code: '9', title: 'MUCHAS', children: [] }],
      partidas: {
        Z: Array.from({ length: REF_SEARCH_CAP + 50 }, (_, i) => ({
          id: `z${i}`,
          pos: `9.${i + 1}`,
          code: `ZZ${i}`,
          title: `Partida zeta ${i}`,
          ud: 'ud',
          precio: 1,
          items: [],
        })),
      },
    };
    const { result } = renderHook(() => useRefIndex(big, 'zeta'));
    expect(result.current.search.matches).toHaveLength(REF_SEARCH_CAP);
    expect(result.current.search.truncated).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import type { Partida } from '../../core/types';
import { completeScope } from './completeScope';

function mkP(id: string, cantidad: number): Partida {
  return { id, pos: id, code: id, title: id, ud: 'u', precio: 1, cantidad, desc: '', med: [], items: [] };
}

describe('completeScope', () => {
  it('clasifica: rellenar / ya ≥100% / con líneas / saltada (ofertada 0)', () => {
    const ps = [mkP('a', 10), mkP('b', 10), mkP('c', 0), mkP('d', 10)];
    const curData = { a: 3, b: 10, d: 5 }; // a y d pendientes, b ya completa, c sin ofertada
    const lineQty = { d: { l1: 5 } }; // d se certifica por líneas
    const s = completeScope(ps, curData, lineQty);
    expect([...s.ids].sort()).toEqual(['a', 'd']); // solo las que cambian
    expect(s.fill).toBe(2);
    expect(s.already).toBe(1); // b
    expect(s.skipped).toBe(1); // c (ofertada 0)
    expect(s.withLines).toBe(1); // d
  });

  it('over-certificada (ejec > ofertada) cuenta como ya completa, no se toca', () => {
    const s = completeScope([mkP('a', 10)], { a: 12 }, undefined);
    expect(s.ids).toEqual([]);
    expect(s.already).toBe(1);
  });

  it('lista vacía → todo 0', () => {
    expect(completeScope([], {}, undefined)).toEqual({
      ids: [],
      fill: 0,
      already: 0,
      withLines: 0,
      skipped: 0,
    });
  });
});

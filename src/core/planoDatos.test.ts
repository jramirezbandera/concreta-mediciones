import { describe, expect, it } from 'vitest';
import a0 from '../test/fixtures/planos/obra-v6-a0.json';
import { huellasParaCopia } from './planoDatos';
import type { PartidasMap, PlanoMeta } from './types';

const base = a0 as unknown as { planos: PlanoMeta[]; partidas: PartidasMap };
const H = base.planos[0]!.huella;

describe('huellasParaCopia [A1]', () => {
  it('la del plano (una vez, aunque la usen sus 7 líneas)', () => {
    expect(huellasParaCopia(base)).toEqual([H]);
  });

  it('una línea medida con un PDF anterior añade su huella', () => {
    const partidas = structuredClone(base.partidas);
    const l = Object.values(partidas).flat().flatMap((p) => p.med).find((x) => x.origen)!;
    l.origen = { ...l.origen!, huella: 'f'.repeat(64) };
    expect(huellasParaCopia({ planos: base.planos, partidas })).toEqual([H, 'f'.repeat(64)]);
  });

  it('un plano quitado no va, ni las huellas de sus líneas', () => {
    const quitado = { ...base.planos[0]!, quitado: '2026-09-28T00:00:00.000Z' };
    expect(huellasParaCopia({ planos: [quitado], partidas: base.partidas })).toEqual([]);
  });

  it('datos ilegibles no rompen nada', () => {
    expect(huellasParaCopia({ planos: [{ id: 1 }, null], partidas: {} })).toEqual([]);
    expect(huellasParaCopia({ planos: 'x', partidas: {} })).toEqual([]);
  });
});

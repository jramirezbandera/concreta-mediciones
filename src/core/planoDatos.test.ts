import { describe, expect, it } from 'vitest';
import a0 from '../test/fixtures/planos/obra-v6-a0.json';
import { huellasEnCrudo, huellasEnUso } from './planoDatos';
import type { PartidasMap, PlanoMeta } from './types';

const base = a0 as unknown as { planos: PlanoMeta[]; partidas: PartidasMap };
const H = base.planos[0]!.huella;

describe('huellasEnUso [A1]', () => {
  it('la del plano (una vez, aunque la usen sus 7 líneas)', () => {
    expect(huellasEnUso(base)).toEqual([H]);
  });

  it('una línea medida con un PDF anterior añade su huella', () => {
    const partidas = structuredClone(base.partidas);
    const l = Object.values(partidas).flat().flatMap((p) => p.med).find((x) => x.origen)!;
    l.origen = { ...l.origen!, huella: 'f'.repeat(64) };
    expect(huellasEnUso({ planos: base.planos, partidas })).toEqual([H, 'f'.repeat(64)]);
  });

  it('un plano quitado no va, ni las huellas de sus líneas', () => {
    const quitado = { ...base.planos[0]!, quitado: '2026-09-28T00:00:00.000Z' };
    expect(huellasEnUso({ planos: [quitado], partidas: base.partidas })).toEqual([]);
  });

  it('datos ilegibles no rompen nada', () => {
    expect(huellasEnUso({ planos: [{ id: 1 }, null], partidas: {} })).toEqual([]);
    expect(huellasEnUso({ planos: 'x', partidas: {} })).toEqual([]);
  });
});

describe('huellasEnCrudo [A1]', () => {
  it('toda cadena con forma de huella, a cualquier profundidad y sin repetir', () => {
    const h1 = 'a'.repeat(64);
    const h2 = '0123456789abcdef'.repeat(4);
    const x = { planos: [{ huella: h1 }, { raro: [h2, { otra: h1 }] }], texto: 'A'.repeat(64), corta: 'abc' };
    expect(huellasEnCrudo(x).sort()).toEqual([h2, h1].sort());
    expect(huellasEnCrudo('no es nada')).toEqual([]);
  });

  it('lo apartado como ilegible cuenta en `huellasEnUso`', () => {
    expect(huellasEnUso({ planos: [], partidas: {}, _ilegible: [{ donde: 'planos[3]', valor: { huella: 'b'.repeat(64) } }] })).toEqual([
      'b'.repeat(64),
    ]);
  });
});

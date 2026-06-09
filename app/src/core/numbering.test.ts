import { describe, expect, it } from 'vitest';
import { renumberChapter } from './numbering';
import type { Chapter, Partida } from './types';

const partida = (id: string, sub?: string): Partida => ({
  id,
  sub,
  pos: '?',
  code: 'X',
  title: '',
  ud: 'ud',
  precio: 0,
  desc: '',
  med: [],
  items: [],
});

const chapter: Chapter = {
  id: '01',
  code: '1',
  title: 'Movimiento de tierras',
  children: [
    { id: '01.01', code: '1.1', title: 'Excavaciones' },
    { id: '01.02', code: '1.2', title: 'Rellenos' },
  ],
};

describe('renumberChapter', () => {
  it('numera por subcapítulo: base = código del sub + orden', () => {
    const out = renumberChapter(chapter, [
      partida('a', '01.01'),
      partida('b', '01.01'),
      partida('c', '01.02'),
    ]);
    expect(out.map((p) => p.pos)).toEqual(['1.1.1', '1.1.2', '1.2.1']);
  });

  it('partidas sin sub usan el código del capítulo', () => {
    const out = renumberChapter(chapter, [partida('a'), partida('b')]);
    expect(out.map((p) => p.pos)).toEqual(['1.1', '1.2']);
  });

  it('mezcla sub y sin-sub con contadores independientes', () => {
    const out = renumberChapter(chapter, [
      partida('a', '01.01'),
      partida('b'),
      partida('c', '01.01'),
    ]);
    expect(out.map((p) => p.pos)).toEqual(['1.1.1', '1.1', '1.1.2']);
  });

  it('capítulo sin children: base = código del capítulo aunque la partida tenga sub', () => {
    // sub 'x' no existe en el capítulo (sin children) → base cae al código del cap.
    const flat: Chapter = { id: '02', code: '2', title: 'Cimentación' };
    const out = renumberChapter(flat, [partida('a', 'x'), partida('b', 'x')]);
    expect(out.map((p) => p.pos)).toEqual(['2.1', '2.2']);
  });
});

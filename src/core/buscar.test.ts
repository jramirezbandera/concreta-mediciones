import { describe, expect, it } from 'vitest';
import type { Chapter, Partida, PartidasMap } from './types';
import { buildSearchIndex, searchPartidas } from './buscar';

/** Partida mínima con código/título/posición buscables. */
const P = (id: string, sub: string | undefined, code: string, title: string, pos = ''): Partida => ({
  id,
  sub,
  pos,
  code,
  title,
  ud: 'ud',
  precio: 10,
  cantidad: 1,
  desc: '',
  med: [],
  items: [],
});

/** Capítulo de 3 niveles: 01 → 01.01 (Sub) → 01.01.01 (SubSub). */
const chapters = (): Chapter[] => [
  {
    id: '01',
    code: '1',
    title: 'Movimiento de tierras',
    children: [
      {
        id: '01.01',
        code: '1.1',
        title: 'Excavaciones',
        children: [{ id: '01.01.01', code: '1.1.1', title: 'Zanjas' }],
      },
    ],
  },
  { id: '02', code: '2', title: 'Cimentación' },
];

const partidas = (): PartidasMap => ({
  '01': [
    P('p-deep', '01.01.01', 'E02AM010', 'Excavación en zanja a máquina', '1'),
    P('p-direct', undefined, 'D01ZZ010', 'Despeje y desbroce', '2'),
  ],
  '02': [P('p-huerf', 'no-existe', 'C01HM020', 'Hormigón de limpieza', '1')],
});

describe('buildSearchIndex', () => {
  it('obra vacía → []', () => {
    expect(buildSearchIndex([], {})).toEqual([]);
    expect(buildSearchIndex(chapters(), {})).toEqual([]);
  });

  it('resuelve la miga de una partida en sub anidado (capítulo correcto)', () => {
    const idx = buildSearchIndex(chapters(), partidas());
    const hit = idx.find((h) => h.p.id === 'p-deep')!;
    expect(hit.chapterId).toBe('01');
    expect(hit.subId).toBe('01.01.01');
    expect(hit.path.map((n) => n.code)).toEqual(['1', '1.1', '1.1.1']);
    expect(hit.path.at(-1)!.title).toBe('Zanjas');
  });

  it('partida directa del capítulo → subId null, miga sólo capítulo', () => {
    const idx = buildSearchIndex(chapters(), partidas());
    const hit = idx.find((h) => h.p.id === 'p-direct')!;
    expect(hit.subId).toBeNull();
    expect(hit.path.map((n) => n.code)).toEqual(['1']);
  });

  it('sub huérfano (p.sub inexistente) → se trata como directa del capítulo', () => {
    const idx = buildSearchIndex(chapters(), partidas());
    const hit = idx.find((h) => h.p.id === 'p-huerf')!;
    expect(hit.chapterId).toBe('02');
    expect(hit.subId).toBeNull();
    expect(hit.path.map((n) => n.code)).toEqual(['2']);
  });
});

describe('searchPartidas', () => {
  const idx = buildSearchIndex(chapters(), partidas());

  it('query < 2 caracteres → vacío', () => {
    expect(searchPartidas(idx, '')).toEqual({ hits: [], truncated: false });
    expect(searchPartidas(idx, 'e')).toEqual({ hits: [], truncated: false });
  });

  it('busca por título (case-insensitive)', () => {
    const r = searchPartidas(idx, 'EXCAV');
    expect(r.hits.map((h) => h.p.id)).toEqual(['p-deep']);
  });

  it('busca por código', () => {
    const r = searchPartidas(idx, 'd01zz');
    expect(r.hits.map((h) => h.p.id)).toEqual(['p-direct']);
  });

  it('respeta el tope y marca truncated', () => {
    const many: PartidasMap = {
      '01': Array.from({ length: 5 }, (_, i) => P(`m${i}`, undefined, `COD${i}`, `Muro tipo ${i}`)),
    };
    const idx2 = buildSearchIndex([{ id: '01', code: '1', title: 'Cap' }], many);
    const r = searchPartidas(idx2, 'muro', 3);
    expect(r.hits).toHaveLength(3);
    expect(r.truncated).toBe(true);
  });

  it('sin coincidencias → hits vacío, no truncado', () => {
    expect(searchPartidas(idx, 'zzzznada')).toEqual({ hits: [], truncated: false });
  });
});

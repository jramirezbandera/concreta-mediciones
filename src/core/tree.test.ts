import { describe, expect, it } from 'vitest';
import type { Chapter, Partida, SubChapter } from './types';
import {
  buildChapterTree,
  findChapterIdForContainer,
  findNode,
  flattenContainers,
  partidasByContainer,
  rollupByDepth,
} from './tree';
import { groupBySub, groupsForFocus } from './grouping';

/** Partida mínima: solo lo que usa el árbol (sub/cantidad/precio). */
const P = (id: string, sub: string | undefined, cantidad = 1, precio = 10): Partida => ({
  id,
  sub,
  pos: '',
  code: id,
  title: id,
  ud: 'ud',
  precio,
  cantidad,
  desc: '',
  med: [],
  items: [],
});

/** Capítulo de 4 niveles: 1 → 1.1 → {1.1.1, 1.1.2} y 1 → 1.2. */
const deepChapter = (): Chapter => ({
  id: '01',
  code: '1',
  title: 'Cap',
  children: [
    {
      id: '01.01',
      code: '1.1',
      title: 'Sub 1.1',
      children: [
        { id: '01.01.01', code: '1.1.1', title: 'SS A' },
        { id: '01.01.02', code: '1.1.2', title: 'SS B' },
      ],
    },
    { id: '01.02', code: '1.2', title: 'Sub 1.2' },
  ],
});

describe('flattenContainers / findNode', () => {
  it('aplana en pre-orden con profundidad', () => {
    const flat = flattenContainers(deepChapter());
    expect(flat.map((f) => [f.sub.code, f.depth, f.parentId])).toEqual([
      ['1.1', 1, '01'],
      ['1.1.1', 2, '01.01'],
      ['1.1.2', 2, '01.01'],
      ['1.2', 1, '01'],
    ]);
  });

  it('findNode resuelve capítulo, sub directo y sub profundo', () => {
    const chapters = [deepChapter()];
    expect(findNode(chapters, '01')?.depth).toBe(0);
    expect(findNode(chapters, '01.02')?.depth).toBe(1);
    const deep = findNode(chapters, '01.01.02');
    expect(deep?.depth).toBe(2);
    expect(deep?.chapter.id).toBe('01');
    expect(findNode(chapters, 'nope')).toBeNull();
    expect(findChapterIdForContainer(chapters, '01.01.01')).toBe('01');
  });

  it('un árbol con referencia cíclica no revienta (ignora la repetición)', () => {
    const a: SubChapter = { id: 'a', code: '1.1', title: 'A', children: [] };
    const b: SubChapter = { id: 'b', code: '1.1.1', title: 'B', children: [a] };
    a.children!.push(b); // ciclo a→b→a (dato corrupto)
    const ch: Chapter = { id: '01', code: '1', title: 'C', children: [a] };
    const flat = flattenContainers(ch);
    expect(flat.map((f) => f.sub.id)).toEqual(['a', 'b']);
    expect(buildChapterTree(ch, []).count).toBe(0);
  });
});

describe('partidasByContainer / buildChapterTree', () => {
  it('indexa directas, anidadas y huérfanas (sub inexistente → capítulo)', () => {
    const ch = deepChapter();
    const ps = [P('d', undefined), P('a', '01.01.01'), P('x', 'no-existe')];
    const by = partidasByContainer(ch, ps);
    expect(by.get(null)!.map((p) => p.id)).toEqual(['d', 'x']);
    expect(by.get('01.01.01')!.map((p) => p.id)).toEqual(['a']);
  });

  it('totales acumulados por nodo: directas + descendientes', () => {
    const ch = deepChapter();
    // 1×10 € en cada hoja: directa, 1.1, 1.1.1, 1.1.2, 1.2
    const ps = [
      P('d', undefined),
      P('s11', '01.01'),
      P('a', '01.01.01'),
      P('b', '01.01.02'),
      P('c', '01.02'),
    ];
    const tree = buildChapterTree(ch, ps, 1);
    expect(tree.count).toBe(5);
    expect(tree.total).toBe(5000); // 5 × 10 € en céntimos
    const s11 = tree.children[0]!;
    expect(s11.sub?.code).toBe('1.1');
    expect(s11.count).toBe(3); // s11 + a + b
    expect(s11.total).toBe(3000);
    expect(s11.children.map((c) => c.total)).toEqual([1000, 1000]);
    // coefK escala los importes
    expect(buildChapterTree(ch, ps, 1.13).total).toBe(5650);
  });

  it('capítulo de 2 niveles (degenerado) funciona igual que siempre', () => {
    const ch: Chapter = {
      id: '01',
      code: '1',
      title: 'C',
      children: [{ id: '01.01', code: '1.1', title: 'S' }],
    };
    const tree = buildChapterTree(ch, [P('a', '01.01'), P('d', undefined)], 1);
    expect(tree.partidas.map((p) => p.id)).toEqual(['d']);
    expect(tree.children[0]!.partidas.map((p) => p.id)).toEqual(['a']);
    expect(tree.total).toBe(2000);
  });
});

describe('groupBySub (pre-orden + depth) y rollupByDepth', () => {
  it('grupos en pre-orden con huérfanas primero; subs vacíos salen', () => {
    const ch = deepChapter();
    const ps = [P('d', undefined), P('a', '01.01.01'), P('c', '01.02')];
    const gs = groupBySub(ch, ps);
    expect(gs.map((g) => [g.sub?.code ?? null, g.depth, g.items.length])).toEqual([
      [null, 0, 1],
      ['1.1', 1, 0], // vacío pero presente (permite añadirle partidas)
      ['1.1.1', 2, 1],
      ['1.1.2', 2, 0],
      ['1.2', 1, 1],
    ]);
  });

  it('capítulo sin children → un único grupo sin sub (contrato actual)', () => {
    const ch: Chapter = { id: '01', code: '1', title: 'C' };
    const gs = groupBySub(ch, [P('a', undefined)]);
    expect(gs).toHaveLength(1);
    expect(gs[0]!.sub).toBeNull();
  });

  it('groupsForFocus aísla el subárbol del sub activo, re-basado a nivel 1', () => {
    const ch = deepChapter();
    const ps = [P('d', undefined), P('s11', '01.01'), P('a', '01.01.01'), P('c', '01.02')];
    // Foco en 1.1: él y sus descendientes; fuera las directas del capítulo y 1.2.
    const focused = groupsForFocus(ch, ps, '01.01');
    expect(focused.map((g) => [g.sub?.code ?? null, g.depth, g.items.length])).toEqual([
      ['1.1', 1, 1],
      ['1.1.1', 2, 1],
      ['1.1.2', 2, 0],
    ]);
    // Foco en un sub PROFUNDO (1.1.1, depth 2): re-basado a nivel 1.
    const deep = groupsForFocus(ch, ps, '01.01.01');
    expect(deep.map((g) => [g.sub?.code ?? null, g.depth, g.items.length])).toEqual([
      ['1.1.1', 1, 1],
    ]);
    // Sin foco, foco = capítulo o foco inexistente ⇒ capítulo completo.
    expect(groupsForFocus(ch, ps, null)).toEqual(groupBySub(ch, ps));
    expect(groupsForFocus(ch, ps, '01')).toEqual(groupBySub(ch, ps));
    expect(groupsForFocus(ch, ps, 'no-existe')).toEqual(groupBySub(ch, ps));
  });

  it('rollupByDepth acumula descendientes y trata el grupo sin sub como hoja', () => {
    const ch = deepChapter();
    const ps = [
      P('d', undefined, 1, 100),
      P('s11', '01.01', 1, 10),
      P('a', '01.01.01', 1, 1),
      P('b', '01.01.02', 1, 2),
      P('c', '01.02', 1, 5),
    ];
    const gs = groupBySub(ch, ps);
    const direct = gs.map((g) => g.items.reduce((s, p) => s + (p.precio ?? 0), 0));
    const roll = rollupByDepth(gs, direct);
    // [∅, 1.1, 1.1.1, 1.1.2, 1.2]
    expect(direct).toEqual([100, 10, 1, 2, 5]);
    expect(roll).toEqual([100, 13, 1, 2, 5]); // 1.1 = 10+1+2; ∅ no absorbe nada
  });
});

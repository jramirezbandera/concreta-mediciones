/* El resumen de lo que cambió fuera, y aplicarlo en el store como un paso de
   Deshacer que reaprovecha lo que no cambió. */
import { beforeEach, describe, expect, it } from 'vitest';
import type { Partida } from '../core/types';
import { blankObraData, toSerializable, useObraStore, type ObraData } from '../store';
import { __resetHistoryForTests, initHistory, undo } from '../store/temporal';
import { compararObras } from './cambios';

const p = (id: string, med: number[] = [], extra: Partial<Partida> = {}): Partida => ({
  id,
  pos: '1.1',
  code: '',
  title: id,
  ud: 'm',
  precio: 1,
  desc: '',
  med: med.map((uds, i) => ({
    id: `${id}-l${i}`,
    comment: '',
    uds,
    largo: '',
    ancho: '',
    alto: '',
  })),
  items: [],
  ...extra,
});

function obra(partidas: Partida[]): ObraData {
  const d = blankObraData('X');
  d.chapters = [{ id: 'c1', code: '1', title: 'Uno', children: [] }];
  d.partidas = { c1: partidas };
  return d;
}

describe('compararObras', () => {
  it('cuenta partidas y líneas nuevas, cambiadas y borradas', () => {
    const antes = obra([p('a', [1]), p('b', [1, 2]), p('c')]);
    const despues = obra([p('a', [1, 5]), p('b', [1, 2], { precio: 9 }), p('d', [1, 1, 1])]);
    const c = compararObras(antes, despues);
    expect(c.texto).toBe('+1 partida · +4 líneas · 1 partida cambiada · −1 partida');
    expect(c.partidasTocadas.sort()).toEqual(['a', 'b', 'd']);
  });

  it('sin cambios, nada; y lo que no son partidas también se nombra', () => {
    const d = obra([p('a', [1])]);
    expect(compararObras(d, structuredClone(d)).hayCambios).toBe(false);
    const e = structuredClone(d);
    e.rates = { ...e.rates, gg: 0.15 };
    e.chapters[0]!.title = 'Renombrado';
    expect(compararObras(d, e).texto).toBe('capítulos, porcentajes');
  });
});

describe('aplicarExterno', () => {
  const st = () => useObraStore.getState();
  beforeEach(() => {
    st().loadObra(obra([p('a', [1]), p('b', [2])]));
    __resetHistoryForTests();
    initHistory(useObraStore);
  });

  it('es un paso de Deshacer y reaprovecha lo que no cambió', () => {
    const antes = st().partidas.c1!;
    const fuera = structuredClone(toSerializable(st())); // el estado de immer está congelado
    fuera.partidas.c1 = [fuera.partidas.c1![0]!, p('b', [2, 3])];
    st().aplicarExterno(fuera);
    const ahora = st().partidas.c1!;
    expect(ahora[0]).toBe(antes[0]); // la partida «a», intacta: la misma referencia
    expect(ahora[1]!.med).toHaveLength(2);
    undo();
    expect(st().partidas.c1![1]!.med).toHaveLength(1);
  });

  it('si no trae nada nuevo, no hace nada (ni entrada de Deshacer)', () => {
    const antes = st().partidas;
    st().aplicarExterno(JSON.parse(JSON.stringify(toSerializable(st()))));
    expect(st().partidas).toBe(antes);
  });
});

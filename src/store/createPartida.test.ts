/* createPartida (devuelve id) + addMedLines (alta por lote) — acciones nuevas F-A3. */
import { beforeEach, describe, expect, it } from 'vitest';
import { blankObraData, useObraStore } from './index';
import { medTotal } from '../core/medicion';
import type { Chapter } from '../core/types';

const CH: Chapter[] = [{ id: 'c1', code: '1', title: 'Cap', children: [{ id: 's1', code: '1.1', title: 'Sub' }] }];

beforeEach(() => {
  useObraStore.setState({ ...blankObraData(), chapters: structuredClone(CH), partidas: { c1: [] }, active: 'c1' });
});

describe('createPartida', () => {
  it('devuelve el id de la partida creada, con pos correlativa', () => {
    const id1 = useObraStore.getState().createPartida('c1', null);
    const id2 = useObraStore.getState().createPartida('c1', null);
    expect(id1).toBeTruthy();
    expect(id2).not.toBe(id1);
    const list = useObraStore.getState().partidas.c1!;
    expect(list.map((p) => p.id)).toEqual([id1, id2]);
    expect(list.map((p) => p.pos)).toEqual(['1.1', '1.2']);
  });

  it('crea dentro del subcapítulo cuando se le pasa su id', () => {
    const id = useObraStore.getState().createPartida('c1', 's1');
    const p = useObraStore.getState().partidas.c1!.find((x) => x.id === id)!;
    expect(p.sub).toBe('s1');
    expect(p.pos).toBe('1.1.1');
  });

  it('destino inexistente → devuelve cadena vacía y no crea nada', () => {
    expect(useObraStore.getState().createPartida('no-existe', null)).toBe('');
    expect(useObraStore.getState().createPartida('c1', 'sub-fantasma')).toBe('');
    expect(useObraStore.getState().partidas.c1).toHaveLength(0);
  });
});

describe('addMedLines', () => {
  it('añade varias líneas con valores en una sola acción', () => {
    const id = useObraStore.getState().createPartida('c1', null);
    useObraStore.getState().addMedLines('c1', id, [{ uds: 2, largo: 3 }, { comment: 'zócalo', uds: 4 }]);
    const p = useObraStore.getState().partidas.c1!.find((x) => x.id === id)!;
    expect(p.med).toHaveLength(2);
    expect(medTotal(p.med)).toBe(10); // 6 + 4
    expect(p.med[1]!.comment).toBe('zócalo');
  });

  it('lista vacía o partida inexistente → no-op', () => {
    const id = useObraStore.getState().createPartida('c1', null);
    useObraStore.getState().addMedLines('c1', id, []);
    useObraStore.getState().addMedLines('c1', 'nope', [{ uds: 1 }]);
    expect(useObraStore.getState().partidas.c1!.find((x) => x.id === id)!.med).toHaveLength(0);
  });
});

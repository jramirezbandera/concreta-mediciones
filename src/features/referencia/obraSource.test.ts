import 'fake-indexeddb/auto';
import { clear } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Partida } from '../../core/types';
import { createObra } from '../../persist';
import { blankObraData, type ObraData } from '../../store';
import { loadObraRefSource } from './obraSource';

function srcObra(): ObraData {
  const d = blankObraData('Fuente');
  d.chapters = [{ id: '01', code: '1', title: 'Cap' }];
  const p: Partida = {
    id: 'p1',
    pos: '1.1',
    code: 'X01',
    title: 'Mi partida',
    ud: 'm',
    precio: 10,
    desc: 'larga',
    med: [],
    items: [{ code: 'mo1', type: 'MO', cantidad: 2 }],
  };
  d.partidas = { '01': [p] };
  d.recursos = { mo1: { type: 'MO', desc: 'Peón', ud: 'h', precio: 18 } };
  return d;
}

beforeEach(async () => {
  await clear();
});

describe('loadObraRefSource', () => {
  it('carga una obra guardada y la adapta a RefSource con items hidratados', async () => {
    const id = await createObra(srcObra());
    const rs = await loadObraRefSource(id, 'Fuente');
    expect(rs).not.toBeNull();
    expect(rs!.id).toBe(`obra:${id}`);
    expect(rs!.partidas['01']![0]!.desc).toBe('larga');
    expect(rs!.partidas['01']![0]!.items[0]).toMatchObject({ code: 'mo1', precio: 18, desc: 'Peón' });
  });

  it('obra inexistente → null', async () => {
    expect(await loadObraRefSource('no-existe', 'X')).toBeNull();
  });
});

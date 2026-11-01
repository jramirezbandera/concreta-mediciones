import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MedLine, Partida } from '../core/types';
import { blankObraData, useObraStore } from './index';
import { __resetHistoryForTests, initHistory, undo } from './temporal';

const state = () => useObraStore.getState();
const linea = (id: string, formaId?: string): MedLine => ({
  id,
  comment: id,
  uds: 1,
  largo: 2,
  ancho: '',
  alto: '',
  ...(formaId && { origen: { planoId: 'pl', pagina: 1, formaId } as MedLine['origen'] }),
});
const partida = (id: string, med: MedLine[] = []): Partida => ({
  id,
  pos: '',
  code: `C-${id}`,
  title: `Partida ${id}`,
  ud: 'm',
  precio: 10,
  desc: 'Texto',
  med,
  items: [],
});

beforeEach(() => {
  __resetHistoryForTests();
  const d = blankObraData('Duplicar');
  d.chapters = [{ id: 'a', code: '1', title: 'Albañilería' }];
  d.partidas = {
    a: [partida('p1', [linea('m1', 'f1'), linea('m2', 'f1'), linea('m3')]), partida('p2')],
  };
  d.certs = [{ id: 'c1', num: 1, period: '', retencion: 0, data: { p1: 50 } }];
  state().loadObra(d);
  initHistory(useObraStore);
});
afterEach(() => __resetHistoryForTests());

describe('duplicarPartida', () => {
  it('la copia va justo detrás, con su medición, ids nuevos y la numeración rehecha', () => {
    const id = state().duplicarPartida('a', 'p1');
    const list = state().partidas.a!;
    expect(list.map((p) => p.id)).toEqual(['p1', id, 'p2']);
    expect(list.map((p) => p.pos)).toEqual(['1.1', '1.2', '1.3']);
    const copia = list[1]!;
    expect(copia).toMatchObject({ code: 'C-p1', title: 'Partida p1', desc: 'Texto', precio: 10 });
    expect(copia.med.map((l) => l.comment)).toEqual(['m1', 'm2', 'm3']);
    const ids = new Set([...list[0]!.med, ...copia.med].map((l) => l.id));
    expect(ids.size).toBe(6);
  });

  it('las líneas del plano estrenan forma, y las que la compartían la siguen compartiendo', () => {
    const id = state().duplicarPartida('a', 'p1');
    const copia = state().partidas.a!.find((p) => p.id === id)!;
    const formas = copia.med.map((l) => (l.origen as { formaId?: string } | undefined)?.formaId);
    expect(formas[0]).not.toBe('f1');
    expect(formas[1]).toBe(formas[0]);
    expect(formas[2]).toBeUndefined();
  });

  it('no arrastra la certificación y se deshace en un paso', () => {
    const id = state().duplicarPartida('a', 'p1');
    expect(state().certs[0]!.data[id]).toBeUndefined();
    undo();
    expect(state().partidas.a!.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('una partida que no existe no hace nada', () => {
    expect(state().duplicarPartida('a', 'nada')).toBe('');
    expect(state().partidas.a).toHaveLength(2);
  });
});

describe('menú ⋮: «Duplicar con medición»', () => {
  it('duplica, abre la copia y ofrece Deshacer', async () => {
    const { render, screen, fireEvent } = await import('@testing-library/react');
    const { createElement } = await import('react');
    const { PartidaMenu } = await import('../features/presupuesto/PartidaMenu');
    const { useToastStore } = await import('./toastStore');
    const p1 = state().partidas.a![0]!;
    render(createElement(PartidaMenu, { p: p1, chapterId: 'a' }));
    fireEvent.click(screen.getByTitle('Más acciones'));
    fireEvent.click(screen.getByRole('button', { name: /Duplicar con medición/ }));
    const list = state().partidas.a!;
    expect(list).toHaveLength(3);
    expect(state().openPartidaId).toBe(list[1]!.id);
    expect(useToastStore.getState().action?.label).toBe('Deshacer');
  });
});

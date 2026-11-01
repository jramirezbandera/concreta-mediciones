import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Oferta } from '../core/ofertas';
import { buildExportText, parseObraJson } from '../persist/transfer';
import { SCHEMA_VERSION, blankObraData, fromSerializable, toSerializable, type ObraData } from './schema';
import { useObraStore } from './obraStore';
import { __resetHistoryForTests, initHistory, undo } from './temporal';

const state = () => useObraStore.getState();
const oferta = (id: string): Oferta => ({
  id,
  empresa: `Constructora ${id}`,
  fecha: '2026-11-01T10:00:00.000Z',
  fichero: `${id}.bc3`,
  precios: { p1: 12.5 },
  cantidades: {},
  sinCasar: [],
});

beforeEach(() => {
  __resetHistoryForTests();
  state().loadObra(blankObraData('Ofertas'));
  initHistory(useObraStore);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => __resetHistoryForTests());

describe('v9 → v10 (comparativo de ofertas)', () => {
  it('solo sube la versión: sin ofertas', () => {
    const v9 = { ...blankObraData(), schemaVersion: 9 } as ObraData;
    delete v9.ofertas;
    const d = fromSerializable(structuredClone(v9));
    expect(d).toEqual({ ...v9, schemaVersion: SCHEMA_VERSION });
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(10);
  });

  it('toSerializable lleva `ofertas` solo si hay alguna', () => {
    expect('ofertas' in toSerializable(blankObraData())).toBe(false);
    expect(toSerializable({ ...blankObraData(), ofertas: [oferta('a')] }).ofertas).toHaveLength(1);
  });

  it('una oferta ilegible se aparta y la obra abre', () => {
    const d0 = { ...blankObraData(), ofertas: [oferta('a'), { id: 'b' }] as Oferta[] };
    const d = fromSerializable(structuredClone(d0));
    expect(d.ofertas!.map((o) => o.id)).toEqual(['a']);
    expect(d._ilegible!.map((x) => x.donde)).toEqual(['ofertas/1']);
  });
});

describe('ofertasSlice', () => {
  it('añadir, renombrar y quitar; cada paso se deshace', () => {
    state().addOferta(oferta('a'));
    state().addOferta(oferta('b'));
    state().renombrarOferta('a', 'Pérez S.L.');
    expect(state().ofertas!.map((o) => o.empresa)).toEqual(['Pérez S.L.', 'Constructora b']);
    state().quitarOferta('b');
    state().quitarOferta('a');
    expect(state().ofertas).toBeUndefined();
    undo();
    expect(state().ofertas!.map((o) => o.id)).toEqual(['a']);
    undo();
    undo();
    expect(state().ofertas!.map((o) => o.empresa)).toEqual(['Constructora a', 'Constructora b']);
  });

  it('no se heredan al cargar otra obra y viajan en la copia .json', () => {
    state().addOferta(oferta('a'));
    const copia = parseObraJson(buildExportText());
    state().loadObra(blankObraData('Otra'));
    expect(state().ofertas).toBeUndefined();
    expect(copia.ofertas!.map((o) => o.id)).toEqual(['a']);
  });
});

import 'fake-indexeddb/auto';
import { clear, set } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { blankObraData, useObraStore } from '../store';
import { loadObraEnvelope, obraKey } from './persist';
import { createObra, listObras, setActiveId } from './registry';
import { usePersistStore } from './persistStore';
import {
  __resetSyncForTests,
  deleteObraById,
  discardRecovery,
  flushPending,
  getActiveObraId,
  hydrate,
  newObra,
  switchObra,
} from './sync';

const state = () => useObraStore.getState();

/** Hidrata y registra la obra demo como "obra A" (editándola y guardando). */
async function bootWithDemoA(): Promise<string> {
  await hydrate(); // vacío → demo en memoria
  state().editPartidaField('01', 'p111', 'title', 'A-editada');
  await flushPending(); // registra la demo como obra A
  return getActiveObraId()!;
}

beforeEach(async () => {
  await clear();
  state().reset();
  __resetSyncForTests();
  usePersistStore.setState({ status: 'idle', recovery: null, recoveryKey: null });
});

describe('switchObra (round-trip multi-obra)', () => {
  it('[CRÍTICO] conmutar entre obras NO pierde datos', async () => {
    const aId = await bootWithDemoA();
    const bId = await newObra('Obra B'); // blank, activa
    expect(getActiveObraId()).toBe(bId);
    state().addChapter('Cap B'); // edita B
    await flushPending();

    await switchObra(aId); // vuelve a A
    expect(getActiveObraId()).toBe(aId);
    expect(state().partidas['01']!.find((p) => p.id === 'p111')!.title).toBe('A-editada');
    expect(state().chapters.some((c) => c.title === 'Cap B')).toBe(false); // A no tiene lo de B

    await switchObra(bId); // vuelve a B
    expect(getActiveObraId()).toBe(bId);
    expect(state().chapters.some((c) => c.title === 'Cap B')).toBe(true); // B intacta
  });

  it('conmutar a la MISMA obra es no-op', async () => {
    const aId = await bootWithDemoA();
    await switchObra(aId);
    expect(getActiveObraId()).toBe(aId);
  });

  it('conmutar a una obra corrupta → recuperación, la activa NO cambia', async () => {
    const aId = await bootWithDemoA();
    const bId = await newObra('B');
    await switchObra(aId); // activa A
    await set(obraKey(bId), { schemaVersion: 1, data: { roto: true } }); // corromper B
    await switchObra(bId);
    expect(getActiveObraId()).toBe(aId); // sigue en A
    expect(usePersistStore.getState().recovery).not.toBeNull();
    expect(usePersistStore.getState().recoveryKey).toBe(obraKey(bId));
  });
});

describe('newObra', () => {
  it('crea una obra EN BLANCO, la persiste de inmediato y conmuta a ella', async () => {
    await bootWithDemoA();
    const bId = await newObra('Obra B');
    expect(getActiveObraId()).toBe(bId);
    expect(state().chapters.length).toBe(0); // en blanco
    expect((await loadObraEnvelope(obraKey(bId))).kind).toBe('ok'); // persistida sin editar
    expect((await listObras()).map((o) => o.name)).toContain('Obra B');
  });
});

describe('deleteObraById', () => {
  it('borrar una obra NO activa conserva la activa y sus datos', async () => {
    const aId = await bootWithDemoA();
    const bId = await newObra('B');
    await switchObra(aId); // activa A
    await deleteObraById(bId);
    expect(getActiveObraId()).toBe(aId);
    expect((await listObras()).map((o) => o.id)).not.toContain(bId);
    expect(state().partidas['01']!.find((p) => p.id === 'p111')!.title).toBe('A-editada');
  });

  it('borrar la obra ACTIVA salta a otra y la carga', async () => {
    const aId = await bootWithDemoA();
    const bId = await newObra('B'); // activa B
    await deleteObraById(bId);
    expect(getActiveObraId()).toBe(aId);
    expect((await listObras()).map((o) => o.id)).toEqual([aId]);
    expect(state().partidas['01']!.find((p) => p.id === 'p111')!.title).toBe('A-editada');
  });

  it('borrar la ÚLTIMA obra la reemplaza por una en blanco (siempre queda ≥1)', async () => {
    const aId = await bootWithDemoA();
    await deleteObraById(aId);
    const list = await listObras();
    expect(list.length).toBe(1);
    expect(list[0]!.id).not.toBe(aId); // obra nueva, no la borrada
    expect(getActiveObraId()).toBe(list[0]!.id);
    expect(state().chapters.length).toBe(0); // en blanco
  });

  it('borrar la activa salta SOBRE una obra corrupta hasta una sana (#6)', async () => {
    const aId = await bootWithDemoA(); // [A]
    const bId = await newObra('B'); // [A,B]
    const cId = await newObra('C'); // [A,B,C], activa C
    await set(obraKey(aId), { schemaVersion: 1, data: { roto: true } }); // A (será obras[0]) corrupta
    await deleteObraById(cId); // borra activa C → índice activeId=A (corrupta) → fallback B
    expect(getActiveObraId()).toBe(bId);
    expect(state().obra.denominacion).toBe('B');
    expect(usePersistStore.getState().recovery).toBeNull();
  });

  it('borrar la activa con TODAS las demás corruptas → recuperación (#6)', async () => {
    const aId = await bootWithDemoA();
    const bId = await newObra('B'); // activa B
    await set(obraKey(aId), { schemaVersion: 1, data: { roto: true } });
    await deleteObraById(bId); // borra B → activeId=A corrupta, ninguna sana → recuperación
    expect(usePersistStore.getState().recovery).not.toBeNull();
  });
});

describe('discardRecovery (#7)', () => {
  it('elimina la obra dañada del registro (sin fantasma) y deja una en blanco', async () => {
    const bId = await createObra(blankObraData('B'));
    await setActiveId(bId);
    await set(obraKey(bId), { schemaVersion: 1, data: { roto: true } }); // corromper
    await hydrate(); // B activa y corrupta, única → recuperación
    expect(usePersistStore.getState().recovery).not.toBeNull();

    await discardRecovery(obraKey(bId));
    const list = await listObras();
    expect(list.map((m) => m.id)).not.toContain(bId); // no queda fantasma
    expect(list.length).toBe(1); // una obra en blanco la reemplaza
  });

  it('con VARIAS obras corruptas las procesa una a una (sin fantasma)', async () => {
    const aId = await createObra(blankObraData('A'));
    const bId = await createObra(blankObraData('B'));
    await setActiveId(aId);
    await set(obraKey(aId), { schemaVersion: 1, data: { roto: true } });
    await set(obraKey(bId), { schemaVersion: 1, data: { roto: true } });
    await hydrate(); // ambas corruptas → recuperación (A primero, es la activa)
    const key1 = usePersistStore.getState().recoveryKey!;
    expect(key1).toBe(obraKey(aId));

    await discardRecovery(key1); // borra A; B sigue corrupta → recuperación de B
    expect((await listObras()).map((m) => m.id)).toEqual([bId]);
    const key2 = usePersistStore.getState().recoveryKey;
    expect(key2).toBe(obraKey(bId));

    await discardRecovery(key2!); // borra B; no quedan → obra en blanco
    expect(usePersistStore.getState().recovery).toBeNull();
    const list = await listObras();
    expect(list.length).toBe(1);
    expect(list.map((m) => m.id)).not.toContain(aId);
    expect(list.map((m) => m.id)).not.toContain(bId);
  });
});

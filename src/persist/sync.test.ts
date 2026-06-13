import 'fake-indexeddb/auto';
import { clear, get, set } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { toSerializable, useObraStore, type ObraData } from '../store';
import { OBRA_KEY, loadObraEnvelope, obraKey } from './persist';
import { createObra, getActiveId, listObras, loadIndex, setActiveId } from './registry';
import { usePersistStore } from './persistStore';
import {
  __resetSyncForTests,
  armAutosave,
  flushPending,
  getActiveObraId,
  hydrate,
} from './sync';

const state = () => useObraStore.getState();
const withName = (name: string): ObraData => ({
  ...toSerializable(state()),
  obra: { denominacion: name, direccion: '', localidad: '' },
});

beforeEach(async () => {
  await clear();
  state().reset();
  __resetSyncForTests();
  usePersistStore.setState({ status: 'idle', recovery: null, recoveryKey: null });
});

describe('hydrate (multi-obra)', () => {
  it('instalación nueva (sin registro) → demo en memoria, NO se fosiliza', async () => {
    await hydrate();
    expect(state().obra.denominacion).toContain('C/ Mayor 14');
    expect(await loadIndex()).toEqual({ activeId: null, obras: [] });
    expect(getActiveObraId()).toBeNull();
  });

  it('1ª edición de la demo crea el registro y persiste', async () => {
    await hydrate();
    state().editPartidaField('01', 'p111', 'title', 'Editada');
    await flushPending();
    expect((await listObras()).length).toBe(1);
    const id = (await getActiveId())!;
    expect(id).toBeTruthy();
    const res = await loadObraEnvelope(obraKey(id));
    expect(
      res.kind === 'ok' &&
        res.envelope.data.partidas['01']!.find((p) => p.id === 'p111')!.title,
    ).toBe('Editada');
  });

  it('con obra registrada → carga la activa', async () => {
    const id = await createObra(withName('Obra Guardada'));
    await setActiveId(id);
    await hydrate();
    expect(state().obra.denominacion).toBe('Obra Guardada');
    expect(getActiveObraId()).toBe(id);
  });

  it('legacy v1 → MIGRA, carga, migra schema y borra la clave legacy', async () => {
    const v1: ObraData = { ...withName('Obra v1 antigua'), schemaVersion: 1 };
    await set(OBRA_KEY, { schemaVersion: 1, savedAt: 'x', appVersion: '0.5', data: v1 });
    await hydrate();
    expect(state().obra.denominacion).toBe('Obra v1 antigua');
    expect(state().schemaVersion).toBe(2); // migrada en cadena
    expect(usePersistStore.getState().recovery).toBeNull();
    expect(await get(OBRA_KEY)).toBeUndefined(); // legacy borrada
    expect((await listObras()).length).toBe(1);
  });

  it('migración IDEMPOTENTE: re-hidratar no duplica obras', async () => {
    await set(OBRA_KEY, { schemaVersion: 2, savedAt: 'x', appVersion: '0.6', data: withName('Una') });
    await hydrate();
    __resetSyncForTests();
    state().reset();
    await hydrate();
    expect((await listObras()).length).toBe(1); // no duplica
  });

  it('obra activa corrupta → recuperación (no pisa la demo, no arma)', async () => {
    const id = await createObra(withName('Rota'));
    await setActiveId(id);
    await set(obraKey(id), { schemaVersion: 1, data: { roto: true } });
    await hydrate();
    expect(usePersistStore.getState().recovery).not.toBeNull();
    expect(usePersistStore.getState().recoveryKey).toBe(obraKey(id));
    expect(state().obra.denominacion).toContain('C/ Mayor 14'); // demo, no pisada
  });

  it('activa corrupta pero OTRA sana → fallback a la sana y actualiza el índice', async () => {
    const good = await createObra(withName('Buena'));
    const bad = await createObra(withName('Mala'));
    await setActiveId(bad);
    await set(obraKey(bad), { schemaVersion: 1, data: { roto: true } });
    await hydrate();
    expect(state().obra.denominacion).toBe('Buena');
    expect(getActiveObraId()).toBe(good);
    expect(await getActiveId()).toBe(good);
  });
});

describe('autosave (multi-obra)', () => {
  it('navegar (UI) NO guarda; editar DOMINIO sí', async () => {
    await hydrate();
    state().setActive('02');
    state().setView('resumen');
    await flushPending();
    expect((await listObras()).length).toBe(0); // navegar no persiste
    state().editPartidaField('01', 'p111', 'title', 'Editada');
    await flushPending();
    expect((await listObras()).length).toBe(1);
  });

  it('flushPending fuerza el guardado pendiente sin esperar al debounce', async () => {
    await hydrate();
    state().setRates({ coefK: 1.5 });
    await flushPending();
    const id = (await getActiveId())!;
    const res = await loadObraEnvelope(obraKey(id));
    expect(res.kind === 'ok' && res.envelope.data.rates.coefK).toBe(1.5);
  });

  it('armAutosave es idempotente (StrictMode no duplica la suscripción)', async () => {
    await hydrate();
    armAutosave();
    armAutosave(); // no-op
    state().setRates({ coefK: 2 });
    await flushPending();
    const id = (await getActiveId())!;
    const res = await loadObraEnvelope(obraKey(id));
    expect(res.kind === 'ok' && res.envelope.data.rates.coefK).toBe(2);
  });
});

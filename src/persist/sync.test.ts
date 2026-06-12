import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { toSerializable, useObraStore, type ObraData } from '../store';
import { clearObra, loadObraEnvelope, saveObra } from './persist';
import { usePersistStore } from './persistStore';
import { __resetSyncForTests, armAutosave, flushPending, hydrate } from './sync';

const state = () => useObraStore.getState();

beforeEach(async () => {
  await clearObra();
  state().reset();
  __resetSyncForTests();
  usePersistStore.setState({ status: 'idle', recovery: null });
});

describe('hydrate (F6.1)', () => {
  it('almacén vacío → conserva la demo en memoria y NO la persiste (Tensión 2-A)', async () => {
    await hydrate();
    expect(state().obra.denominacion).toContain('C/ Mayor 14'); // demo intacta
    expect((await loadObraEnvelope()).kind).toBe('empty'); // la semilla NO se fosiliza
  });

  it('con obra guardada → reemplaza el store por la cargada', async () => {
    const saved: ObraData = {
      ...toSerializable(state()),
      obra: { denominacion: 'Obra Guardada', direccion: '', localidad: '' },
    };
    await saveObra(saved);
    await hydrate();
    expect(state().obra.denominacion).toBe('Obra Guardada');
  });

  it('una obra v1 guardada (pre-jerarquía N niveles) MIGRA y carga al hidratar', async () => {
    const { set } = await import('idb-keyval');
    const { OBRA_KEY } = await import('./persist');
    // Sobre v1 real: lo que persistió la app antes del SCHEMA_VERSION 2.
    const v1: ObraData = {
      ...toSerializable(state()),
      schemaVersion: 1,
      obra: { denominacion: 'Obra v1 antigua', direccion: '', localidad: '' },
    };
    await set(OBRA_KEY, { schemaVersion: 1, savedAt: 'x', appVersion: '0.5', data: v1 });
    await hydrate();
    expect(state().obra.denominacion).toBe('Obra v1 antigua'); // cargó, no recuperación
    expect(state().schemaVersion).toBe(2); // migrada en cadena
    expect(usePersistStore.getState().recovery).toBeNull();
  });

  it('datos corruptos → NO pisa, marca recuperación, no arma autosave', async () => {
    const { set } = await import('idb-keyval');
    const { OBRA_KEY } = await import('./persist');
    await set(OBRA_KEY, { schemaVersion: 1, data: { roto: true } });
    await hydrate();
    expect(usePersistStore.getState().recovery).not.toBeNull();
    expect(state().obra.denominacion).toContain('C/ Mayor 14'); // demo, no se pisó
    // autosave NO armado: una edición de dominio no persiste ni pisa el blob corrupto
    state().editPartidaField('01', 'p111', 'title', 'X');
    await flushPending();
    expect((await loadObraEnvelope()).kind).toBe('corrupt');
  });
});

describe('autosave (F6.1)', () => {
  it('navegar (UI) NO guarda; editar DOMINIO sí (flushPending fuerza la cola)', async () => {
    await hydrate(); // vacío → arma autosave, no persiste la demo
    // cambio de UI: el slice de dominio no cambia → el listener no se dispara → nada pendiente
    state().setActive('02');
    state().setView('resumen');
    await flushPending();
    expect((await loadObraEnvelope()).kind).toBe('empty');
    // cambio de DOMINIO: el listener programa el guardado; flushPending lo fuerza
    state().editPartidaField('01', 'p111', 'title', 'Editada');
    await flushPending();
    const res = await loadObraEnvelope();
    expect(res.kind).toBe('ok');
    if (res.kind === 'ok') {
      const p = res.envelope.data.partidas['01']!.find((x) => x.id === 'p111')!;
      expect(p.title).toBe('Editada');
    }
  });

  it('flushPending fuerza el guardado pendiente sin esperar al debounce', async () => {
    await hydrate();
    state().setRates({ coefK: 1.5 });
    await flushPending(); // no avanzamos timers: el flush debe persistir igual
    const res = await loadObraEnvelope();
    expect(res.kind === 'ok' && res.envelope.data.rates.coefK).toBe(1.5);
  });

  it('armAutosave es idempotente (StrictMode no duplica la suscripción)', async () => {
    await hydrate();
    armAutosave();
    armAutosave(); // no-op
    state().setRates({ coefK: 2 });
    await flushPending();
    const res = await loadObraEnvelope();
    expect(res.kind === 'ok' && res.envelope.data.rates.coefK).toBe(2);
  });
});

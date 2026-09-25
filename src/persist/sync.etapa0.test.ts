/* ===========================================================================
   persist/sync — Etapa 0 del plan de planos (release previa):
     · una obra guardada por una versión MÁS NUEVA nunca se borra ni se pisa al
       hidratar, conmutar, heredar el candado o guardar (fixture «v7»);
     · la copia .json sella `ultimaCopia` y la fecha sobrevive al autosave;
     · importar un .json deja de dar por bueno un guardado que ha fallado.
   Fichero aparte: el vi.mock espía de `registry` (para inyectar fallos) no debe
   contaminar la suite principal de sync.
   =========================================================================== */
import 'fake-indexeddb/auto';
import { clear, get, set } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock(import('./registry'), { spy: true });
import * as registry from './registry';
import { SCHEMA_VERSION, toSerializable, useObraStore, useToastStore, type ObraData } from '../store';
import { FakeLockManager, heldUntil, tick } from '../test/fakeLocks';
import { loadObraEnvelope, obraKey, versionKey } from './persist';
import { usePersistStore } from './persistStore';
import { useSessionStore } from './sessionStore';
import {
  __resetSyncForTests,
  deleteObraById,
  descargarCopia,
  discardRecovery,
  flushPending,
  getActiveObraId,
  hydrate,
  importarSobreActiva,
  newObra,
  switchObra,
  volverAObraGuardada,
} from './sync';
import { __setLockManagerForTests } from './tabLock';

const state = () => useObraStore.getState();
const session = () => useSessionStore.getState();
const withName = (name: string): ObraData => ({
  ...toSerializable(state()),
  obra: { denominacion: name, direccion: '', localidad: '' },
});
const titleOf = (d: ObraData | undefined) => d?.partidas['01']!.find((p) => p.id === 'p111')!.title;

/* Fixture «v7»: lo que guardaría una Concreta dos versiones más nueva, con otra
   forma (no pasaría `isObraData`). */
const V7 = SCHEMA_VERSION + 2;
const v7Envelope = { schemaVersion: V7, savedAt: '2026-10-01T00:00:00.000Z', appVersion: '9.0', data: { hojas: [] } };
/** Escribe la obra `id` como la dejaría la versión nueva (sobre + clave de versión). */
async function guardarComoV7(id: string): Promise<void> {
  await set(obraKey(id), v7Envelope);
  await set(versionKey(obraKey(id)), V7);
}
async function registrarV7(name: string): Promise<string> {
  const id = await registry.createObra(withName(name));
  await guardarComoV7(id);
  return id;
}

beforeEach(async () => {
  vi.clearAllMocks();
  await clear();
  state().reset();
  __resetSyncForTests();
  usePersistStore.setState({ status: 'idle', recovery: null, recoveryKey: null, durability: 'unknown' });
  useToastStore.setState({ msg: null, action: null, tick: 0 });
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  __setLockManagerForTests(null);
  vi.unstubAllGlobals();
});

describe('obra de una versión MÁS NUEVA: nunca se borra ni se pisa', () => {
  it('hidratar con la activa v7: abre otra, avisa sin «Descartar» y deja la v7 intacta', async () => {
    const buena = await registry.createObra(withName('Buena'));
    const v7 = await registrarV7('Del futuro');
    await registry.setActiveId(v7);
    await hydrate();
    expect(getActiveObraId()).toBe(buena);
    expect(state().obra.denominacion).toBe('Buena');
    expect(usePersistStore.getState().recovery).toBeNull(); // nada de «datos dañados»
    expect(usePersistStore.getState().masNueva).toEqual({ id: v7, nombre: 'Del futuro' });
    expect(session().readonly).toBe(false); // la que está en pantalla se edita normal
    expect(await get(obraKey(v7))).toEqual(v7Envelope);
  });

  it('hidratar con solo la v7: sin banner de recuperación; editar guarda en una obra NUEVA', async () => {
    const v7 = await registrarV7('Del futuro');
    await registry.setActiveId(v7);
    await hydrate();
    expect(usePersistStore.getState().recovery).toBeNull();
    expect(usePersistStore.getState().masNueva?.id).toBe(v7);
    state().editPartidaField('01', 'p111', 'title', 'En otra obra');
    await flushPending();
    const nueva = getActiveObraId()!;
    expect(nueva).not.toBe(v7);
    const res = await registry.loadObraData(nueva);
    expect(res.kind === 'ok' && titleOf(res.data)).toBe('En otra obra');
    expect(await get(obraKey(v7))).toEqual(v7Envelope);
  });

  it('conmutar a la v7: la activa no cambia y la v7 no se ofrece descartar', async () => {
    const a = await registry.createObra(withName('A'));
    await registry.setActiveId(a);
    const v7 = await registrarV7('Del futuro');
    await hydrate();
    await switchObra(v7);
    expect(getActiveObraId()).toBe(a);
    expect(state().obra.denominacion).toBe('A');
    expect(usePersistStore.getState().recovery).toBeNull();
    expect(usePersistStore.getState().masNueva?.id).toBe(v7);
    expect(await get(obraKey(v7))).toEqual(v7Envelope);
  });

  it('guardar cuando otra pestaña ya la dejó en v7: rechazo terminal, solo lectura y disco intacto', async () => {
    const a = await registry.createObra(withName('A'));
    await registry.setActiveId(a);
    await hydrate();
    await guardarComoV7(a); // la app nueva la reescribió
    const idxAntes = await registry.loadIndex();

    state().editPartidaField('01', 'p111', 'title', 'Pisaría la v7');
    await expect(flushPending()).resolves.toBe(true); // recargar no se queda bloqueado
    expect(await get(obraKey(a))).toEqual(v7Envelope);
    expect(await registry.loadIndex()).toEqual(idxAntes); // el índice no se toca
    expect(session().readonly).toBe(true);
    expect(session().readonlyMotivo).toBe('mas-nueva');
    expect(usePersistStore.getState().masNueva?.id).toBe(a);
    expect(usePersistStore.getState().status).toBe('idle'); // lo dice el aviso, no el chip

    // Ya en solo lectura, más ediciones no intentan escribir.
    state().editPartidaField('01', 'p111', 'title', 'Otra vez');
    await flushPending();
    expect(await get(obraKey(a))).toEqual(v7Envelope);
    // Y el rechazo no bloquea las demás obras: conmutar y guardar otra funciona.
    const b = (await newObra('B'))!;
    expect(getActiveObraId()).toBe(b);
    state().addChapter('Cap B');
    await flushPending();
    expect((await registry.loadObraData(b)).kind).toBe('ok');
  });

  it('descartar una obra dañada que otra pestaña ya reescribió en v7 no la borra', async () => {
    const a = await registry.createObra(withName('A'));
    await registry.setActiveId(a);
    const rota = await registry.createObra(withName('Rota'));
    await set(obraKey(rota), { schemaVersion: 1, data: { roto: true } });
    await hydrate();
    await guardarComoV7(rota); // entre el banner y el clic
    await discardRecovery(obraKey(rota));
    expect(await get(obraKey(rota))).toEqual(v7Envelope);
    expect((await registry.loadIndex()).obras.some((m) => m.id === rota)).toBe(true);
    expect(usePersistStore.getState().masNueva?.id).toBe(rota);
  });

  it('borrar la activa cuando solo queda una v7: obra en blanco y la v7 intacta', async () => {
    const a = await registry.createObra(withName('A'));
    await registry.setActiveId(a);
    const v7 = await registrarV7('Del futuro');
    await hydrate();
    await deleteObraById(a);
    const activa = getActiveObraId()!;
    expect(activa).not.toBe(v7);
    expect((await registry.loadObraData(activa)).kind).toBe('ok');
    expect(await get(obraKey(v7))).toEqual(v7Envelope);
    expect(usePersistStore.getState().masNueva?.id).toBe(v7);
  });
});

describe('traspaso del candado entre pestañas (Etapa 0)', () => {
  /** Otra pestaña es dueña de `id` hasta que se aborta el controlador devuelto. */
  async function otraPestanaDuena(mgr: FakeLockManager, id: string): Promise<AbortController> {
    const ac = new AbortController();
    void mgr.request(`concreta.obra.${id}`, { mode: 'exclusive' }, heldUntil(ac.signal));
    await tick();
    return ac;
  }

  async function arrancarEnSoloLectura(): Promise<{ id: string; otra: AbortController }> {
    const id = await registry.createObra(withName('A'));
    await registry.setActiveId(id);
    const mgr = new FakeLockManager();
    __setLockManagerForTests(mgr);
    const otra = await otraPestanaDuena(mgr, id);
    await hydrate();
    await tick();
    expect(session().readonlyMotivo).toBe('otra-pestana');
    return { id, otra };
  }

  it('si al heredarla está en v7: sigue en solo lectura y la siguiente edición no la pisa', async () => {
    const { id, otra } = await arrancarEnSoloLectura();
    await guardarComoV7(id); // la otra pestaña (ya actualizada) la guardó en v7
    otra.abort(); // y se cierra → traspaso
    await vi.waitFor(() => expect(session().readonlyMotivo).toBe('mas-nueva'));
    state().editPartidaField('01', 'p111', 'title', 'Pisaría la v7');
    await flushPending();
    expect(await get(obraKey(id))).toEqual(v7Envelope);
  });

  it('si al heredarla se lee bien: pasa a dueña con lo que dejó la otra pestaña', async () => {
    const { id, otra } = await arrancarEnSoloLectura();
    await registry.saveActiveObra(id, withName('Guardada por la otra'));
    otra.abort();
    await vi.waitFor(() => expect(session().readonly).toBe(false));
    expect(state().obra.denominacion).toBe('Guardada por la otra');
    state().editPartidaField('01', 'p111', 'title', 'Ahora aquí');
    await flushPending();
    const res = await registry.loadObraData(id);
    expect(res.kind === 'ok' && titleOf(res.data)).toBe('Ahora aquí');
  });

  it('si al heredarla no se puede leer: sigue en solo lectura y no escribe', async () => {
    const { id, otra } = await arrancarEnSoloLectura();
    const rota = { schemaVersion: 1, data: { roto: true } };
    await set(obraKey(id), rota);
    otra.abort();
    await vi.waitFor(() => expect(session().readonlyMotivo).toBe('sin-recargar'));
    expect(usePersistStore.getState().recoveryKey).toBe(obraKey(id));
    state().editPartidaField('01', 'p111', 'title', 'Pisaría');
    await flushPending();
    expect(await get(obraKey(id))).toEqual(rota);
  });
});

describe('recordatorio de copia: `ultimaCopia` (Etapa 0)', () => {
  const copiaDe = async (id: string) =>
    (await registry.loadIndex()).obras.find((m) => m.id === id)?.ultimaCopia;

  it('exportar → editar → autosave → recargar conserva la fecha', async () => {
    await hydrate();
    state().editPartidaField('01', 'p111', 'title', 'A');
    await flushPending();
    const id = getActiveObraId()!;
    descargarCopia();
    await vi.waitFor(async () => expect(await copiaDe(id)).toBeTruthy());
    const fecha = await copiaDe(id);

    state().editPartidaField('01', 'p111', 'title', 'A editada');
    await flushPending();
    expect(await copiaDe(id)).toBe(fecha);

    __resetSyncForTests();
    state().reset();
    await hydrate(); // «recargar»
    expect(session().obras.find((m) => m.id === id)?.ultimaCopia).toBe(fecha);
  });

  it('la demo sin guardar no sella nada (no hay obra en el registro)', async () => {
    await hydrate();
    descargarCopia();
    await tick();
    expect((await registry.loadIndex()).obras).toEqual([]);
  });

  it('importar no hereda la fecha de la obra sustituida', async () => {
    await hydrate();
    state().editPartidaField('01', 'p111', 'title', 'Anterior');
    await flushPending();
    const id = getActiveObraId()!;
    descargarCopia();
    await vi.waitFor(async () => expect(await copiaDe(id)).toBeTruthy());

    await expect(importarSobreActiva(withName('Importada'))).resolves.toEqual({ kind: 'ok' });
    expect(getActiveObraId()).toBe(id); // sustituye la misma entrada
    expect(await copiaDe(id)).toBeUndefined();
    const res = await registry.loadObraData(id);
    expect(res.kind === 'ok' && res.data.obra.denominacion).toBe('Importada');
  });
});

describe('importar .json: un guardado fallido no se da por bueno (Etapa 0)', () => {
  async function obraGuardada(title: string): Promise<string> {
    await hydrate();
    state().editPartidaField('01', 'p111', 'title', title);
    await flushPending();
    return getActiveObraId()!;
  }

  it('si la importada no llega a disco: lo dice y deja volver a la anterior', async () => {
    const id = await obraGuardada('Anterior');
    vi.mocked(registry.saveActiveObra).mockRejectedValueOnce(new Error('QuotaExceededError'));
    await expect(importarSobreActiva(withName('Importada'))).resolves.toEqual({
      kind: 'sin-guardar',
      puedeVolver: true,
    });
    expect(state().obra.denominacion).toBe('Importada'); // en pantalla, sin guardar
    const disco = await registry.loadObraData(id);
    expect(disco.kind === 'ok' && titleOf(disco.data)).toBe('Anterior'); // la anterior, intacta

    await expect(volverAObraGuardada()).resolves.toBe(true);
    expect(titleOf(toSerializable(state()))).toBe('Anterior');
    expect(usePersistStore.getState().status).toBe('idle');
  });

  it('si la ACTUAL no llega a disco: no importa nada', async () => {
    await obraGuardada('Base');
    state().editPartidaField('01', 'p111', 'title', 'Sin guardar aún');
    vi.mocked(registry.saveActiveObra).mockRejectedValueOnce(new Error('QuotaExceededError'));
    await expect(importarSobreActiva(withName('Importada'))).resolves.toEqual({
      kind: 'sin-guardar-actual',
    });
    expect(titleOf(toSerializable(state()))).toBe('Sin guardar aún');
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled(); // ni copia previa
  });

  it('en solo lectura no importa (no se guardaría nada)', async () => {
    const id = await obraGuardada('A');
    await guardarComoV7(id);
    state().editPartidaField('01', 'p111', 'title', 'B');
    await flushPending(); // descubre la v7 → solo lectura
    await expect(importarSobreActiva(withName('Importada'))).resolves.toEqual({
      kind: 'solo-lectura',
    });
    expect(await get(obraKey(id))).toEqual(v7Envelope);
  });

  it('obra nueva con la actual sin guardar: no la sustituye', async () => {
    const id = await obraGuardada('A');
    state().editPartidaField('01', 'p111', 'title', 'En riesgo');
    vi.mocked(registry.saveActiveObra).mockRejectedValueOnce(new Error('QuotaExceededError'));
    await expect(newObra('B')).resolves.toBeNull();
    expect(getActiveObraId()).toBe(id);
    expect(titleOf(toSerializable(state()))).toBe('En riesgo');
    expect(useToastStore.getState().msg).toMatch(/No se pudo guardar/);
  });
});

it('la clave de versión nace con el primer guardado', async () => {
  await hydrate();
  state().editPartidaField('01', 'p111', 'title', 'X');
  await flushPending();
  const id = getActiveObraId()!;
  expect(await get(versionKey(obraKey(id)))).toBe(SCHEMA_VERSION);
  expect((await loadObraEnvelope(obraKey(id))).kind).toBe('ok');
});

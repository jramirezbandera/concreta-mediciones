/* ===========================================================================
   persist — espacio de claves v6 y migración de las obras v5 (medir sobre
   planos PDF, §1.1 de la especificación):
     · el índice v6 nace del v5 y marca `porMigrar`;
     · una v5 se migra UNA vez, solo en la pestaña dueña (ni en solo lectura ni
       desde Referencia), y sella `concreta.version.<id> = 6`;
     · cambios antiguos, limpieza a los 30 días y borrar con sus claves v5.
   =========================================================================== */
import 'fake-indexeddb/auto';
import { clear, del, get, set } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadObraRefSource } from '../features/referencia/obraSource';
import { toSerializable, useObraStore, useToastStore, type ObraData } from '../store';
import { FakeLockManager, heldUntil, tick } from '../test/fakeLocks';
import { obraKey, obraKeys, saveObra, v5ObraKey, v5VersionKey } from './persist';
import { usePersistStore } from './persistStore';
import {
  DIAS_COPIA_V5,
  INDEX_KEY,
  V5_INDEX_KEY,
  limpiarCopiasV5,
  loadIndex,
  loadObraData,
  reconcile,
  type ObraIndex,
  type ObraMeta,
} from './registry';
import { useSessionStore } from './sessionStore';
import {
  __resetSyncForTests,
  abrirCambiosAntiguos,
  deleteObraById,
  flushPending,
  getActiveObraId,
  hydrate,
  ignorarCambiosAntiguos,
} from './sync';
import { __setLockManagerForTests } from './tabLock';

const state = () => useObraStore.getState();
const session = () => useSessionStore.getState();

/** `ObraData` v5 tal como la guardaba la app anterior (sin `planos`). */
function datosV5(name: string): ObraData {
  const d = { ...toSerializable(state()), schemaVersion: 5, obra: { denominacion: name, direccion: '', localidad: '' } } as Partial<ObraData>;
  delete d.planos;
  return d as ObraData;
}

const T0 = '2026-09-01T10:00:00.000Z';
const T0_INDICE = '2026-09-01T10:00:00.040Z'; // `metaOf` sella el índice DESPUÉS del sobre

/** Escribe una obra como la dejaría la app v5: sobre, clave de versión y meta. */
async function obraV5(
  id: string,
  name: string,
  over: { savedAt?: string; indiceSavedAt?: string; meta?: Partial<ObraMeta> } = {},
): Promise<ObraMeta> {
  await set(v5ObraKey(id), { schemaVersion: 5, savedAt: over.savedAt ?? T0, appVersion: '0.6', data: datosV5(name) });
  await set(v5VersionKey(id), 5);
  return { id, name, savedAt: over.indiceSavedAt ?? T0_INDICE, schemaVersion: 5, ...over.meta };
}

async function indiceV5(activeId: string | null, obras: ObraMeta[]): Promise<void> {
  await set(V5_INDEX_KEY, { activeId, obras } satisfies ObraIndex);
}

/** Dos obras v5 («A» activa y «B» de referencia con fecha de copia). */
async function dosObrasV5(): Promise<void> {
  const a = await obraV5('a', 'A', { meta: { ultimaCopia: '2026-09-10T00:00:00.000Z' } });
  const b = await obraV5('b', 'B', { meta: { kind: 'reference' } });
  await indiceV5('a', [a, b]);
}

/** Una pestaña antigua sigue guardando la obra `id` en v5, más tarde. */
async function pestanaAntiguaGuarda(id: string, name: string, cuando = '2026-10-05T10:00:00.000Z'): Promise<void> {
  const v5 = (await get(V5_INDEX_KEY)) as ObraIndex;
  await set(v5ObraKey(id), { schemaVersion: 5, savedAt: cuando, appVersion: '0.6', data: datosV5(name) });
  await indiceV5(
    v5.activeId,
    v5.obras.map((m) => (m.id === id ? { ...m, name, savedAt: cuando.replace('.000Z', '.040Z') } : m)),
  );
}

/** Abre la app como una pestaña nueva (sin estado de sync previo). */
async function abrirPestana(): Promise<void> {
  __resetSyncForTests();
  state().reset();
  await hydrate();
  await flushPending();
  for (let i = 0; i < 5; i++) await tick(); // la revisión de cambios antiguos es asíncrona
}

beforeEach(async () => {
  await clear();
  state().reset();
  __resetSyncForTests();
  usePersistStore.setState({ status: 'idle', recovery: null, recoveryKey: null, masNueva: null, cambiosAntiguos: null });
  useToastStore.setState({ msg: null, action: null, tick: 0 });
});

afterEach(() => {
  __setLockManagerForTests(null);
});

describe('el índice v6 nace del v5', () => {
  it('misma lista, mismo orden, misma activa y la meta tal cual, «por migrar»', async () => {
    await dosObrasV5();
    const mgr = new FakeLockManager();
    __setLockManagerForTests(mgr);
    const otra = new AbortController();
    void mgr.request('concreta.obra.a', { mode: 'exclusive' }, heldUntil(otra.signal)); // solo lectura: no migra
    await tick();
    await hydrate();
    const idx = await loadIndex();
    expect(idx.activeId).toBe('a');
    expect(idx.obras.map((m) => [m.id, m.name, m.kind, m.ultimaCopia, m.porMigrar])).toEqual([
      ['a', 'A', undefined, '2026-09-10T00:00:00.000Z', true],
      ['b', 'B', 'reference', undefined, true],
    ]);
    otra.abort();
  });

  it('reconcile no lista las claves v5 como obras, conserva las «por migrar» con clave v5 y añade las nuevas del índice v5', async () => {
    await dosObrasV5();
    const mgr = new FakeLockManager();
    __setLockManagerForTests(mgr);
    const otra = new AbortController();
    void mgr.request('concreta.obra.a', { mode: 'exclusive' }, heldUntil(otra.signal));
    await tick();
    await hydrate();
    expect(await obraKeys()).toEqual([]); // nada escrito en v6 todavía
    // una pestaña antigua crea «C»
    const c = await obraV5('c', 'C');
    const v5 = (await get(V5_INDEX_KEY)) as ObraIndex;
    await indiceV5(v5.activeId, [...v5.obras, c]);
    let idx = await reconcile();
    expect(idx.obras.map((m) => m.id)).toEqual(['a', 'b', 'c']);
    expect(idx.obras.every((m) => m.porMigrar)).toBe(true);
    // sin clave v5, una «por migrar» se va como cualquier entrada sin sobre
    await del(v5ObraKey('b'));
    idx = await reconcile();
    expect(idx.obras.map((m) => m.id)).toEqual(['a', 'c']);
    otra.abort();
  });
});

describe('migrar: una vez y solo la pestaña dueña', () => {
  it('la dueña migra al abrir: sobre v6, `migracionV5` con los dos savedAt y `concreta.version.<id> = 6`', async () => {
    await dosObrasV5();
    await hydrate();
    await flushPending();
    expect(getActiveObraId()).toBe('a');
    expect(state().planos).toEqual([]);
    const env = (await get(obraKey('a'))) as { schemaVersion: number; data: ObraData };
    expect(env.schemaVersion).toBe(6);
    expect(env.data.planos).toEqual([]);
    expect(env.data.obra.denominacion).toBe('A');
    const meta = (await loadIndex()).obras.find((m) => m.id === 'a')!;
    expect(meta.porMigrar).toBeUndefined();
    expect(meta.migracionV5).toMatchObject({ savedAt: T0, indiceSavedAt: T0_INDICE });
    expect(meta.ultimaCopia).toBe('2026-09-10T00:00:00.000Z'); // la meta se fusiona
    expect(await get(v5VersionKey('a'))).toBe(6);
    // la copia v5 se queda tal cual
    expect(((await get(v5ObraKey('a'))) as { savedAt: string }).savedAt).toBe(T0);
    // B no se ha abierto: sigue por migrar, sin sobre v6
    expect(await get(obraKey('b'))).toBeUndefined();
  });

  it('abrirla otra vez no vuelve a migrar', async () => {
    await dosObrasV5();
    await abrirPestana();
    const antes = (await get(obraKey('a'))) as { savedAt: string };
    const meta = (await loadIndex()).obras.find((m) => m.id === 'a')!;
    await abrirPestana();
    expect(((await get(obraKey('a'))) as { savedAt: string }).savedAt).toBe(antes.savedAt);
    expect((await loadIndex()).obras.find((m) => m.id === 'a')!.migracionV5).toEqual(meta.migracionV5);
  });

  it('una pestaña de solo lectura la lee migrada en memoria y no escribe', async () => {
    await dosObrasV5();
    const mgr = new FakeLockManager();
    __setLockManagerForTests(mgr);
    const otra = new AbortController();
    void mgr.request('concreta.obra.a', { mode: 'exclusive' }, heldUntil(otra.signal));
    await tick();
    await hydrate();
    await tick();
    expect(session().readonly).toBe(true);
    expect(state().obra.denominacion).toBe('A');
    expect(state().planos).toEqual([]);
    await flushPending();
    expect(await get(obraKey('a'))).toBeUndefined();
    expect(await get(v5VersionKey('a'))).toBe(5);
    // al heredar el candado, la migra
    otra.abort();
    await vi.waitFor(() => expect(session().readonly).toBe(false));
    await flushPending();
    await vi.waitFor(async () => expect(await get(v5VersionKey('a'))).toBe(6));
    expect(((await get(obraKey('a'))) as { schemaVersion: number }).schemaVersion).toBe(6);
  });

  it('Referencia la lee de la clave v5 y no escribe', async () => {
    await dosObrasV5();
    const src = await loadObraRefSource('b', 'B');
    expect(src && src !== 'mas-nueva' && src.name).toBe('B');
    expect(await get(obraKey('b'))).toBeUndefined();
    const res = await loadObraData('b');
    expect(res.kind === 'ok' && res.v5).toEqual({ savedAt: T0, indiceSavedAt: T0_INDICE });
  });

  it('tras migrar, una pestaña con la Etapa 0 que guarde esa obra en v5 recibe `version-conflict`', async () => {
    await dosObrasV5();
    await abrirPestana();
    // así escribe la Etapa 0: compara con `concreta.version.<id>` antes de pisar
    expect(await saveObra(v5ObraKey('a'), datosV5('A editada en la vieja'))).toBe('version-conflict');
    expect(((await get(v5ObraKey('a'))) as { data: ObraData }).data.obra.denominacion).toBe('A');
  });
});

describe('cambios antiguos', () => {
  it('una obra migrada sin cambios NO avisa', async () => {
    await dosObrasV5();
    await abrirPestana();
    await abrirPestana();
    expect(usePersistStore.getState().cambiosAntiguos).toBeNull();
  });

  it('pestaña antigua que siguió guardando: la v6 queda intacta y sale el aviso; «Ignorar» no vuelve a avisar', async () => {
    await dosObrasV5();
    await abrirPestana();
    state().editPartidaField('01', 'p111', 'title', 'Editada en v6');
    await flushPending();
    await pestanaAntiguaGuarda('a', 'A de la vieja');
    await abrirPestana();
    await vi.waitFor(() => expect(usePersistStore.getState().cambiosAntiguos).toEqual({ id: 'a', nombre: 'A' }));
    expect(state().obra.denominacion).toBe('A'); // la v6, intacta
    expect(state().partidas['01']!.find((p) => p.id === 'p111')!.title).toBe('Editada en v6');
    await ignorarCambiosAntiguos();
    expect(usePersistStore.getState().cambiosAntiguos).toBeNull();
    await abrirPestana();
    expect(usePersistStore.getState().cambiosAntiguos).toBeNull();
  });

  it('«Abrir esos cambios como obra aparte» crea una obra nueva con ellos y no vuelve a avisar', async () => {
    await dosObrasV5();
    await abrirPestana();
    await pestanaAntiguaGuarda('a', 'A de la vieja');
    await abrirPestana();
    await vi.waitFor(() => expect(usePersistStore.getState().cambiosAntiguos).not.toBeNull());
    expect(await abrirCambiosAntiguos()).toBe(true);
    const idx = await loadIndex();
    const nueva = idx.obras.find((m) => m.name === 'A (cambios de la versión antigua)');
    expect(nueva).toBeTruthy();
    const res = await loadObraData(nueva!.id);
    expect(res.kind === 'ok' && res.data.schemaVersion).toBe(6);
    expect(getActiveObraId()).toBe('a'); // la obra en pantalla no cambia
    await abrirPestana();
    expect(usePersistStore.getState().cambiosAntiguos).toBeNull();
  });
});

describe('limpieza de la copia v5', () => {
  const DIA = 86_400_000;
  async function migradaHace(dias: number): Promise<void> {
    await dosObrasV5();
    await abrirPestana();
    const idx = await loadIndex();
    const at = new Date(Date.now() - dias * DIA).toISOString();
    await set(INDEX_KEY, {
      ...idx,
      obras: idx.obras.map((m) => (m.id === 'a' ? { ...m, migracionV5: { ...m.migracionV5!, at } } : m)),
    });
  }

  it(`a los ${DIAS_COPIA_V5} días, con la meta y el sobre v5 sin cambios, borra la copia v5`, async () => {
    await migradaHace(31);
    expect(await limpiarCopiasV5()).toEqual(['a']);
    expect(await get(v5ObraKey('a'))).toBeUndefined();
    expect(await get(v5VersionKey('a'))).toBeUndefined();
    expect(((await get(V5_INDEX_KEY)) as ObraIndex).obras.map((m) => m.id)).toEqual(['b']);
    expect((await reconcile()).obras.map((m) => m.id)).toEqual(['a', 'b']); // la v6 sigue
  });

  it('no borra antes de los 30 días ni si la meta o el sobre v5 cambiaron', async () => {
    await migradaHace(10);
    expect(await limpiarCopiasV5()).toEqual([]);
    await clear();
    __resetSyncForTests();
    await migradaHace(31);
    await pestanaAntiguaGuarda('a', 'A tocada');
    expect(await limpiarCopiasV5()).toEqual([]);
    expect(await get(v5ObraKey('a'))).toBeTruthy();
  });
});

describe('borrar una obra borra también sus claves v5', () => {
  it('y `reconcile` no la vuelve a traer «por migrar»', async () => {
    await dosObrasV5();
    await abrirPestana();
    await deleteObraById('b');
    expect(await get(v5ObraKey('b'))).toBeUndefined();
    expect(await get(v5VersionKey('b'))).toBeUndefined();
    expect(((await get(V5_INDEX_KEY)) as ObraIndex).obras.map((m) => m.id)).toEqual(['a']);
    expect((await reconcile()).obras.map((m) => m.id)).toEqual(['a']);
  });
});

import 'fake-indexeddb/auto';
import { clear, get, set } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, seedObraData, toSerializable, type ObraData } from '../store';
import { OBRA_KEY, loadObraEnvelope, obraKey, saveObra } from './persist';
import { usePersistStore } from './persistStore';
import {
  INDEX_KEY,
  createObra,
  deleteObra,
  listObras,
  loadIndex,
  loadObraData,
  migrateLegacy,
  reconcile,
  saveActiveObra,
  setActiveId,
  setUltimaCopia,
} from './registry';

const data = (name: string): ObraData => ({
  ...toSerializable(seedObraData()),
  obra: { denominacion: name, direccion: '', localidad: '' },
});

beforeEach(async () => {
  await clear();
  usePersistStore.setState({ status: 'idle', recovery: null, recoveryKey: null });
});

describe('registry · CRUD', () => {
  it('createObra persiste el blob INMEDIATAMENTE y registra meta', async () => {
    const id = await createObra(data('Nueva'));
    expect((await loadObraEnvelope(obraKey(id))).kind).toBe('ok');
    expect((await listObras()).map((m) => m.name)).toContain('Nueva');
  });

  it('saveActiveObra registra, marca activa y actualiza meta EN SITIO (sin duplicar)', async () => {
    const id = await createObra(data('X'));
    await saveActiveObra(id, data('X renombrada'));
    const idx = await loadIndex();
    expect(idx.activeId).toBe(id);
    expect(idx.obras.filter((m) => m.id === id).length).toBe(1);
    expect(idx.obras.find((m) => m.id === id)!.name).toBe('X renombrada');
  });

  it('deleteObra quita blob + entrada; si era la activa salta a otra', async () => {
    const a = await createObra(data('A'));
    const b = await createObra(data('B'));
    await saveActiveObra(a, data('A')); // a activa
    await deleteObra(a);
    expect((await loadObraEnvelope(obraKey(a))).kind).toBe('empty');
    const idx = await loadIndex();
    expect(idx.obras.map((m) => m.id)).toEqual([b]);
    expect(idx.activeId).toBe(b);
  });
});

describe('registry · reconcile (auto-cura índice ↔ blobs)', () => {
  it('quita entradas sin blob, añade blobs huérfanos y sanea activeId', async () => {
    const a = await createObra(data('A'));
    const idx0 = await loadIndex();
    // entrada fantasma (sin blob) + activeId apuntando a ella
    await set(INDEX_KEY, {
      activeId: 'fantasma',
      obras: [...idx0.obras, { id: 'fantasma', name: 'F', savedAt: 'x', schemaVersion: 2 }],
    });
    // blob huérfano (sin entrada en el índice)
    await saveObra(obraKey('orphan-1'), data('Huérfana'));

    const idx = await reconcile();
    const ids = idx.obras.map((m) => m.id);
    expect(ids).toContain(a); // conservada
    expect(ids).toContain('orphan-1'); // huérfano añadido
    expect(ids).not.toContain('fantasma'); // fantasma quitado
    expect(idx.activeId).not.toBe('fantasma'); // activeId saneado
  });
});

describe('registry · escrituras de índice ATÓMICAS (sin clobber)', () => {
  it('createObra concurrentes: ambas quedan en el índice (read-modify-write serializado)', async () => {
    const [a, b] = await Promise.all([createObra(data('A')), createObra(data('B'))]);
    // Se comprueba sobre loadIndex (NO listObras, que reconcilia y enmascararía el clobber).
    const ids = (await loadIndex()).obras.map((m) => m.id);
    expect(ids).toContain(a);
    expect(ids).toContain(b);
    expect(ids.length).toBe(2);
  });

  it('saveActiveObra + createObra concurrentes no pierden ninguna entrada', async () => {
    const a = await createObra(data('A'));
    const [, b] = await Promise.all([saveActiveObra(a, data('A2')), createObra(data('B'))]);
    const ids = (await loadIndex()).obras.map((m) => m.id);
    expect(ids).toContain(a);
    expect(ids).toContain(b);
    expect(ids.length).toBe(2);
  });
});

describe('registry · migrateLegacy (idempotente)', () => {
  it('mueve la obra legacy al registro y borra la clave legacy', async () => {
    await set(OBRA_KEY, { schemaVersion: 2, savedAt: 'x', appVersion: '0.6', data: data('Legacy') });
    await migrateLegacy();
    expect(await get(OBRA_KEY)).toBeUndefined();
    const list = await listObras();
    expect(list.length).toBe(1);
    expect(list[0]!.name).toBe('Legacy');
    expect((await loadIndex()).activeId).toBe(list[0]!.id);
  });

  it('no re-migra si el índice ya existe', async () => {
    await set(OBRA_KEY, { schemaVersion: 2, savedAt: 'x', appVersion: '0.6', data: data('Legacy') });
    await migrateLegacy();
    // reaparece una legacy: con índice presente, NO debe migrarla otra vez
    await set(OBRA_KEY, { schemaVersion: 2, savedAt: 'y', appVersion: '0.6', data: data('Otra') });
    await migrateLegacy();
    expect((await listObras()).length).toBe(1);
  });

  it('legacy corrupta → índice vacío, CONSERVA el blob legacy Y marca recuperación (A-03)', async () => {
    await set(OBRA_KEY, { schemaVersion: 1, data: { roto: true } });
    await migrateLegacy();
    expect(await get(OBRA_KEY)).toBeDefined();
    expect((await listObras()).length).toBe(0);
    // A-03: antes el banner era inalcanzable en esta ruta — el usuario que
    // actualizaba desde mono-obra con datos dañados percibía pérdida total.
    expect(usePersistStore.getState().recovery).not.toBeNull();
    expect(usePersistStore.getState().recoveryKey).toBe(OBRA_KEY);
  });

  it('instalación nueva (sin legacy) → no crea índice (la demo no se fosiliza)', async () => {
    await migrateLegacy();
    expect(await get(INDEX_KEY)).toBeUndefined();
  });
});

describe('registry · loadObraData con tipo (Etapa 0)', () => {
  it('distingue ok, vacía, dañada y más nueva; la versión se mira antes que la forma', async () => {
    const id = await createObra(data('Sana'));
    expect((await loadObraData(id)).kind).toBe('ok');
    expect((await loadObraData('no-existe')).kind).toBe('vacia');
    await set(obraKey('rota'), { schemaVersion: 1, data: { roto: true } });
    expect((await loadObraData('rota')).kind).toBe('danada');
    const v7 = SCHEMA_VERSION + 2;
    await set(obraKey('v7'), { schemaVersion: v7, savedAt: 'x', appVersion: '9', data: { otra: 1 } });
    const res = await loadObraData('v7');
    expect(res).toMatchObject({ kind: 'mas-nueva', version: v7 });
  });
});

describe('registry · meta FUSIONADA (Etapa 0)', () => {
  it('el autosave conserva kind, ultimaCopia y campos que no conoce', async () => {
    const id = await createObra(data('Ref'), 'reference');
    await setUltimaCopia(id, '2026-09-01T10:00:00.000Z');
    // Un campo de una versión futura en la meta del índice (p. ej. `huellas`).
    const idx0 = await loadIndex();
    await set(INDEX_KEY, {
      ...idx0,
      obras: idx0.obras.map((m) => (m.id === id ? { ...m, huellas: ['h1'] } : m)),
    });
    await saveActiveObra(id, data('Ref renombrada'));
    const meta = (await loadIndex()).obras.find((m) => m.id === id)!;
    expect(meta).toMatchObject({
      name: 'Ref renombrada',
      kind: 'reference',
      ultimaCopia: '2026-09-01T10:00:00.000Z',
      huellas: ['h1'],
    });
  });

  it('setUltimaCopia sella y borra; sin entrada en el índice no hace nada', async () => {
    const id = await createObra(data('A'));
    await setUltimaCopia(id, '2026-09-20T08:00:00.000Z');
    expect((await loadIndex()).obras[0]!.ultimaCopia).toBe('2026-09-20T08:00:00.000Z');
    await setUltimaCopia(id, null);
    expect((await loadIndex()).obras[0]).not.toHaveProperty('ultimaCopia');
    const before = await loadIndex();
    await setUltimaCopia('no-registrada', '2026-09-20T08:00:00.000Z');
    expect(await loadIndex()).toEqual(before);
  });

  it('crear una obra no hereda fecha de copia', async () => {
    const a = await createObra(data('A'));
    await setUltimaCopia(a, '2026-09-20T08:00:00.000Z');
    const b = await createObra(data('B'));
    expect((await loadIndex()).obras.find((m) => m.id === b)).not.toHaveProperty('ultimaCopia');
  });

  it('saveActiveObra ante una versión más nueva en disco: rechazo terminal, índice intacto', async () => {
    const id = await createObra(data('A'));
    await setActiveId(id);
    const futuro = { schemaVersion: SCHEMA_VERSION + 1, savedAt: 'x', appVersion: '9', data: {} };
    await set(obraKey(id), futuro);
    await set(`concreta.version.${id}`, SCHEMA_VERSION + 1);
    const before = await loadIndex();
    expect(await saveActiveObra(id, data('Pisaría'))).toEqual({ kind: 'version-conflict' });
    expect(await loadIndex()).toEqual(before);
    expect(await get(obraKey(id))).toEqual(futuro);
  });
});

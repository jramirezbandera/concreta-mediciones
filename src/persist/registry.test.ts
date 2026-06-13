import 'fake-indexeddb/auto';
import { clear, get, set } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedObraData, toSerializable, type ObraData } from '../store';
import { OBRA_KEY, loadObraEnvelope, obraKey, saveObra } from './persist';
import {
  INDEX_KEY,
  createObra,
  deleteObra,
  listObras,
  loadIndex,
  migrateLegacy,
  reconcile,
  saveActiveObra,
} from './registry';

const data = (name: string): ObraData => ({
  ...toSerializable(seedObraData()),
  obra: { denominacion: name, direccion: '', localidad: '' },
});

beforeEach(async () => {
  await clear();
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

    const idx = await reconcile(await loadIndex());
    const ids = idx.obras.map((m) => m.id);
    expect(ids).toContain(a); // conservada
    expect(ids).toContain('orphan-1'); // huérfano añadido
    expect(ids).not.toContain('fantasma'); // fantasma quitado
    expect(idx.activeId).not.toBe('fantasma'); // activeId saneado
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

  it('legacy corrupta → índice vacío y CONSERVA el blob legacy (recuperación)', async () => {
    await set(OBRA_KEY, { schemaVersion: 1, data: { roto: true } });
    await migrateLegacy();
    expect(await get(OBRA_KEY)).toBeDefined();
    expect((await listObras()).length).toBe(0);
  });

  it('instalación nueva (sin legacy) → no crea índice (la demo no se fosiliza)', async () => {
    await migrateLegacy();
    expect(await get(INDEX_KEY)).toBeUndefined();
  });
});

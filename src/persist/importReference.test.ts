import 'fake-indexeddb/auto';
import { clear } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ImportedObra } from '../core/bc3import';
import { SCHEMA_VERSION, blankObraData, useObraStore } from '../store';
import { loadObraEnvelope, obraKey } from './persist';
import { loadIndex, loadObraData } from './registry';
import { usePersistStore } from './persistStore';
import { useSessionStore } from './sessionStore';
import {
  __resetSyncForTests,
  flushPending,
  getActiveObraId,
  hydrate,
  importObraAsReference,
} from './sync';

const state = () => useObraStore.getState();

/** `ImportedObra` tal y como lo entrega el parser .bc3: SIN `schemaVersion`. */
function importedBase(name: string): ImportedObra {
  const b = blankObraData(name);
  return {
    chapters: b.chapters,
    partidas: b.partidas,
    recursos: b.recursos,
    certs: b.certs,
    rates: b.rates,
    obra: b.obra,
  };
}

/** Hidrata y registra la obra demo como obra A activa (editándola y guardando). */
async function bootWithDemoA(): Promise<string> {
  await hydrate();
  state().editPartidaField('01', 'p111', 'title', 'A-editada');
  await flushPending();
  return getActiveObraId()!;
}

beforeEach(async () => {
  await clear();
  state().reset();
  __resetSyncForTests();
  usePersistStore.setState({ status: 'idle', recovery: null, recoveryKey: null });
  useSessionStore.setState({ obras: [], activeId: null, switching: false });
});

describe('importObraAsReference (importar como referencia, sin reemplazar)', () => {
  it('[C1] estampa schemaVersion → el blob recarga OK y el índice NO se corrompe', async () => {
    // `importedBase` no trae schemaVersion (como result.data del parser). Si no se
    // estampara, el blob recargaría como `corrupt` y la meta envenenaría el índice.
    const id = await importObraAsReference(importedBase('Base ITeC 2025'));

    const env = await loadObraEnvelope(obraKey(id));
    expect(env.kind).toBe('ok');

    const data = await loadObraData(id);
    expect(data?.schemaVersion).toBe(SCHEMA_VERSION);

    const idx = await loadIndex();
    const meta = idx.obras.find((m) => m.id === id);
    expect(meta).toBeTruthy();
    expect(meta!.kind).toBe('reference');
    expect(typeof meta!.schemaVersion).toBe('number'); // índice sigue válido (isMeta)
  });

  it('NO toca la obra activa ni su dominio', async () => {
    const aId = await bootWithDemoA();
    const chaptersBefore = state().chapters.length;
    const nameBefore = state().obra.denominacion;

    await importObraAsReference(importedBase('Cuadro de precios CYPE'));

    expect(getActiveObraId()).toBe(aId); // sigue activa A
    expect(state().chapters.length).toBe(chaptersBefore);
    expect(state().obra.denominacion).toBe(nameBefore);
  });

  it('refresca el selector vía upsert sin pisar la meta de la activa', async () => {
    const aId = await bootWithDemoA();
    expect(useSessionStore.getState().obras.some((o) => o.id === aId)).toBe(true);

    const refId = await importObraAsReference(importedBase('Base de precios'));

    const obras = useSessionStore.getState().obras;
    expect(obras.some((o) => o.id === aId)).toBe(true); // A no se pierde
    expect(obras.find((o) => o.id === refId)?.kind).toBe('reference');
    expect(useSessionStore.getState().activeId).toBe(aId); // activa intacta
  });
});

import 'fake-indexeddb/auto';
import { clear } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ImportedObra } from '../core/bc3import';
import { SCHEMA_VERSION, blankObraData, fromSerializable, useObraStore } from '../store';
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
    expect(data.kind === 'ok' && data.data.schemaVersion).toBe(SCHEMA_VERSION);

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

describe('importObraAsReference · marca y fuente oficial en los datos (R2, R8)', () => {
  const fuente = {
    baseId: 'bcca',
    organismo: 'Junta de Andalucía',
    edicion: 'V02 · enero 2024',
    actualizada: '2024-01-09',
    pagina: 'https://example.org/bcca',
    descargadaEl: '2026-10-24',
  };

  it('guarda `soloReferencia` y la fuente en `obra`, y la meta las copia', async () => {
    const id = await importObraAsReference(importedBase('BCCA'), fuente);

    const data = await loadObraData(id);
    expect(data.kind === 'ok' && data.data.obra.soloReferencia).toBe(true);
    expect(data.kind === 'ok' && data.data.obra.fuenteOficial).toEqual(fuente);
    const meta = (await loadIndex()).obras.find((m) => m.id === id);
    expect(meta).toMatchObject({ kind: 'reference', fuente });
    expect(useSessionStore.getState().obras.find((o) => o.id === id)?.fuente).toEqual(fuente);
  });

  it('sin fuente (un .bc3 soltado a mano) lleva la marca pero no fuente', async () => {
    const id = await importObraAsReference(importedBase('Mía'));
    const data = await loadObraData(id);
    expect(data.kind === 'ok' && data.data.obra.soloReferencia).toBe(true);
    expect(data.kind === 'ok' && 'fuenteOficial' in data.data.obra).toBe(false);
    expect((await loadIndex()).obras.find((m) => m.id === id)?.fuente).toBeUndefined();
  });

  it('la fuente sobrevive a la copia .json (viaja en los datos)', async () => {
    const id = await importObraAsReference(importedBase('BCCA'), fuente);
    const data = await loadObraData(id);
    if (data.kind !== 'ok') throw new Error('no cargó');
    const copia = fromSerializable(JSON.parse(JSON.stringify(data.data)) as typeof data.data);
    expect(copia.obra.fuenteOficial).toEqual(fuente);
    expect(copia.obra.soloReferencia).toBe(true);
  });
});

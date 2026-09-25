/* ===========================================================================
   persist/sync — A-04 (decisión: BLOQUEAR): `switchObra` no suelta una obra
   cuyos cambios no llegaron a disco. Fichero aparte: el vi.mock espía de
   `registry` no debe contaminar la suite principal de sync.
   =========================================================================== */
import 'fake-indexeddb/auto';
import { clear } from 'idb-keyval';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock(import('./registry'), { spy: true });
import * as registry from './registry';
import { useObraStore, useToastStore } from '../store';
import { usePersistStore } from './persistStore';
import {
  __resetSyncForTests,
  flushPending,
  getActiveObraId,
  hydrate,
  newObra,
  switchObra,
} from './sync';

const state = () => useObraStore.getState();

beforeEach(async () => {
  vi.clearAllMocks(); // limpia colas de mockRejectedValueOnce; el espía conserva la impl real
  await clear();
  state().reset();
  __resetSyncForTests();
  usePersistStore.setState({ status: 'idle', recovery: null, recoveryKey: null });
  useToastStore.setState({ msg: null, action: null, tick: 0 });
});

describe('switchObra ante un guardado fallido (A-04)', () => {
  it('NO conmuta si el flush no aterriza; el reintento posterior guarda y conmuta', async () => {
    await hydrate();
    state().editPartidaField('01', 'p111', 'title', 'A-base');
    await flushPending();
    const aId = getActiveObraId()!;
    const bId = (await newObra('Obra B'))!;
    await switchObra(aId);
    state().editPartidaField('01', 'p111', 'title', 'En riesgo');

    // la cuota "se llena": el próximo guardado rechaza
    vi.mocked(registry.saveActiveObra).mockRejectedValueOnce(new Error('QuotaExceededError'));
    await switchObra(bId);
    expect(getActiveObraId()).toBe(aId); // bloqueado: la edición sigue a la vista
    expect(useToastStore.getState().msg).toMatch(/No se pudo guardar/);
    expect(usePersistStore.getState().status).toBe('error'); // chip «Sin guardar»

    // la cuota "se libera" (el mock era Once): flushPending REINTENTA el guardado
    // fallido y el cambio de obra procede con el dato ya en disco.
    await switchObra(bId);
    expect(getActiveObraId()).toBe(bId);
    const diskA = await registry.loadObraData(aId);
    expect(
      diskA.kind === 'ok' && diskA.data.partidas['01']!.find((p) => p.id === 'p111')!.title,
    ).toBe('En riesgo');
  });
});

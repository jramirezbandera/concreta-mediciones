import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __setLockManagerForTests,
  claimObra,
  lockSupported,
  releaseActiveLock,
  type OwnerReason,
} from './tabLock';
import { FakeLockManager, heldUntil, tick } from '../test/fakeLocks';

let mgr: FakeLockManager;
beforeEach(() => {
  mgr = new FakeLockManager();
  __setLockManagerForTests(mgr);
});
afterEach(() => {
  releaseActiveLock();
  __setLockManagerForTests(null);
});

describe('tabLock', () => {
  it('sin Web Locks API: dueña inmediata (pestaña única)', () => {
    __setLockManagerForTests(null);
    expect(lockSupported()).toBe(false);
    const events: Array<[string, OwnerReason?]> = [];
    claimObra('A', {
      onOwner: (r) => events.push(['owner', r]),
      onReadonly: () => events.push(['readonly']),
    });
    expect(events).toEqual([['owner', 'initial']]);
  });

  it('lock libre: se vuelve dueña (initial)', async () => {
    const events: Array<[string, OwnerReason?]> = [];
    claimObra('A', {
      onOwner: (r) => events.push(['owner', r]),
      onReadonly: () => events.push(['readonly']),
    });
    await tick();
    expect(events).toEqual([['owner', 'initial']]);
  });

  it('lock ocupado por otra pestaña: solo-lectura y luego TRASPASO al liberar', async () => {
    // "Otra pestaña" toma el lock de la obra X.
    const otherAc = new AbortController();
    void mgr.request('concreta.obra.X', { mode: 'exclusive' }, heldUntil(otherAc.signal));
    await tick();

    const events: Array<[string, OwnerReason?]> = [];
    claimObra('X', {
      onOwner: (r) => events.push(['owner', r]),
      onReadonly: () => events.push(['readonly']),
    });
    await tick();
    expect(events).toEqual([['readonly']]); // la tiene la otra pestaña

    // La otra pestaña se cierra → el lock se libera → traspaso automático.
    otherAc.abort();
    await tick();
    await tick();
    expect(events).toEqual([['readonly'], ['owner', 'handoff']]);
  });

  it('conmutar de obra libera el lock anterior para otra pestaña', async () => {
    // Esta pestaña es dueña de X.
    claimObra('X', { onOwner: () => {}, onReadonly: () => {} });
    await tick();

    // Otra pestaña espera X (bloqueante): no debe entrar hasta que soltemos.
    const otherAc = new AbortController();
    let otherOwned = false;
    void mgr.request('concreta.obra.X', { mode: 'exclusive', signal: otherAc.signal }, async () => {
      otherOwned = true;
      await heldUntil(otherAc.signal)();
    });
    await tick();
    expect(otherOwned).toBe(false);

    // Conmutamos a Y → claimObra libera X → la otra pestaña la toma.
    claimObra('Y', { onOwner: () => {}, onReadonly: () => {} });
    await tick();
    expect(otherOwned).toBe(true);
    otherAc.abort();
  });

  it('releaseActiveLock libera sin reclamar otra', async () => {
    claimObra('X', { onOwner: () => {}, onReadonly: () => {} });
    await tick();
    const otherAc = new AbortController();
    let otherOwned = false;
    void mgr.request('concreta.obra.X', { mode: 'exclusive', signal: otherAc.signal }, async () => {
      otherOwned = true;
      await heldUntil(otherAc.signal)();
    });
    await tick();
    expect(otherOwned).toBe(false);

    releaseActiveLock();
    await tick();
    expect(otherOwned).toBe(true);
    otherAc.abort();
  });
});

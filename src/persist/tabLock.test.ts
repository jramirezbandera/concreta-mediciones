import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __setLockManagerForTests,
  claimObra,
  lockSupported,
  releaseActiveLock,
  type LockManagerLike,
  type OwnerReason,
} from './tabLock';

/* Fake LockManager con la semántica que usa el código:
   · exclusivo por nombre (un solo titular a la vez),
   · `ifAvailable`: si está libre concede; si no, llama al cb con `null`,
   · sin `ifAvailable`: si está ocupado, ENCOLA y concede al liberarse,
   · `signal`: abortar mientras encolado rechaza con AbortError. */
interface QueueEntry {
  grant: () => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

class FakeLockManager implements LockManagerLike {
  private held = new Set<string>();
  private queue = new Map<string, QueueEntry[]>();

  async request(
    name: string,
    options: { mode?: 'exclusive' | 'shared'; ifAvailable?: boolean; signal?: AbortSignal },
    callback: (lock: unknown | null) => Promise<void>,
  ): Promise<void> {
    const free = !this.held.has(name);
    if (options.ifAvailable) {
      if (!free) {
        await callback(null);
        return;
      }
      return this.grant(name, callback);
    }
    if (free) return this.grant(name, callback);
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return new Promise<void>((resolve, reject) => {
      const entry: QueueEntry = {
        grant: () => this.grant(name, callback).then(resolve, reject),
        signal: options.signal,
      };
      const q = this.queue.get(name) ?? [];
      q.push(entry);
      this.queue.set(name, q);
      if (options.signal) {
        entry.onAbort = () => {
          const arr = this.queue.get(name) ?? [];
          const i = arr.indexOf(entry);
          if (i >= 0) arr.splice(i, 1);
          reject(new DOMException('Aborted', 'AbortError'));
        };
        options.signal.addEventListener('abort', entry.onAbort, { once: true });
      }
    });
  }

  private async grant(name: string, callback: (lock: unknown) => Promise<void>): Promise<void> {
    this.held.add(name);
    try {
      await callback({ name });
    } finally {
      this.held.delete(name);
      const q = this.queue.get(name);
      const next = q?.shift();
      if (next) {
        // Al conceder, el titular ya no está encolado: quitar su listener de abort
        // (si no, un abort posterior rechazaría una promesa ya resuelta).
        if (next.signal && next.onAbort) next.signal.removeEventListener('abort', next.onAbort);
        next.grant();
      }
    }
  }
}

/** Mantiene el lock hasta que `signal` aborte (simula una pestaña dueña viva). */
function heldUntil(signal: AbortSignal): () => Promise<void> {
  return () =>
    new Promise<void>((resolve) => {
      if (signal.aborted) return resolve();
      signal.addEventListener('abort', () => resolve(), { once: true });
    });
}

const tick = () => new Promise((r) => setTimeout(r, 0));

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

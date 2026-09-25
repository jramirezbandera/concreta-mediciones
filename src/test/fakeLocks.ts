/* ===========================================================================
   Web Locks falsos para tests (T-19): la semántica que usa `persist/tabLock`.
   Compartido por los tests del candado y los del traspaso en `persist/sync`.
   =========================================================================== */
import type { LockManagerLike } from '../persist/tabLock';

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

export class FakeLockManager implements LockManagerLike {
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
export function heldUntil(signal: AbortSignal): () => Promise<void> {
  return () =>
    new Promise<void>((resolve) => {
      if (signal.aborted) return resolve();
      signal.addEventListener('abort', () => resolve(), { once: true });
    });
}

export const tick = () => new Promise((r) => setTimeout(r, 0));

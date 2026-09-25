import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readDurability, requestDurability, watchDurability } from './durability';
import { usePersistStore } from './persistStore';

/** Simula `navigator.storage` (jsdom no lo trae) y, opcionalmente, la consulta de permisos. */
function stubStorage(opts: {
  persisted: boolean;
  grant?: boolean;
  permission?: PermissionState;
}) {
  const persist = vi.fn(async () => opts.grant ?? false);
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: { persisted: vi.fn(async () => opts.persisted), persist },
  });
  if (opts.permission) {
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: vi.fn(async () => ({ state: opts.permission })) },
    });
  }
  return persist;
}

/** Deja que se resuelvan las promesas encadenadas. */
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  usePersistStore.setState({ status: 'idle', durability: 'unknown' });
});

afterEach(() => {
  // @ts-expect-error — limpiar el stub propio (no existe en jsdom)
  delete navigator.storage;
  // @ts-expect-error — ídem
  delete navigator.permissions;
});

describe('readDurability', () => {
  it('sin StorageManager → unsupported', async () => {
    expect(await readDurability()).toBe('unsupported');
  });

  it('lee el estado SIN pedir nada', async () => {
    const persist = stubStorage({ persisted: false, grant: true });
    expect(await readDurability()).toBe('best-effort');
    expect(persist).not.toHaveBeenCalled();
  });
});

describe('requestDurability', () => {
  it('ya persistente → no vuelve a pedirlo', async () => {
    const persist = stubStorage({ persisted: true });
    expect(await requestDurability()).toBe('persisted');
    expect(persist).not.toHaveBeenCalled();
  });

  it('el navegador lo concede → persisted', async () => {
    stubStorage({ persisted: false, grant: true });
    expect(await requestDurability()).toBe('persisted');
  });

  it('el navegador lo niega → best-effort', async () => {
    stubStorage({ persisted: false, grant: false });
    expect(await requestDurability()).toBe('best-effort');
  });

  it('el usuario ya dijo que no (Firefox) → no vuelve a preguntar', async () => {
    const persist = stubStorage({ persisted: false, grant: true, permission: 'denied' });
    expect(await requestDurability()).toBe('best-effort');
    expect(persist).not.toHaveBeenCalled();
  });

  it('persist() que lanza → best-effort, sin romper', async () => {
    stubStorage({ persisted: false });
    navigator.storage.persist = vi.fn(async () => {
      throw new Error('boom');
    });
    expect(await requestDurability()).toBe('best-effort');
  });
});

describe('watchDurability', () => {
  it('al arrancar solo LEE; pide con el primer guardado, una vez', async () => {
    const persist = stubStorage({ persisted: false, grant: true });
    const stop = watchDurability();
    await settle();
    expect(usePersistStore.getState().durability).toBe('best-effort');
    expect(persist).not.toHaveBeenCalled();

    usePersistStore.getState().setStatus('saving');
    usePersistStore.getState().setStatus('saved');
    await settle();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(usePersistStore.getState().durability).toBe('persisted');

    usePersistStore.getState().setStatus('saving');
    usePersistStore.getState().setStatus('saved');
    await settle();
    expect(persist).toHaveBeenCalledTimes(1);
    stop();
  });

  it('un guardado fallido no cuenta como primer guardado', async () => {
    const persist = stubStorage({ persisted: false, grant: true });
    const stop = watchDurability();
    usePersistStore.getState().setStatus('error');
    await settle();
    expect(persist).not.toHaveBeenCalled();
    stop();
  });
});

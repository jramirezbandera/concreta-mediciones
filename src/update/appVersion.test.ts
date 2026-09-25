import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHECK_EVERY_MS,
  FLUSH_TIMEOUT_MS,
  fetchLatestBuild,
  reloadToLatest,
  startUpdateWatcher,
} from './appVersion';
import { SNOOZE_MS, selectUpdateVisible, useUpdateStore } from './updateStore';

const reset = () => useUpdateStore.setState({ latest: null, broken: false, snoozed: null });
const visible = () => selectUpdateVisible(useUpdateStore.getState());
const jsonRes = (body: unknown, ok = true) =>
  ({ ok, json: () => Promise.resolve(body) }) as Response;

describe('fetchLatestBuild', () => {
  it('lee el build de version.json sin caché', async () => {
    const f = vi.fn().mockResolvedValue(jsonRes({ build: 'abc123' }));
    await expect(fetchLatestBuild(f)).resolves.toBe('abc123');
    const [url, init] = f.mock.calls[0]!;
    expect(url).toMatch(/^\/version\.json\?t=\d+$/);
    expect(init).toEqual({ cache: 'no-store' });
  });

  it('«no lo sé» es null: HTTP de error, red caída o JSON sin build', async () => {
    await expect(
      fetchLatestBuild(vi.fn().mockResolvedValue(jsonRes({}, false))),
    ).resolves.toBeNull();
    await expect(
      fetchLatestBuild(vi.fn().mockRejectedValue(new TypeError('offline'))),
    ).resolves.toBeNull();
    await expect(fetchLatestBuild(vi.fn().mockResolvedValue(jsonRes(null)))).resolves.toBeNull();
    await expect(
      fetchLatestBuild(vi.fn().mockResolvedValue(jsonRes({ build: 7 }))),
    ).resolves.toBeNull();
    await expect(
      fetchLatestBuild(vi.fn().mockResolvedValue(jsonRes({ build: '' }))),
    ).resolves.toBeNull();
  });
});

describe('startUpdateWatcher', () => {
  let stop: (() => void) | undefined;
  beforeEach(() => {
    reset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    stop?.();
    stop = undefined;
    vi.useRealTimers();
  });

  it('avisa al arrancar si el build publicado es otro', async () => {
    stop = startUpdateWatcher({ current: 'old', fetchLatest: () => Promise.resolve('new') });
    await vi.waitFor(() => expect(useUpdateStore.getState().latest).toBe('new'));
    expect(visible()).toBe(true);
  });

  it('mismo build, o sin datos: no avisa', async () => {
    const same = vi.fn().mockResolvedValue('old');
    stop = startUpdateWatcher({ current: 'old', fetchLatest: same });
    await vi.waitFor(() => expect(same).toHaveBeenCalled());
    stop();
    stop = startUpdateWatcher({ current: 'old', fetchLatest: () => Promise.resolve(null) });
    await vi.advanceTimersByTimeAsync(0);
    expect(useUpdateStore.getState().latest).toBeNull();
  });

  it('comprueba periódicamente y detecta un deploy posterior', async () => {
    let published = 'old';
    const fetchLatest = vi.fn(() => Promise.resolve(published));
    stop = startUpdateWatcher({ current: 'old', fetchLatest });
    await vi.advanceTimersByTimeAsync(0);
    expect(visible()).toBe(false);
    published = 'new';
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    expect(fetchLatest).toHaveBeenCalledTimes(2);
    expect(useUpdateStore.getState().latest).toBe('new');
  });

  it('volver a la pestaña comprueba, pero no más de una vez por minuto', async () => {
    const fetchLatest = vi.fn().mockResolvedValue('old');
    stop = startUpdateWatcher({ current: 'old', fetchLatest });
    await vi.advanceTimersByTimeAsync(0);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fetchLatest).toHaveBeenCalledTimes(1); // recién comprobado
    await vi.advanceTimersByTimeAsync(61_000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fetchLatest).toHaveBeenCalledTimes(2);
  });

  it('un chunk que no carga fuerza la comprobación y reabre el aviso pospuesto', async () => {
    const fetchLatest = vi.fn().mockResolvedValue('new');
    stop = startUpdateWatcher({ current: 'old', fetchLatest });
    await vi.advanceTimersByTimeAsync(0);
    useUpdateStore.getState().dismiss();
    expect(visible()).toBe(false);
    const ev = new Event('vite:preloadError', { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false); // el import sigue fallando (su toast actúa)
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchLatest).toHaveBeenCalledTimes(2);
    expect(useUpdateStore.getState().broken).toBe(true);
    expect(visible()).toBe(true);
  });

  it('parar retira el intervalo y los listeners', async () => {
    const fetchLatest = vi.fn().mockResolvedValue('old');
    startUpdateWatcher({ current: 'old', fetchLatest })();
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS * 3);
    window.dispatchEvent(new Event('vite:preloadError'));
    expect(fetchLatest).toHaveBeenCalledTimes(1);
  });
});

describe('updateStore · «Más tarde»', () => {
  beforeEach(() => {
    reset();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('calla ese build una hora; uno más nuevo lo reabre en el acto', () => {
    const { found, dismiss } = useUpdateStore.getState();
    found('b1');
    dismiss();
    found('b1');
    expect(visible()).toBe(false);
    vi.advanceTimersByTime(SNOOZE_MS);
    found('b1');
    expect(visible()).toBe(true);
    dismiss();
    found('b2');
    expect(visible()).toBe(true);
  });
});

describe('reloadToLatest', () => {
  it('guarda lo pendiente, refresca el HTML cacheado y recarga', async () => {
    const order: string[] = [];
    const beforeReload = vi.fn(async () => (order.push('flush'), true));
    const fetchImpl = vi.fn(async () => (order.push('fetch'), jsonRes('')));
    const reload = vi.fn(() => void order.push('reload'));
    await expect(reloadToLatest({ beforeReload, fetchImpl, reload })).resolves.toBe('ok');
    expect(order).toEqual(['flush', 'fetch', 'reload']);
    expect(fetchImpl).toHaveBeenCalledWith(window.location.pathname + window.location.search, {
      cache: 'reload',
    });
  });

  it('sin red no recarga (evita la página de error del navegador)', async () => {
    const reload = vi.fn();
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('offline'));
    await expect(reloadToLatest({ fetchImpl, reload })).resolves.toBe('sin-red');
    await expect(
      reloadToLatest({ fetchImpl: vi.fn().mockResolvedValue(jsonRes('', false)), reload }),
    ).resolves.toBe('sin-red');
    expect(reload).not.toHaveBeenCalled();
  });

  it('un guardado fallido NO recarga (se perderían los cambios) y lo dice', async () => {
    const reload = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(''));
    await expect(
      reloadToLatest({ beforeReload: async () => false, fetchImpl, reload }),
    ).resolves.toBe('sin-guardar');
    await expect(
      reloadToLatest({ beforeReload: () => Promise.reject(new Error('idb')), fetchImpl, reload }),
    ).resolves.toBe('sin-guardar');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('un guardado lento NO recarga al vencer el tope; uno que acaba a tiempo sí', async () => {
    vi.useFakeTimers();
    try {
      const reload = vi.fn();
      const fetchImpl = vi.fn().mockResolvedValue(jsonRes(''));
      const hung = reloadToLatest({ beforeReload: () => new Promise(() => {}), fetchImpl, reload });
      await vi.advanceTimersByTimeAsync(FLUSH_TIMEOUT_MS);
      await expect(hung).resolves.toBe('guardado-lento');
      expect(reload).not.toHaveBeenCalled();

      const slowOk = reloadToLatest({
        beforeReload: () => new Promise((r) => setTimeout(() => r(true), FLUSH_TIMEOUT_MS - 1000)),
        fetchImpl,
        reload,
      });
      await vi.advanceTimersByTimeAsync(FLUSH_TIMEOUT_MS);
      await expect(slowOk).resolves.toBe('ok');
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

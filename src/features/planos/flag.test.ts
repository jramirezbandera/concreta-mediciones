/* Interruptor del visor de planos (§5.9): terminada la A1, encendido por
   defecto también en producción; `?planos=0` lo apaga y se recuerda. */
import { afterEach, describe, expect, it, vi } from 'vitest';

async function cargar(url: string): Promise<boolean> {
  window.history.replaceState({}, '', url);
  vi.resetModules();
  const { planosActivos } = await import('./flag');
  return planosActivos();
}

afterEach(() => {
  localStorage.removeItem('concreta.planos');
  window.history.replaceState({}, '', '/');
});

describe('interruptor de planos', () => {
  it('sin nada, encendido', async () => {
    expect(await cargar('/')).toBe(true);
  });

  it('`?planos=0` lo apaga y se recuerda; `?planos=1` lo vuelve a encender', async () => {
    expect(await cargar('/?planos=0')).toBe(false);
    expect(await cargar('/')).toBe(false);
    expect(await cargar('/?planos=1')).toBe(true);
    expect(await cargar('/')).toBe(true);
  });
});

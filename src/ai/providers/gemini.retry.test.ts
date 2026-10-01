import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiError } from '../types';
import type { ChatRequest } from '../types';

/* SDK falso: `generateContent` sigue el guion de `script` (status = ApiError, string = respuesta). */
const script: (number | string)[] = [];
const generateContent = vi.fn(async () => {
  const next = script.shift();
  if (typeof next === 'number') throw new FakeApiError(next);
  return { text: next };
});
class FakeApiError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}
vi.mock('@google/genai', () => ({
  ApiError: FakeApiError,
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

const { chatRaw, isTransient, RETRY_DELAYS_MS } = await import('./gemini');

const req = (signal?: AbortSignal): ChatRequest => ({
  system: { stable: 's', volatile: 'v' },
  schema: {},
  turns: [{ role: 'user', text: 'hola' }],
  signal,
});
const OK = '{"reply":"ok","ops":null}';

describe('chatRaw — reintentos ante fallos pasajeros', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    script.length = 0;
    generateContent.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('isTransient: solo 5xx', () => {
    expect(isTransient({ status: 503 })).toBe(true);
    expect(isTransient({ status: 500 })).toBe(true);
    expect(isTransient({ status: 429 })).toBe(false);
    expect(isTransient({ status: 400 })).toBe(false);
    expect(isTransient(new TypeError('fetch'))).toBe(false);
  });

  it('503 y luego bien → reintenta y devuelve la respuesta', async () => {
    script.push(503, OK);
    const p = chatRaw(req(), 'k', 'm');
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]!);
    await expect(p).resolves.toEqual({ reply: 'ok', ops: null });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('503 persistente → se rinde tras los reintentos con AiError network', async () => {
    script.push(503, 503, 503, OK);
    const p = chatRaw(req(), 'k', 'm');
    const settled = expect(p).rejects.toMatchObject({ kind: 'network' });
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS.reduce((a, b) => a + b, 0));
    await settled;
    expect(generateContent).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1);
  });

  it('429 (cupo) NO se reintenta', async () => {
    script.push(429, OK);
    await expect(chatRaw(req(), 'k', 'm')).rejects.toMatchObject({ kind: 'rate-limit' });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('cancelar durante la espera → aborted, sin más llamadas', async () => {
    script.push(503, OK);
    const ctrl = new AbortController();
    const p = chatRaw(req(ctrl.signal), 'k', 'm');
    const settled = expect(p).rejects.toBeInstanceOf(AiError);
    await vi.advanceTimersByTimeAsync(100);
    ctrl.abort();
    await settled;
    await expect(p).rejects.toMatchObject({ kind: 'aborted' });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});

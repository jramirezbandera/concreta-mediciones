import { describe, expect, it } from 'vitest';
import { AiError } from '../types';
import { numericStatus, parseJsonText, scrub, toAiError } from './gemini';

/** Doble de `ApiError` del SDK: `toAiError` solo lo usa para `instanceof` + `.status`. */
class FakeApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
const ApiErrorClass = FakeApiError as unknown as (typeof import('@google/genai'))['ApiError'];

describe('scrub', () => {
  it('redacta todas las apariciones de la apiKey', () => {
    expect(scrub('falló con sk-abc y de nuevo sk-abc', 'sk-abc')).toBe(
      'falló con [redactada] y de nuevo [redactada]',
    );
  });
  it('sin apiKey deja el mensaje intacto', () => {
    expect(scrub('mensaje', '')).toBe('mensaje');
  });
});

describe('numericStatus', () => {
  it('lee status', () => expect(numericStatus({ status: 429 })).toBe(429));
  it('cae a code', () => expect(numericStatus({ code: 503 })).toBe(503));
  it('sin ninguno → undefined', () => {
    expect(numericStatus({})).toBeUndefined();
    expect(numericStatus(null)).toBeUndefined();
    expect(numericStatus('x')).toBeUndefined();
  });
});

describe('parseJsonText', () => {
  it('parsea JSON válido', () => {
    expect(parseJsonText('{"reply":"hola","ops":null}')).toEqual({ reply: 'hola', ops: null });
  });
  it('vacío → bad-response', () => {
    expect(() => parseJsonText('')).toThrow(AiError);
    expect(() => parseJsonText('   ')).toThrow(/vacía/);
  });
  it('undefined → bad-response', () => {
    expect(() => parseJsonText(undefined)).toThrow(AiError);
  });
  it('no-JSON → bad-response', () => {
    try {
      parseJsonText('no soy json');
      throw new Error('no lanzó');
    } catch (e) {
      expect(e).toBeInstanceOf(AiError);
      expect((e as AiError).kind).toBe('bad-response');
    }
  });
});

describe('toAiError (normalización + scrubbing)', () => {
  const key = 'sk-secret-123';

  it('un AiError se devuelve tal cual', () => {
    const orig = new AiError('rate-limit', 'x');
    expect(toAiError(orig, key, undefined, ApiErrorClass)).toBe(orig);
  });

  it('signal abortada → aborted', () => {
    const ctrl = new AbortController();
    ctrl.abort();
    expect(toAiError(new Error('boom'), key, ctrl.signal, ApiErrorClass).kind).toBe('aborted');
  });

  it('AbortError por nombre → aborted', () => {
    const err = new Error('cancelado');
    err.name = 'AbortError';
    expect(toAiError(err, key, undefined, ApiErrorClass).kind).toBe('aborted');
  });

  it('ApiError 401 → invalid-key y redacta la key del mensaje', () => {
    const r = toAiError(new FakeApiError(401, `bad key ${key}`), key, undefined, ApiErrorClass);
    expect(r.kind).toBe('invalid-key');
    expect(r.message).not.toContain(key);
    expect(r.message).toContain('[redactada]');
  });

  it('ApiError 429 → rate-limit', () => {
    expect(toAiError(new FakeApiError(429, 'slow down'), key, undefined, ApiErrorClass).kind).toBe(
      'rate-limit',
    );
  });

  it('ApiError 500 → network', () => {
    expect(toAiError(new FakeApiError(500, 'oops'), key, undefined, ApiErrorClass).kind).toBe(
      'network',
    );
  });

  it('objeto plano con status 429 (no-ApiError) → rate-limit por numericStatus', () => {
    const r = toAiError({ status: 429, message: 'x' }, key, undefined, ApiErrorClass);
    expect(r.kind).toBe('rate-limit');
  });

  it('TypeError (fetch offline/CORS) → network', () => {
    expect(toAiError(new TypeError('Failed to fetch'), key, undefined, ApiErrorClass).kind).toBe(
      'network',
    );
  });

  it('error desconocido → unknown y redacta la key', () => {
    const r = toAiError(new Error(`raro con ${key}`), key, undefined, ApiErrorClass);
    expect(r.kind).toBe('unknown');
    expect(r.message).not.toContain(key);
  });
});

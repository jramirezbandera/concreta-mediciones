import { describe, expect, it } from 'vitest';
import { AiError } from '../types';
import { buildOpenAiInput, parseJsonFromOutputText } from './openai';

describe('buildOpenAiInput (turnos → input de la Responses API)', () => {
  it('turno assistant → content string (envelope verbatim)', () => {
    expect(buildOpenAiInput([{ role: 'assistant', text: '{"reply":"x","ops":null}' }])).toEqual([
      { role: 'assistant', content: '{"reply":"x","ops":null}' },
    ]);
  });

  it('turno user de solo texto → input_text', () => {
    expect(buildOpenAiInput([{ role: 'user', text: 'hola' }])).toEqual([
      { role: 'user', content: [{ type: 'input_text', text: 'hola' }] },
    ]);
  });

  it('turno user con imagen y texto → input_image (data URL) + input_text', () => {
    const img = { data: 'QUJD', mediaType: 'image/png' as const };
    expect(buildOpenAiInput([{ role: 'user', text: 'lee esto', images: [img] }])).toEqual([
      {
        role: 'user',
        content: [
          { type: 'input_image', detail: 'auto', image_url: 'data:image/png;base64,QUJD' },
          { type: 'input_text', text: 'lee esto' },
        ],
      },
    ]);
  });

  it('turno user SOLO imagen (texto vacío) → NO añade input_text vacío', () => {
    const img = { data: 'QUJD', mediaType: 'image/jpeg' as const };
    expect(buildOpenAiInput([{ role: 'user', text: '', images: [img] }])).toEqual([
      {
        role: 'user',
        content: [{ type: 'input_image', detail: 'auto', image_url: 'data:image/jpeg;base64,QUJD' }],
      },
    ]);
  });
});

describe('parseJsonFromOutputText', () => {
  it('JSON válido → objeto', () => {
    expect(parseJsonFromOutputText('{"reply":"h","ops":null}')).toEqual({ reply: 'h', ops: null });
  });
  it('vacío → bad-response', () => {
    expect(() => parseJsonFromOutputText('')).toThrow(AiError);
  });
  it('no-JSON → bad-response', () => {
    try {
      parseJsonFromOutputText('nope');
      throw new Error('no lanzó');
    } catch (e) {
      expect(e).toBeInstanceOf(AiError);
      expect((e as AiError).kind).toBe('bad-response');
    }
  });
});

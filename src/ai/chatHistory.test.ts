import { describe, expect, it } from 'vitest';
import {
  buildChatTurns,
  IMAGE_OMITTED_MARKER,
  IMAGES_CARRIED_MARKER,
  MAX_REQUEST_IMAGES,
  type ChatItemLike,
} from './chatHistory';
import type { AiImageAttachment } from './types';

const u = (text: string, images?: AiImageAttachment[]): ChatItemLike => ({
  kind: 'user',
  text,
  ...(images ? { images } : {}),
});
const a = (rawEnvelope: string): ChatItemLike => ({ kind: 'assistant', rawEnvelope });
const img = (id: string): AiImageAttachment => ({ data: id, mediaType: 'image/png' });

describe('buildChatTurns', () => {
  it('mapea user→user y assistant→(rawEnvelope verbatim)', () => {
    const turns = buildChatTurns([u('hola'), a('{"reply":"hey","ops":null}')]);
    expect(turns).toEqual([
      { role: 'user', text: 'hola' },
      { role: 'assistant', text: '{"reply":"hey","ops":null}' },
    ]);
  });

  it('excluye los ítems de error sin romper la alternancia', () => {
    const turns = buildChatTurns([u('a'), { kind: 'error', text: 'fallo' }, u('b')]);
    expect(turns.map((t) => t.role)).toEqual(['user', 'user']);
    expect(turns.map((t) => t.text)).toEqual(['a', 'b']);
  });

  it('poda por pares: el primer turno restante sigue siendo user', () => {
    // 8 turnos (4 pares), maxTurns=4 → deja los 4 últimos, empezando en user.
    const items: ChatItemLike[] = [];
    for (let i = 0; i < 4; i++) {
      items.push(u(`u${i}`), a(`a${i}`));
    }
    const turns = buildChatTurns(items, 4);
    expect(turns).toHaveLength(4);
    expect(turns[0]!.role).toBe('user');
    expect(turns[0]!.text).toBe('u2');
    expect(turns[3]!.role).toBe('assistant');
  });

  it('re-adjunta las imágenes de los turnos podados al primer user superviviente', () => {
    // maxTurns=2 → se poda el primer par (u0 con imagen + a0); la imagen migra a u1.
    const turns = buildChatTurns([u('u0', [img('foto0')]), a('a0'), u('u1'), a('a1')], 2);
    expect(turns).toHaveLength(2);
    expect(turns[0]!.role).toBe('user');
    expect(turns[0]!.images?.map((i) => i.data)).toEqual(['foto0']);
    expect(turns[0]!.text).toContain(IMAGES_CARRIED_MARKER);
  });

  it('aplica el cupo de imágenes podando de las más antiguas y marca el turno', () => {
    const many = Array.from({ length: MAX_REQUEST_IMAGES + 2 }, (_, i) => img(`f${i}`));
    const turns = buildChatTurns([u('con muchas', many)]);
    const total = turns.reduce((n, t) => n + (t.images?.length ?? 0), 0);
    expect(total).toBe(MAX_REQUEST_IMAGES);
    // Las 2 más antiguas (f0, f1) se podan; quedan f2..f7.
    expect(turns[0]!.images?.map((i) => i.data)).toEqual(['f2', 'f3', 'f4', 'f5', 'f6', 'f7']);
    expect(turns[0]!.text).toContain(IMAGE_OMITTED_MARKER);
  });

  it('sin exceso, devuelve los turnos intactos', () => {
    const turns = buildChatTurns([u('x'), a('y')], 12);
    expect(turns).toEqual([
      { role: 'user', text: 'x' },
      { role: 'assistant', text: 'y' },
    ]);
  });
});

import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { huellaDe, sha256Hex } from './sha256';

const txt = (s: string) => new TextEncoder().encode(s);

describe('sha256Hex', () => {
  it('vectores conocidos (FIPS 180-2)', () => {
    expect(sha256Hex(txt(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex(txt('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex(txt('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('0 bytes, bordes de bloque y 1 MB coinciden con node:crypto', () => {
    for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 120, 128, 1000]) {
      const b = new Uint8Array(n).map((_, i) => (i * 31 + 7) & 0xff);
      expect(sha256Hex(b), `n=${n}`).toBe(createHash('sha256').update(b).digest('hex'));
    }
    const mb = new Uint8Array(1 << 20).map((_, i) => (i * 131) & 0xff);
    expect(sha256Hex(mb.buffer)).toBe(createHash('sha256').update(mb).digest('hex'));
  });
});

describe('huellaDe', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('con crypto.subtle y sin él da lo mismo', async () => {
    const b = txt('Planta primera').buffer as ArrayBuffer;
    const esperada = createHash('sha256').update(new Uint8Array(b)).digest('hex');
    expect(await huellaDe(b)).toBe(esperada);
    vi.stubGlobal('crypto', { randomUUID: () => 'x' }); // fuera de contexto seguro: sin subtle
    expect(await huellaDe(b)).toBe(esperada);
  });
});

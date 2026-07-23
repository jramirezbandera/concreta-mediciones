import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCEPTED_MEDIA_TYPES,
  fileToBase64,
  MAX_IMAGES,
  prepareImage,
} from './imagePrep';

/* jsdom no decodifica imágenes ni implementa canvas 2d ni URL.createObjectURL:
   stubeamos lo mínimo para ejercitar las dos ramas de prepareImage (directa por
   fileToBase64, y reescalado en canvas). La rama de canvas se cubre con un
   contexto y un toDataURL falsos; el resto (FileReader) sí funciona en jsdom. */

/** Dimensiones que reporta el próximo `new Image()` (controla la rama de reescalado). */
let nextDims = { w: 100, h: 100 };

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = nextDims.w;
  naturalHeight = nextDims.h;
  set src(_v: string) {
    this.naturalWidth = nextDims.w;
    this.naturalHeight = nextDims.h;
    queueMicrotask(() => this.onload?.());
  }
}

const origGetContext = HTMLCanvasElement.prototype.getContext;
const origToDataURL = HTMLCanvasElement.prototype.toDataURL;

beforeEach(() => {
  nextDims = { w: 100, h: 100 };
  vi.stubGlobal('Image', MockImage);
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
  // Contexto y export de canvas falsos (jsdom devuelve null en getContext('2d')).
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never;
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,QUJDRA==');
});

afterEach(() => {
  vi.unstubAllGlobals();
  HTMLCanvasElement.prototype.getContext = origGetContext;
  HTMLCanvasElement.prototype.toDataURL = origToDataURL;
});

function pngFile(bytes = 8): File {
  return new File([new Uint8Array(bytes)], 'medicion.png', { type: 'image/png' });
}

describe('imagePrep', () => {
  it('rechaza formatos no soportados con un mensaje legible', async () => {
    const pdf = new File([new Uint8Array(4)], 'hoja.pdf', { type: 'application/pdf' });
    await expect(prepareImage(pdf)).rejects.toThrow(/no soportado/i);
  });

  it('acepta solo PNG/JPEG/WebP', () => {
    expect([...ACCEPTED_MEDIA_TYPES]).toEqual(['image/png', 'image/jpeg', 'image/webp']);
  });

  it('imagen pequeña: base64 SIN prefijo data: y conserva el mediaType', async () => {
    const att = await prepareImage(pngFile());
    expect(att.mediaType).toBe('image/png');
    expect(att.data).not.toMatch(/^data:/);
    expect(att.data.length).toBeGreaterThan(0);
  });

  it('imagen con lado > 2048 px: reescala en canvas y sale como JPEG', async () => {
    nextDims = { w: 3000, h: 2000 };
    const att = await prepareImage(pngFile());
    expect(att.mediaType).toBe('image/jpeg');
    // toDataURL falso → base64 "QUJDRA==" sin el prefijo data:.
    expect(att.data).toBe('QUJDRA==');
  });

  it('fileToBase64 quita el prefijo data:<tipo>;base64,', async () => {
    const b64 = await fileToBase64(pngFile());
    expect(b64).not.toContain(',');
    expect(b64).not.toMatch(/^data:/);
  });

  it('el cupo por mensaje es 3', () => {
    expect(MAX_IMAGES).toBe(3);
  });
});

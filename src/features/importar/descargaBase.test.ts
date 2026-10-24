import { describe, expect, it, vi } from 'vitest';
import type { BaseOficial } from '../../core/basesOficiales';
import { EscritorZip } from '../../persist/zip';
import { bc3DeFichero, descargarBase, ErrorDescarga, type ProgresoDescarga } from './descargaBase';

/** Base de prueba: la URL nunca se pide de verdad (fetch simulado). */
function base(formato: 'bc3' | 'zip', bytes: number): BaseOficial {
  return {
    id: 'prueba',
    nombre: 'Base de prueba',
    nombreCorto: 'Prueba',
    organismo: 'Organismo',
    edicion: '2026',
    actualizada: '2026-01-01',
    pagina: 'https://example.org/base',
    descarga: { url: `https://example.org/files/Base%20prueba.${formato}`, formato, bytes, ocupa: bytes * 2 },
    condiciones: '—',
    comprobada: '2026-10-24',
  };
}

/** Respuesta cuyo cuerpo llega en `trozos`, como un stream de red. Sin
 *  Content-Length a propósito: así sirve Extremadura con gzip. */
function respuesta(trozos: Uint8Array[], init: ResponseInit = {}): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const t of trozos) c.enqueue(t);
      c.close();
    },
  });
  return new Response(stream, { status: 200, ...init });
}

const fetchQue = (r: Response | Error) =>
  vi.fn<typeof fetch>(() => (r instanceof Error ? Promise.reject(r) : Promise.resolve(r)));

/** «Acentuación» en Windows-1252: á = 0xE1, ó = 0xF3. */
const ACENTOS = new Uint8Array([0x41, 0x63, 0x65, 0x6e, 0x74, 0x75, 0x61, 0x63, 0x69, 0xf3, 0x6e, 0x20, 0xe1]);

/** Bytes de un Blob con FileReader: el Blob de jsdom no tiene `arrayBuffer()`. */
function bytesDe(b: Blob): Promise<Uint8Array> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(new Uint8Array(fr.result as ArrayBuffer));
    fr.onerror = () => rej(fr.error);
    fr.readAsArrayBuffer(b);
  });
}

async function zipCon(entradas: [string, Uint8Array][]): Promise<Uint8Array> {
  const z = new EscritorZip();
  for (const [n, d] of entradas) await z.anadir(n, d, true);
  return bytesDe(z.cerrar());
}

describe('descargarBase', () => {
  it('lee el cuerpo como bytes (acentos en Windows-1252 intactos) y lo nombra por la URL', async () => {
    const f = await descargarBase(base('bc3', ACENTOS.length), {
      signal: new AbortController().signal,
      fetchFn: fetchQue(respuesta([ACENTOS])),
    });
    expect(f.name).toBe('Base prueba.bc3');
    expect(await bytesDe(f)).toEqual(ACENTOS);
  });

  it('el progreso va sobre los bytes del catálogo, sin Content-Length, y no pasa de 99 % hasta acabar (D5)', async () => {
    const vistos: ProgresoDescarga[] = [];
    // El fichero real es más grande de lo que dice el catálogo (la Junta lo cambió).
    const trozos = [new Uint8Array(40), new Uint8Array(40), new Uint8Array(40)];
    await descargarBase(base('bc3', 100), {
      signal: new AbortController().signal,
      fetchFn: fetchQue(respuesta(trozos, { headers: { 'Content-Encoding': 'gzip' } })),
      onProgreso: (p) => vistos.push(p),
    });
    expect(vistos.map((p) => p.fraccion)).toEqual([0.4, 0.8, 0.99, 1]);
    expect(vistos.at(-1)?.leidos).toBe(120);
  });

  it('con una URL que acaba en un identificador (Extremadura), el nombre es el del .bc3', async () => {
    const b = base('bc3', ACENTOS.length);
    b.descarga!.url = 'https://example.org/documents/1/2/BCEXTGREM_26_v1.bc3/8066c810-a694-eeed';
    const f = await descargarBase(b, {
      signal: new AbortController().signal,
      fetchFn: fetchQue(respuesta([ACENTOS])),
    });
    expect(f.name).toBe('BCEXTGREM_26_v1.bc3');
  });

  it('pide sin credenciales y con la señal de cancelación', async () => {
    const fetchFn = fetchQue(respuesta([ACENTOS]));
    const ctl = new AbortController();
    await descargarBase(base('bc3', 13), { signal: ctl.signal, fetchFn });
    expect(fetchFn).toHaveBeenCalledWith('https://example.org/files/Base%20prueba.bc3', {
      signal: ctl.signal,
      credentials: 'omit',
    });
  });

  it('un 404 es error «http»; un TypeError (sin red o CORS) es «red»', async () => {
    const signal = new AbortController().signal;
    await expect(
      descargarBase(base('bc3', 1), { signal, fetchFn: fetchQue(new Response(null, { status: 404 })) }),
    ).rejects.toMatchObject({ motivo: 'http', message: 'La web oficial respondió 404.' });
    await expect(
      descargarBase(base('bc3', 1), { signal, fetchFn: fetchQue(new TypeError('Failed to fetch')) }),
    ).rejects.toMatchObject({ motivo: 'red' });
  });

  it('cancelar aborta: el fetch rechaza con AbortError y sale «abortada»', async () => {
    const ctl = new AbortController();
    const fetchFn = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_res, rej) =>
          init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))),
        ),
    );
    const p = descargarBase(base('bc3', 1), { signal: ctl.signal, fetchFn });
    ctl.abort();
    await expect(p).rejects.toMatchObject({ motivo: 'abortada' });
  });

  it('cancelar a mitad del cuerpo también sale «abortada»', async () => {
    const ctl = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        c.enqueue(new Uint8Array(10));
        ctl.abort();
        c.error(new DOMException('aborted', 'AbortError'));
      },
    });
    await expect(
      descargarBase(base('bc3', 100), { signal: ctl.signal, fetchFn: fetchQue(new Response(stream)) }),
    ).rejects.toMatchObject({ motivo: 'abortada' });
  });

  it('una base sin descarga no llama a fetch', async () => {
    const fetchFn = fetchQue(respuesta([]));
    const { descarga: _d, ...sinDescarga } = base('bc3', 1);
    void _d;
    await expect(
      descargarBase(sinDescarga, { signal: new AbortController().signal, fetchFn }),
    ).rejects.toBeInstanceOf(ErrorDescarga);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('de un ZIP con un único .bc3 saca ese .bc3 (BCCA)', async () => {
    const zip = await zipCon([['BCCA2023_V02.bc3', ACENTOS]]);
    const f = await descargarBase(base('zip', zip.length), {
      signal: new AbortController().signal,
      fetchFn: fetchQue(respuesta([zip])),
    });
    expect(f.name).toBe('BCCA2023_V02.bc3');
    expect(await bytesDe(f)).toEqual(ACENTOS);
  });

  it('un ZIP sin .bc3, con dos o dañado es error «zip»', async () => {
    const signal = new AbortController().signal;
    const sin = await zipCon([['leame.txt', ACENTOS]]);
    const dos = await zipCon([
      ['a.bc3', ACENTOS],
      ['b.bc3', ACENTOS],
    ]);
    const roto = sin.slice(0, sin.length - 30);
    for (const z of [sin, dos, roto])
      await expect(
        descargarBase(base('zip', z.length), { signal, fetchFn: fetchQue(respuesta([z])) }),
      ).rejects.toMatchObject({ motivo: 'zip' });
  });
});

describe('bc3DeFichero (soltar a mano con la base asociada, D14)', () => {
  it('un .zip se abre y un .bc3 pasa tal cual', async () => {
    const zip = await zipCon([['dentro/BCCA.bc3', ACENTOS]]);
    const deZip = await bc3DeFichero(new File([zip as BlobPart], 'BCCA2023_V02.zip'));
    expect(deZip.name).toBe('BCCA.bc3');
    expect(await bytesDe(deZip)).toEqual(ACENTOS);

    const suelto = new File([ACENTOS as BlobPart], 'base.bc3');
    expect(await bc3DeFichero(suelto)).toBe(suelto);
  });
});

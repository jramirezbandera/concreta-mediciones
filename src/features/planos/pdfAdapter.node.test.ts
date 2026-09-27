/* Motor de PDF real (pdf.js) en node: contrato compartido con el doble, versión
   exacta, worker de la misma build y respuestas que llegan tarde. Corre con
   `vitest run -c vitest.node.config.ts` (src/test/setup.ts toca `Element`). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { pdfMinimo } from '../../test/pdfMinimo';
import { contratoPdfAdapter } from './pdfAdapter.contrato';
import { RUTA_WORKER, crearAdapterPdfjs } from './pdfAdapter';

const raiz = resolve(__dirname, '../../..');
const pdfjsDir = resolve(raiz, 'node_modules/pdfjs-dist');

async function cargarEnNode() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(resolve(pdfjsDir, 'legacy/build/pdf.worker.mjs')).href;
  return pdfjs;
}
const opcionesNode = () => ({
  cMapUrl: `${resolve(pdfjsDir, 'cmaps')}/`,
  cMapPacked: true,
  standardFontDataUrl: `${resolve(pdfjsDir, 'standard_fonts')}/`,
  wasmUrl: `${resolve(pdfjsDir, 'wasm')}/`,
  iccUrl: `${resolve(pdfjsDir, 'iccs')}/`,
});
const real = () => crearAdapterPdfjs(cargarEnNode, opcionesNode);

contratoPdfAdapter('pdf.js', real);

describe('pdf.js: versión y worker', () => {
  it('versión EXACTA en package.json, ≥ 4.2.67 (CVE-2024-4367), igual en librería y worker', async () => {
    const pkg = JSON.parse(readFileSync(resolve(raiz, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
    const declarada = pkg.dependencies['pdfjs-dist']!;
    expect(declarada).toMatch(/^\d+\.\d+\.\d+$/);
    const [ma, mi, pa] = declarada.split('.').map(Number) as [number, number, number];
    expect(ma * 1e6 + mi * 1e3 + pa).toBeGreaterThanOrEqual(4 * 1e6 + 2 * 1e3 + 67);
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    expect(pdfjs.version).toBe(declarada);
    const worker = readFileSync(resolve(pdfjsDir, 'legacy/build/pdf.worker.min.mjs'), 'utf8');
    expect(worker).toContain(`"${declarada}"`);
  });

  it('el worker es el de la build legacy', () => {
    expect(RUTA_WORKER).toBe('pdfjs-dist/legacy/build/pdf.worker.min.mjs');
    const src = readFileSync(resolve(raiz, 'src/features/planos/pdfAdapter.ts'), 'utf8');
    expect(src).toContain(`import('${RUTA_WORKER}?url')`);
    expect(src).toContain("import('pdfjs-dist/legacy/build/pdf.mjs')");
  });

  it('abrir A → B → llega A tarde: con la señal abortada, A se cierra y no se usa', async () => {
    const a = real();
    const ac = new AbortController();
    const pa = a.abrir(pdfMinimo([{ mediaBox: [0, 0, 10, 10] }]).buffer as ArrayBuffer, { signal: ac.signal });
    const pb = a.abrir(pdfMinimo([{ mediaBox: [0, 0, 20, 20] }]).buffer as ArrayBuffer, { signal: new AbortController().signal });
    ac.abort(); // se pidió B: A ya no interesa
    await expect(pa).rejects.toMatchObject({ tipo: 'cancelado' });
    const b = await pb;
    expect((await b.pagina(1)).vista).toEqual([0, 0, 20, 20]);
    b.cerrar();
  });
});

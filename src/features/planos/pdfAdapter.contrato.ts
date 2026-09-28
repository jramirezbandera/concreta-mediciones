/* ===========================================================================
   Tests de CONTRATO del motor de PDF (§8.1): el real (pdf.js, entorno node) y
   el doble (jsdom) pasan los mismos casos, así los tests de la interfaz con el
   doble dicen algo del real.
   =========================================================================== */
import { describe, expect, it } from 'vitest';
import { pdfMinimo, type PaginaMinima } from '../../test/pdfMinimo';
import { ErrorPdf, type DocPdf, type PdfAdapter } from './pdfTipos';

const abrir = (a: PdfAdapter, paginas: PaginaMinima[]): Promise<DocPdf> =>
  a.abrir(pdfMinimo(paginas).buffer as ArrayBuffer, { signal: new AbortController().signal });

export function contratoPdfAdapter(nombre: string, crear: () => PdfAdapter): void {
  describe(`contrato del motor de PDF · ${nombre}`, () => {
    it('páginas y caja con origen ≠ 0 (MediaBox)', async () => {
      const doc = await abrir(crear(), [{ mediaBox: [20, 30, 620, 430] }, { mediaBox: [0, 0, 100, 50] }]);
      expect(doc.paginas).toBe(2);
      expect(await doc.pagina(1)).toEqual({ vista: [20, 30, 620, 430], rotacion: 0, userUnit: 1 });
      expect((await doc.pagina(2)).vista).toEqual([0, 0, 100, 50]);
      doc.cerrar();
    });

    it('la caja visible es la CropBox', async () => {
      const doc = await abrir(crear(), [{ mediaBox: [0, 0, 600, 400], cropBox: [50, 60, 550, 360] }]);
      expect((await doc.pagina(1)).vista).toEqual([50, 60, 550, 360]);
      doc.cerrar();
    });

    it('las cuatro rotaciones, sin rotar la caja', async () => {
      const doc = await abrir(
        crear(),
        ([0, 90, 180, 270] as const).map((rotate) => ({ mediaBox: [0, 0, 842, 595] as [number, number, number, number], rotate })),
      );
      for (const [i, r] of [0, 90, 180, 270].entries()) {
        const p = await doc.pagina(i + 1);
        expect(p.rotacion).toBe(r);
        expect(p.vista).toEqual([0, 0, 842, 595]);
      }
      doc.cerrar();
    });

    it('rotación con /UserUnit', async () => {
      const doc = await abrir(crear(), [{ mediaBox: [0, 0, 420, 297], rotate: 90, userUnit: 2 }]);
      expect(await doc.pagina(1)).toEqual({ vista: [0, 0, 420, 297], rotacion: 90, userUnit: 2 });
      doc.cerrar();
    });

    it('textos en coordenadas de página, con su tamaño', async () => {
      const doc = await abrir(crear(), [
        { mediaBox: [0, 0, 600, 400], textos: [{ x: 400, y: 50, tamano: 10, texto: 'E 1:50' }] },
      ]);
      const ts = await doc.textos(1);
      const t = ts.find((x) => x.texto.includes('1:50'))!;
      expect(t).toBeTruthy();
      expect(t.caja[0]).toBeCloseTo(400, 0);
      expect(t.caja[1]).toBeCloseTo(50, -1);
      expect(t.tamano).toBeCloseTo(10, 0);
      expect(t.dir[0]).toBeCloseTo(1, 5);
      expect(t.dir[1]).toBeCloseTo(0, 5);
      doc.cerrar();
    });

    it('vacío y dañado dan su error; cerrar se puede llamar dos veces', async () => {
      const a = crear();
      await expect(a.abrir(new ArrayBuffer(0), { signal: new AbortController().signal })).rejects.toMatchObject({
        tipo: 'vacio',
      });
      const basura = new TextEncoder().encode('esto no es un pdf').buffer as ArrayBuffer;
      const err = await a.abrir(basura, { signal: new AbortController().signal }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ErrorPdf);
      expect((err as ErrorPdf).tipo).toBe('danado');
      const doc = await abrir(a, [{ mediaBox: [0, 0, 10, 10] }]);
      doc.cerrar();
      expect(() => doc.cerrar()).not.toThrow();
    });

    it('precargar nunca falla: con la señal abortada, página inexistente o tras cerrar', async () => {
      const doc = await abrir(crear(), [{ mediaBox: [0, 0, 100, 100] }, { mediaBox: [0, 0, 100, 100] }]);
      await expect(doc.precargar(2, new AbortController().signal)).resolves.toBeUndefined();
      const ac = new AbortController();
      ac.abort();
      await expect(doc.precargar(1, ac.signal)).resolves.toBeUndefined();
      await expect(doc.precargar(9, new AbortController().signal)).resolves.toBeUndefined();
      doc.cerrar();
      await expect(doc.precargar(1, new AbortController().signal)).resolves.toBeUndefined();
    });

    it('abrir con la señal ya abortada: `cancelado`', async () => {
      const ac = new AbortController();
      ac.abort();
      const err = await crear()
        .abrir(pdfMinimo([{ mediaBox: [0, 0, 10, 10] }]).buffer as ArrayBuffer, { signal: ac.signal })
        .catch((e: unknown) => e);
      expect((err as ErrorPdf).tipo).toBe('cancelado');
    });
  });
}

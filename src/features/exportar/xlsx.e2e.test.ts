/* E2E del exportador XLSX: genera el .xlsx REAL con la librería (sin mocks),
   descomprime el zip y comprueba el XML del worksheet — fórmulas dentro de
   `<f>`, el bloque de impresión inyectado por `printSetupFeature` en el orden
   del esquema OOXML, y que el documento es XML bien formado. Complementa a
   `xlsx.test.ts` (que mockea la librería) y a `xlsxBuilders.test.ts` (celdas). */
import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import writeXlsxFile from 'write-excel-file/browser';
import { buildCertListado, buildPresupuestoListado, obraMeta } from '../../core/listado';
import { buildCertXlsx, buildPresupuestoXlsx } from './xlsxBuilders';
import { printSetupFeature } from './xlsx';
import type { Cert, Chapter, Partida, PartidasMap, Rates } from '../../core/types';

const partida = (over: Partial<Partida>): Partida => ({
  id: 'p', pos: '1.1', code: 'X', title: '', ud: 'ud', precio: 0, desc: '', med: [], items: [], ...over,
});
const rates: Rates = { iva: 0.1, gg: 0.13, bi: 0.06, coefK: 1 };
const chapters: Chapter[] = [
  { id: '01', code: '1', title: 'Demoliciones', children: [{ id: '01.01', code: '1.1', title: 'Interiores' }] },
  { id: '03', code: '3', title: 'Albañilería' },
];
const partidas: PartidasMap = {
  '01': [
    partida({ id: 'pa', pos: '1.1', code: 'A', title: 'Huérfana', desc: 'Texto.', precio: 10, cantidad: 2 }),
    partida({ id: 'pb', sub: '01.01', pos: '1.1.1', code: 'B', title: 'Con medición', precio: 5,
      med: [{ id: 'm1', comment: 'zona A', uds: 2, largo: 3, ancho: '', alto: '' }] }),
  ],
  '03': [partida({ id: 'pc', pos: '3.1', code: 'C', title: 'Plana', precio: 7.77, cantidad: 3 })],
};
const meta = obraMeta({ denominacion: 'Reforma X', direccion: 'C/ Mayor 14', localidad: 'Málaga' });
const firma = { firmantes: [], lugar: '', fecha: '' };

async function sheetXmlOf(doc: ReturnType<typeof buildPresupuestoXlsx>): Promise<string> {
  const blob = await writeXlsxFile(
    doc.rows,
    { sheet: doc.sheet, columns: doc.columns },
    { features: [printSetupFeature(doc.orientation)] },
  ).toBlob();
  // jsdom no implementa Blob.arrayBuffer(): se lee con FileReader.
  const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as ArrayBuffer);
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(blob);
  });
  const files = unzipSync(new Uint8Array(buf));
  expect(Object.keys(files)).toContain('xl/worksheets/sheet1.xml');
  return strFromU8(files['xl/worksheets/sheet1.xml']!);
}

function expectWellFormed(xml: string): void {
  const parsed = new DOMParser().parseFromString(xml, 'text/xml');
  expect(parsed.getElementsByTagName('parsererror')).toHaveLength(0);
}

describe('E2E: xlsx real generado con fórmulas + impresión', () => {
  it('presupuesto: fórmulas en <f>, sheetPr al abrir y pageSetup al cierre', async () => {
    const doc = buildPresupuestoXlsx(buildPresupuestoListado(chapters, partidas), meta, firma);
    const xml = await sheetXmlOf(doc);
    expectWellFormed(xml);
    expect(xml).toMatch(/<worksheet[^>]*><sheetPr><pageSetUpPr fitToPage="1"\/><\/sheetPr>/);
    expect(xml).toContain('<f>ROUND(E7*F7,2)</f>');
    expect(xml).toContain('<f>ROUND(SUM(E11:E11),2)</f>');
    expect(xml).toContain('<f>SUBTOTAL(9,G7:G11)</f>');
    expect(xml).toContain('<f>G12+G17</f>');
    expect(xml).toContain('<printOptions horizontalCentered="1"/>');
    expect(xml).toContain('<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>');
    expect(xml).toContain('P&#225;gina &amp;P de &amp;N');
    // orden del esquema: printOptions < pageMargins < pageSetup < headerFooter, tras sheetData
    const order = ['</sheetData>', '<printOptions', '<pageMargins', '<pageSetup', '<headerFooter'];
    const idx = order.map((t) => xml.indexOf(t));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(idx.every((i) => i > 0)).toBe(true);
  });

  it('cert: apaisada y fórmulas del resumen económico', async () => {
    const certs: Cert[] = [{
      id: 'c1', num: 1, period: 'Mayo', retencion: 0.05, data: { pa: 2 },
      priceSnapshot: { pa: 10, pb: 5, pc: 7.77 }, coefK: 1, snapshotAt: '2026-06-11T08:00:00.000Z',
      extras: [{ id: 'x1', chapterId: '03', pos: 'C1', title: 'Extra', ud: 'ud', cantidad: 2, precio: 25 }],
    }];
    const doc = buildCertXlsx(buildCertListado(chapters, partidas, certs, 0, rates)!, meta, firma);
    const xml = await sheetXmlOf(doc);
    expectWellFormed(xml);
    expect(xml).toContain('orientation="landscape"');
    expect(xml).toContain('<f>ROUND(F9*H9,2)</f>');
    expect(xml).toContain('<f>-ROUND(K24*0.05,2)</f>');
  });
});

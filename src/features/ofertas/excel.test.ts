/* O3: la oferta que vuelve en el Excel de «Mediciones sin precios». */
import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import type { CellObject } from 'write-excel-file/browser';
import writeXlsxFile from 'write-excel-file/browser';
import { buildPresupuestoListado, obraMeta } from '../../core/listado';
import { filasDeExcel } from '../../core/ofertas';
import { leerPrimeraHoja } from '../../core/xlsxLeer';
import type { Partida } from '../../core/types';
import { blankObraData } from '../../store';
import { buildPresupuestoXlsx } from '../exportar/xlsxBuilders';
import { ofertaDesdeFilas } from './importarOferta';

const partida = (over: Partial<Partida>): Partida => ({
  id: 'p',
  pos: '1',
  code: 'X',
  title: '',
  ud: 'm²',
  precio: 10,
  desc: '',
  med: [],
  items: [],
  ...over,
});

const obra = (() => {
  const d = blankObraData('Reforma');
  d.chapters = [
    { id: 'a', code: '1', title: 'Albañilería', children: [{ id: 'a1', code: '1.1', title: 'Tabiques' }] },
    { id: 'b', code: '2', title: 'Pintura' },
  ];
  d.partidas = {
    a: [
      partida({ id: 'p1', pos: '1.1.1', sub: 'a1', code: 'ALB01', title: 'Tabique', desc: 'Ladrillo hueco doble.', cantidad: 100 }),
      partida({
        id: 'p2',
        pos: '1.1.2',
        sub: 'a1',
        code: 'ALB02',
        title: 'Enfoscado',
        med: [{ id: 'm', comment: 'Baño', uds: 2, largo: 3, ancho: '', alto: 2.5 }],
      }),
    ],
    b: [partida({ id: 'p3', pos: '2.1', code: 'PIN01', title: 'Pintura plástica', cantidad: 200 })],
  };
  return d;
})();

function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer));
    fr.onerror = () => reject(fr.error as Error);
    fr.readAsArrayBuffer(blob);
  });
}

describe('Excel de mediciones sin precios → oferta', () => {
  it('lee los precios que teclea la constructora y casa por código', async () => {
    const doc = buildPresupuestoXlsx(
      buildPresupuestoListado(obra.chapters, obra.partidas),
      obraMeta(obra.obra),
      { firmantes: [], lugar: '', fecha: '' },
      true,
    );
    // La constructora rellena la columna Precio (F).
    const precios: Record<string, number> = { ALB01: 21.5, ALB02: 9.9 };
    for (const r of doc.rows) {
      const code = (r[1] as CellObject | null)?.value;
      if (typeof code === 'string' && code in precios) (r[5] as CellObject).value = precios[code];
    }
    const blob = await writeXlsxFile(doc.rows, { sheet: doc.sheet, columns: doc.columns }).toBlob();
    const filas = filasDeExcel(leerPrimeraHoja(await blobBytes(blob)));
    expect(filas.map((f) => [f.code, f.precio])).toEqual([
      ['ALB01', 21.5],
      ['ALB02', 9.9],
      ['PIN01', 0],
    ]);
    // Cantidad fija, número; la de la medición es una fórmula que nadie ha calculado aún.
    expect(filas[0]!.cantidad).toBe(100);
    expect(Number.isNaN(filas[1]!.cantidad)).toBe(true);
    const { oferta, casamiento } = ofertaDesdeFilas(filas, 'Pérez.xlsx', obra, 'xlsx');
    expect(oferta.precios).toEqual({ p1: 21.5, p2: 9.9 });
    expect(oferta.cantidades).toEqual({});
    expect(casamiento.sinPrecio).toBe(1);
  });

  it('un fichero guardado por Excel: textos compartidos, resultados de fórmula y precio en texto', () => {
    const fila = (n: number, celdas: string) => `<row r="${n}">${celdas}</row>`;
    const s = (ref: string, i: number) => `<c r="${ref}" t="s"><v>${i}</v></c>`;
    const sheet =
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
      fila(1, s('A1', 0) + s('B1', 1) + s('C1', 2) + s('D1', 3) + s('E1', 4) + s('F1', 5)) +
      fila(2, s('A2', 6) + s('B2', 7) + s('C2', 8) + s('D2', 9) + '<c r="E2"><f>ROUND(SUM(E3:E3),2)</f><v>15</v></c><c r="F2" t="inlineStr"><is><t>12,40</t></is></c>') +
      fila(3, s('C3', 10) + '<c r="E3"><v>15</v></c>') +
      '</sheetData></worksheet>';
    const strings = ['Nº', 'Código', 'Descripción', 'Ud.', 'Cantidad', 'Precio', '1.1.2', 'ALB02', 'Enfoscado &amp; maestreado', 'm²', 'Baño — 2 × 3 × 2,5'];
    const shared = `<sst>${strings.map((t) => `<si><t>${t}</t></si>`).join('')}</sst>`;
    const bytes = zipSync({
      'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="Mediciones" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Target="worksheets/sheet1.xml" Id="rId1" Type="x"/></Relationships>'),
      'xl/worksheets/sheet1.xml': strToU8(sheet),
      'xl/sharedStrings.xml': strToU8(shared),
    });
    expect(filasDeExcel(leerPrimeraHoja(bytes))).toEqual([
      { code: 'ALB02', title: 'Enfoscado & maestreado', ud: 'm²', cantidad: 15, precio: 12.4 },
    ]);
  });

  it('un Excel que no es el de mediciones se rechaza con un mensaje claro', () => {
    const bytes = zipSync({ 'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData></sheetData></worksheet>') });
    expect(() => filasDeExcel(leerPrimeraHoja(bytes))).toThrow(/Mediciones sin precios/);
    expect(() => leerPrimeraHoja(new Uint8Array([1, 2, 3]))).toThrow(/no es un fichero de Excel/);
  });
});

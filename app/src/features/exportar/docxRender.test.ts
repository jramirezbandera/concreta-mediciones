import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { docxFor, type DocxState } from './docxRender';
import type { PrintTarget } from '../print';
import { CHAPTERS, DEFAULT_OBRA, DEFAULT_RATES, PARTIDAS, makeCertsInit } from '../../core/seed';
import type { Cert, Chapter, Partida, PartidasMap } from '../../core/types';

/** Blob → bytes vía FileReader (el Blob de jsdom no tiene `arrayBuffer()`). */
function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer));
    fr.onerror = () => reject(fr.error as Error);
    fr.readAsArrayBuffer(blob);
  });
}

/** Desempaqueta el .docx REAL y devuelve el XML del documento. */
async function xmlOf(target: PrintTarget, s: DocxState): Promise<string> {
  const out = await docxFor(target, s);
  expect(out).not.toBeNull();
  const files = unzipSync(await blobBytes(out!.blob));
  return strFromU8(files['word/document.xml']!);
}

const seedState: DocxState = {
  chapters: CHAPTERS,
  partidas: PARTIDAS,
  recursos: {},
  certs: makeCertsInit(PARTIDAS),
  rates: DEFAULT_RATES,
  obra: DEFAULT_OBRA,
};

describe('docxFor — presupuesto (Word real, F7.3)', () => {
  it('genera un .docx válido con cabecera, partidas, mediciones y PEM es-ES', async () => {
    const xml = await xmlOf({ kind: 'presupuesto' }, seedState);
    expect(xml).toContain('Reforma vivienda C/ Mayor 14');
    expect(xml).toContain('PRESUPUESTO Y MEDICIONES');
    expect(xml).toContain('Movimiento de tierras');
    expect(xml).toContain('Excavación en zanjas a máquina'); // partida
    expect(xml).toContain('Zanjas de saneamiento'); // línea de medición embebida
    expect(xml).toContain('26.291,91 €'); // PEM formateado es-ES (texto en Word)
    expect(xml).toContain('Presupuesto de Ejecución Material (PEM)');
  });

  it('fidelidad Word: cabeceras repetidas por página y filas que no parten', async () => {
    const xml = await xmlOf({ kind: 'presupuesto' }, seedState);
    expect(xml).toContain('<w:tblHeader'); // banda + cabecera de columnas repetidas
    expect(xml).toContain('<w:cantSplit'); // las filas no parten entre páginas
  });

  it('página A4 con los márgenes del doc de impresión', async () => {
    const xml = await xmlOf({ kind: 'presupuesto' }, seedState);
    expect(xml).toContain('w:w="11906"'); // A4
    expect(xml).toMatch(/w:pgMar[^>]*w:top="794"/); // 14 mm
  });

  it('el nombre de archivo lleva título y denominación saneados', async () => {
    const out = await docxFor({ kind: 'presupuesto' }, seedState);
    expect(out!.fileName).toBe('Presupuesto y mediciones - Reforma vivienda C Mayor 14.docx');
  });
});

describe('docxFor — resumen', () => {
  it('lleva la cadena hasta el presupuesto base de licitación', async () => {
    const xml = await xmlOf({ kind: 'resumen' }, seedState);
    expect(xml).toContain('Gastos generales');
    expect(xml).toContain('13,0%');
    expect(xml).toContain('Presupuesto base de licitación');
    expect(xml).toContain('34.416,11 €');
  });
});

describe('docxFor — certificación', () => {
  const partida = (over: Partial<Partida>): Partida => ({
    id: 'p',
    pos: '1.1',
    code: 'X',
    title: '',
    ud: 'ud',
    precio: 0,
    desc: '',
    med: [],
    items: [],
    ...over,
  });
  const chapters: Chapter[] = [{ id: '01', code: '1', title: 'Demoliciones' }];
  // El precio vivo (99) cambió tras certificar; el snapshot congeló 10 (F7.0).
  const partidas: PartidasMap = {
    '01': [partida({ id: 'pa', code: 'A', title: 'Partida A', precio: 99, cantidad: 2 })],
  };
  const certs: Cert[] = [
    {
      id: 'c1',
      num: 1,
      period: 'Mayo 2026',
      retencion: 0.05,
      data: { pa: 2 },
      priceSnapshot: { pa: 10 },
      coefK: 1,
      snapshotAt: '2026-06-11T08:00:00.000Z',
      extras: [{ id: 'x1', chapterId: '01', pos: 'C1', title: 'Refuerzo', ud: 'ud', cantidad: 2, precio: 25 }],
    },
  ];
  const state: DocxState = { ...seedState, chapters, partidas, certs };

  it('valora con el precio congelado, lista P.C. y llega al líquido', async () => {
    const xml = await xmlOf({ kind: 'cert', index: 0 }, state);
    expect(xml).toContain('CERTIFICACIÓN DE OBRA Nº 1');
    expect(xml).toContain('Mayo 2026');
    expect(xml).toContain('Precios congelados');
    expect(xml).toContain('10,00'); // precio congelado…
    expect(xml).not.toContain('99,00'); // …no el vivo
    expect(xml).toContain('Refuerzo'); // contradictorio
    expect(xml).toContain('P.C.');
    expect(xml).toContain('Líquido a abonar');
    // certPEM 70 → PEC 83,30 → ret 4,17 → base 79,13 → IVA 7,91 → líquido 87,04
    expect(xml).toContain('87,04 €');
  });

  it('cert inexistente → null (no genera archivo)', async () => {
    expect(await docxFor({ kind: 'cert', index: 9 }, state)).toBeNull();
  });

  it('el nombre de archivo de cert es corto ("Certificación nº N")', async () => {
    const out = await docxFor({ kind: 'cert', index: 0 }, state);
    expect(out!.fileName).toBe('Certificación nº 1 - Reforma vivienda C Mayor 14.docx');
  });
});

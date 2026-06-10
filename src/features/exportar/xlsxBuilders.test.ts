import { describe, expect, it } from 'vitest';
import type { CellObject, Row } from 'write-excel-file/browser';
import {
  FMT_NUM,
  FMT_PCT,
  buildCertXlsx,
  buildPresupuestoXlsx,
  buildResumenXlsx,
  xlsxFileName,
} from './xlsxBuilders';
import { buildCertListado, buildPresupuestoListado, buildResumen, obraMeta } from '../../core/listado';
import type { Cert, Chapter, Partida, PartidasMap, Rates } from '../../core/types';

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

const rates: Rates = { iva: 0.1, gg: 0.13, bi: 0.06, coefK: 1 };
const chapters: Chapter[] = [
  { id: '01', code: '1', title: 'Demoliciones', children: [{ id: '01.01', code: '1.1', title: 'Interiores' }] },
  { id: '03', code: '3', title: 'Albañilería' },
];
const partidas: PartidasMap = {
  '01': [
    partida({ id: 'pa', pos: '1.1', code: 'A', title: 'Huérfana', desc: 'Texto largo.', precio: 10, cantidad: 2 }),
    partida({
      id: 'pb',
      sub: '01.01',
      pos: '1.1.1',
      code: 'B',
      title: 'Con medición',
      precio: 5,
      med: [{ id: 'm1', comment: 'zona A', uds: 2, largo: 3, ancho: '', alto: '' }],
    }),
  ],
  '03': [partida({ id: 'pc', pos: '3.1', code: 'C', title: 'Plana', precio: 7.77, cantidad: 3 })],
};
const meta = obraMeta({ denominacion: 'Reforma X', direccion: 'C/ Mayor 14', localidad: 'Málaga' });

/** Todas las celdas-objeto de un doc, aplanadas. */
function cells(rows: Row[]): CellObject[] {
  return rows.flat().filter((c): c is CellObject => c != null && typeof c === 'object');
}

describe('política numérica XLSX (eng-review F7.2)', () => {
  const doc = buildPresupuestoXlsx(buildPresupuestoListado(chapters, partidas), meta);

  it('cantidades/precios/importes son celdas NUMÉRICAS con formato, no strings', () => {
    const numericas = cells(doc.rows).filter((c) => c.format === FMT_NUM);
    expect(numericas.length).toBeGreaterThan(8);
    for (const c of numericas) {
      expect(typeof c.value).toBe('number');
      expect(c.type).toBe(Number);
    }
  });

  it('ninguna celda de texto lleva un número preformateado tipo "1.234,56"', () => {
    const strings = cells(doc.rows).filter((c) => typeof c.value === 'string');
    for (const c of strings) {
      expect(c.value).not.toMatch(/^\d{1,3}(\.\d{3})*,\d{2}$/);
    }
  });

  it('los importes salen de céntimos exactos (toEur), al céntimo', () => {
    const valores = cells(doc.rows)
      .filter((c) => c.format === FMT_NUM && typeof c.value === 'number')
      .map((c) => c.value as number);
    expect(valores).toContain(23.31); // importe pc = 3 × 7,77
    expect(valores).toContain(73.31); // PEM = 20 + 30 + 23,31
  });
});

describe('buildPresupuestoXlsx', () => {
  const doc = buildPresupuestoXlsx(buildPresupuestoListado(chapters, partidas), meta);

  it('estructura: 7 columnas, nombre de archivo y hoja', () => {
    expect(doc.columns).toHaveLength(7);
    expect(doc.fileName).toBe('Presupuesto y mediciones - Reforma X.xlsx');
    expect(doc.sheet).toBe('Presupuesto');
  });

  it('lleva las mediciones embebidas (comentario — dims) con parcial numérico', () => {
    const med = cells(doc.rows).find((c) => typeof c.value === 'string' && c.value.includes('zona A'));
    expect(med?.value).toBe('zona A — 2 × 3');
    const fila = doc.rows.find((r) => r.includes(med as CellObject))!;
    const parcial = cells([fila]).find((c) => typeof c.value === 'number')!;
    expect(parcial.value).toBe(6);
    expect(parcial.format).toBe(FMT_NUM);
  });

  it('termina en la fila de PEM en negrita', () => {
    const last = doc.rows.at(-1)!;
    const label = cells([last]).find((c) => typeof c.value === 'string')!;
    expect(label.value).toContain('(PEM)');
    const valor = cells([last]).find((c) => typeof c.value === 'number')!;
    expect(valor.value).toBe(73.31);
    expect(valor.fontWeight).toBe('bold');
  });
});

describe('buildResumenXlsx', () => {
  const doc = buildResumenXlsx(buildResumen(chapters, partidas, rates), meta);

  it('porcentajes como número 0–100 con formato % (no string)', () => {
    const pcts = cells(doc.rows).filter((c) => c.format === FMT_PCT);
    expect(pcts.length).toBeGreaterThanOrEqual(4); // % por capítulo + gg/bi/iva
    for (const c of pcts) expect(typeof c.value).toBe('number');
    expect(pcts.map((c) => c.value)).toContain(13); // GG 13%
  });

  it('la cadena PEM→GG→BI→PEC→IVA→total cuadra al céntimo', () => {
    const valores = cells(doc.rows)
      .filter((c) => c.format === FMT_NUM)
      .map((c) => c.value as number);
    expect(valores).toContain(73.31); // PEM
    expect(valores).toContain(9.53); // GG = round2(73,31 × 0,13)
    expect(valores).toContain(4.4); // BI = round2(73,31 × 0,06)
    expect(valores).toContain(87.24); // PEC = suma exacta de las líneas
    expect(valores).toContain(8.72); // IVA = round2(87,24 × 0,10)
    expect(valores).toContain(95.96); // licitación
  });
});

describe('buildCertXlsx', () => {
  const certs: Cert[] = [
    {
      id: 'c1',
      num: 1,
      period: 'Mayo',
      retencion: 0.05,
      data: { pa: 2 },
      priceSnapshot: { pa: 10, pb: 5, pc: 7.77 },
      coefK: 1,
      snapshotAt: '2026-06-11T08:00:00.000Z',
      extras: [{ id: 'x1', chapterId: '03', pos: 'C1', title: 'Extra', ud: 'ud', cantidad: 2, precio: 25 }],
    },
  ];
  // El precio vivo de pa cambió a 99: el XLSX debe valorar con el snapshot (10).
  const vivas: PartidasMap = structuredClone(partidas);
  vivas['01']![0]!.precio = 99;
  const doc = buildCertXlsx(buildCertListado(chapters, vivas, certs, 0, rates)!, meta);

  it('11 columnas, precios congelados en la cabecera y P.C. en filas', () => {
    expect(doc.columns).toHaveLength(11);
    const strings = cells(doc.rows).map((c) => c.value);
    expect(strings).toContain('Precios congelados');
    expect(strings).toContain('11/6/2026');
    expect(strings).toContain('P.C.');
  });

  it('valora con el precio congelado (F7.0) y llega al líquido', () => {
    const nums = cells(doc.rows)
      .filter((c) => c.format === FMT_NUM)
      .map((c) => c.value as number);
    expect(nums).toContain(10); // precio congelado, no 99
    expect(nums).not.toContain(198); // 2 × 99 NO aparece
    expect(nums).toContain(20); // aOrigen pa = 2 × 10
    expect(nums).toContain(50); // extra 2 × 25
    // certPEM = 70 → +19% GG/BI = 83,30 → ret 4,17 → base 79,13 → IVA 7,91 → 87,04
    expect(nums).toContain(87.04);
  });

  it('el certificado anterior y la retención van en negativo', () => {
    const nums = cells(doc.rows)
      .filter((c) => c.format === FMT_NUM)
      .map((c) => c.value as number);
    expect(nums).toContain(-4.17); // retención 5% de 83,30
  });
});

describe('xlsxFileName', () => {
  it('sanea los caracteres ilegales de Windows/macOS', () => {
    expect(xlsxFileName('Cuadro: ¿nº1?', 'Obra "X"/Y|Z')).toBe('Cuadro ¿nº1 - Obra X Y Z.xlsx');
  });
  it('sin denominación no deja guion colgando', () => {
    expect(xlsxFileName('Resumen', '')).toBe('Resumen.xlsx');
  });
});

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

const rates: Rates = { iva: 0.1, gg: 0.13, bi: 0.06, ci: 0, coefK: 1 };
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

/** Expresiones de las celdas de FÓRMULA de un doc. */
function formulas(rows: Row[]): string[] {
  return cells(rows)
    .filter((c) => c.type === 'Formula')
    .map((c) => c.value as string);
}

describe('política numérica XLSX (eng-review F7.2 + fórmulas F7.2b)', () => {
  const doc = buildPresupuestoXlsx(buildPresupuestoListado(chapters, partidas), meta, { firmantes: [], lugar: '', fecha: '' });

  it('cantidades/precios son celdas NUMÉRICAS con formato; los derivados, FÓRMULAS', () => {
    const conFormato = cells(doc.rows).filter((c) => c.format === FMT_NUM);
    expect(conFormato.length).toBeGreaterThan(8);
    for (const c of conFormato) {
      if (c.type === 'Formula') expect(typeof c.value).toBe('string');
      else {
        expect(typeof c.value).toBe('number');
        expect(c.type).toBe(Number);
      }
    }
  });

  it('ninguna celda de texto lleva un número preformateado tipo "1.234,56"', () => {
    const strings = cells(doc.rows).filter((c) => c.type === String && typeof c.value === 'string');
    for (const c of strings) {
      expect(c.value).not.toMatch(/^\d{1,3}(\.\d{3})*,\d{2}$/);
    }
  });

  it('los valores de entrada salen de céntimos/decimales exactos', () => {
    const valores = cells(doc.rows)
      .filter((c) => c.format === FMT_NUM && typeof c.value === 'number')
      .map((c) => c.value as number);
    expect(valores).toContain(7.77); // precio pc
    expect(valores).toContain(3); // cantidad pc (sin medición: valor fijo)
    expect(valores).toContain(6); // parcial de la medición de pb
  });

  it('las fórmulas van sin «=» inicial y en sintaxis en-US', () => {
    for (const f of formulas(doc.rows)) {
      expect(f).not.toMatch(/^=/);
      expect(f).not.toMatch(/;/); // separador de argumentos: coma
    }
  });
});

describe('buildPresupuestoXlsx', () => {
  const doc = buildPresupuestoXlsx(buildPresupuestoListado(chapters, partidas), meta, { firmantes: [], lugar: '', fecha: '' });
  // Layout del fixture: meta 1-4 · cap 1 en 5 (cabecera tabla 6, pa 7, desc 8,
  // sub 9, pb 10, med 11, total 12, blanco 13) · cap 3 en 14 (cabecera 15,
  // pc 16, total 17, blanco 18) · PEM 19.

  it('estructura: 7 columnas, nombre de archivo, hoja y orientación vertical', () => {
    expect(doc.columns).toHaveLength(7);
    expect(doc.fileName).toBe('Presupuesto y mediciones - Reforma X.xlsx');
    expect(doc.sheet).toBe('Presupuesto');
    expect(doc.orientation).toBe('portrait');
  });

  it('lleva las mediciones embebidas (comentario — dims) con parcial numérico', () => {
    const med = cells(doc.rows).find((c) => typeof c.value === 'string' && c.value.includes('zona A'));
    expect(med?.value).toBe('zona A — 2 × 3');
    const fila = doc.rows.find((r) => r.includes(med as CellObject))!;
    const parcial = cells([fila]).find((c) => typeof c.value === 'number')!;
    expect(parcial.value).toBe(6);
    expect(parcial.format).toBe(FMT_NUM);
  });

  it('el importe de cada partida es ROUND(cantidad·precio,2) sobre su fila', () => {
    const fx = formulas(doc.rows);
    expect(fx).toContain('ROUND(E7*F7,2)'); // pa
    expect(fx).toContain('ROUND(E10*F10,2)'); // pb
    expect(fx).toContain('ROUND(E16*F16,2)'); // pc
  });

  it('la cantidad de una partida CON medición es la Σ de sus parciales', () => {
    expect(formulas(doc.rows)).toContain('ROUND(SUM(E11:E11),2)'); // pb (1 línea)
  });

  it('subtotales de grupo y capítulo con SUBTOTAL (los anidados no cuentan doble)', () => {
    const fx = formulas(doc.rows);
    expect(fx).toContain('SUBTOTAL(9,G10:G11)'); // sub 1.1 Interiores (pb + su med)
    // total del cap 1: en su cabecera Y en su fila de total
    expect(fx.filter((f) => f === 'SUBTOTAL(9,G7:G11)')).toHaveLength(2);
    expect(fx.filter((f) => f === 'SUBTOTAL(9,G16:G16)')).toHaveLength(2);
  });

  it('termina en la fila de PEM: fórmula que suma los totales de capítulo, en negrita', () => {
    const last = doc.rows.at(-1)!;
    const label = cells([last]).find((c) => c.type === String)!;
    expect(label.value).toContain('(PEM)');
    const valor = cells([last]).find((c) => c.type === 'Formula')!;
    expect(valor.value).toBe('G12+G17');
    expect(valor.fontWeight).toBe('bold');
  });
});

describe('buildResumenXlsx', () => {
  const doc = buildResumenXlsx(buildResumen(chapters, partidas, rates), meta, {
    firmantes: [],
    lugar: '',
    fecha: '',
  });
  // Layout del fixture: meta 1-4 · cabecera 5 · capítulos 6-7 · blanco 8 ·
  // PEM 9 · GG 10 · BI 11 · PEC 12 · IVA 13 · licitación 14.

  it('las tasas GG/BI/IVA son números 0–100 con formato % (editables en la hoja)', () => {
    const pcts = cells(doc.rows).filter((c) => c.format === FMT_PCT && c.type === Number);
    expect(pcts.map((c) => c.value)).toEqual(expect.arrayContaining([13, 6, 10]));
  });

  it('el % de cada capítulo es fórmula sobre la celda del PEM (protegida del ÷0)', () => {
    expect(formulas(doc.rows)).toContain('IF(D9=0,0,D6/D9*100)');
    expect(formulas(doc.rows)).toContain('IF(D9=0,0,D7/D9*100)');
  });

  it('la cadena PEM→GG→BI→PEC→IVA→total se recalcula por referencia', () => {
    const fx = formulas(doc.rows);
    expect(fx).toContain('SUM(D6:D7)'); // PEM = Σ capítulos
    expect(fx).toContain('ROUND(D9*C10/100,2)'); // GG lee su % de la col C
    expect(fx).toContain('ROUND(D9*C11/100,2)'); // BI
    expect(fx).toContain('D9+D10+D11'); // PEC
    expect(fx).toContain('ROUND(D12*C13/100,2)'); // IVA sobre el PEC
    expect(fx).toContain('D12+D13'); // licitación
  });

  it('los importes de capítulo siguen siendo valores (vienen del motor)', () => {
    const valores = cells(doc.rows)
      .filter((c) => c.format === FMT_NUM && typeof c.value === 'number')
      .map((c) => c.value as number);
    expect(valores).toContain(50); // cap 1 = 20 + 30
    expect(valores).toContain(23.31); // cap 3 = 3 × 7,77
  });

  it('el pie legal es una FÓRMULA sobre el total: la hoja viva no se queda obsoleta', () => {
    const legal = cells(doc.rows).find(
      (c) => typeof c.value === 'string' && c.value.includes('Asciende'),
    )!;
    expect(legal.type).toBe('Formula');
    expect(legal.value).toContain('TEXT(D14,'); // celda del presupuesto base
  });

  it('el total de licitación cierra con regla gruesa', () => {
    const total = cells(doc.rows).find((c) => c.value === 'D12+D13')!;
    expect(total.topBorderStyle).toBe('medium');
    expect(total.fontWeight).toBe('bold');
  });

  it('orientación vertical', () => {
    expect(doc.orientation).toBe('portrait');
  });

  describe('con costes indirectos de obra', () => {
    const conCI = buildResumenXlsx(buildResumen(chapters, partidas, { ...rates, ci: 0.03 }), meta, {
      firmantes: [],
      lugar: '',
      fecha: '',
    });
    // Mismo layout + 2 filas: directos 9 · CI 10 · PEM 11 · GG 12 · BI 13 ·
    // PEC 14 · IVA 15 · licitación 16.

    it('la hoja encadena directos → CI → PEM y sigue recalculando sola', () => {
      const fx = formulas(conCI.rows);
      expect(fx).toContain('SUM(D6:D7)'); // costes directos = Σ capítulos
      expect(fx).toContain('ROUND(D9*C10/100,2)'); // CI lee su % de la col C
      expect(fx).toContain('D9+D10'); // PEM = directos + indirectos
      expect(fx).toContain('ROUND(D11*C12/100,2)'); // GG YA sobre el PEM
      expect(fx).toContain('D11+D12+D13'); // PEC
    });

    it('el % del capítulo pesa sobre los DIRECTOS: la columna cierra en 100 %', () => {
      expect(formulas(conCI.rows)).toContain('IF(D9=0,0,D6/D9*100)');
    });

    it('el % de CI viaja como número editable, igual que GG/BI/IVA', () => {
      const pcts = cells(conCI.rows).filter((c) => c.format === FMT_PCT && c.type === Number);
      expect(pcts.map((c) => c.value)).toEqual(expect.arrayContaining([3, 13, 6, 10]));
    });

    it('sin CI la hoja no estrena ninguna fila (documento idéntico al de siempre)', () => {
      expect(cells(doc.rows).some((c) => c.value === 'Costes indirectos')).toBe(false);
    });
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
  const doc = buildCertXlsx(buildCertListado(chapters, vivas, certs, 0, rates)!, meta, {
    firmantes: [],
    lugar: '',
    fecha: '',
  });
  // Layout del fixture: meta 1-6 · cap 1 en 7 (cabecera 8, pa 9, sub 10, pb 11,
  // total 12, blanco 13) · cap 3 en 14 (cabecera 15, pc 16, extra 17, total 18,
  // blanco 19) · resumen: PEM 20, GG+BI 21, PEC 22, anterior 23, esta 24,
  // retención 25, base 26, IVA 27, líquido 28, retenido acumulado 29.

  it('11 columnas, apaisada, precios congelados en cabecera y P.C. en filas', () => {
    expect(doc.columns).toHaveLength(11);
    expect(doc.orientation).toBe('landscape');
    const strings = cells(doc.rows).map((c) => c.value);
    expect(strings).toContain('Precios a fecha');
    expect(strings).toContain('11/6/2026');
    expect(strings).toContain('P.C.');
  });

  it('valora con el precio congelado (F7.0), no con el vivo', () => {
    const nums = cells(doc.rows)
      .filter((c) => c.format === FMT_NUM && typeof c.value === 'number')
      .map((c) => c.value as number);
    expect(nums).toContain(10); // precio congelado, no 99
    expect(nums).not.toContain(99);
  });

  it('a origen/% /esta cert son fórmulas por fila; el anterior es valor (cert N−1)', () => {
    const fx = formulas(doc.rows);
    expect(fx).toContain('ROUND(F9*H9,2)'); // aOrigen pa
    expect(fx).toContain('IF(E9=0,0,F9/E9*100)'); // % pa
    expect(fx).toContain('I9-J9'); // esta cert pa
    expect(fx).toContain('ROUND(F17*H17,2)'); // aOrigen del contradictorio
    const pa = doc.rows[8]!; // fila 9
    const anterior = pa[9] as CellObject;
    expect(anterior.type).toBe(Number);
    expect(anterior.value).toBe(0);
  });

  it('totales de capítulo con SUBTOTAL en las tres columnas de importes', () => {
    const fx = formulas(doc.rows);
    for (const col of ['I', 'J', 'K']) {
      expect(fx.filter((f) => f === `SUBTOTAL(9,${col}9:${col}11)`)).toHaveLength(2); // cap 1
      expect(fx.filter((f) => f === `SUBTOTAL(9,${col}16:${col}17)`)).toHaveLength(2); // cap 3
    }
  });

  it('el resumen económico replica certTotals con fórmulas encadenadas', () => {
    const fx = formulas(doc.rows);
    expect(fx).toContain('I12+I18'); // PEM certificado = Σ totales de capítulo
    expect(fx).toContain('ROUND(K20*0.19,2)'); // GG+BI (13+6)
    expect(fx).toContain('K20+K21'); // PEC a origen
    expect(fx).toContain('-((J12+J18)+ROUND((J12+J18)*0.19,2))'); // cert anterior
    expect(fx).toContain('K22+K23'); // esta certificación
    expect(fx).toContain('-ROUND(K24*0.05,2)'); // retención 5%
    expect(fx).toContain('SUM(K24:K25)'); // base = esta cert − retención
    expect(fx).toContain('ROUND(K26*0.1,2)'); // IVA
    expect(fx).toContain('K26+K27'); // líquido
  });

  it('emite la línea informativa de retenido acumulado (garantía) como valor', () => {
    const strings = cells(doc.rows).map((c) => c.value);
    expect(strings).toContain('Retenido acumulado (garantía)');
    const nums = cells(doc.rows)
      .filter((c) => c.format === FMT_NUM && typeof c.value === 'number')
      .map((c) => c.value as number);
    expect(nums).toContain(4.17); // acumulado = retenido de la única cert (positivo, informativo)
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

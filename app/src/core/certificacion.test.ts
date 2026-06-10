import { describe, expect, it } from 'vitest';
import {
  cantidadToPct,
  certCalc,
  certChapterRows,
  certTotals,
  estaCertDisplay,
  estaCertToOrigen,
  extraCalc,
  prevDataOf,
  pctToCantidad,
  sumLineQty,
} from './certificacion';
import { toCents, toEur } from './money';
import type { Cert, CertExtra, Chapter, Partida, PartidasMap, Rates } from './types';

const extra = (over: Partial<CertExtra>): CertExtra => ({
  id: 'x1',
  chapterId: '01',
  pos: 'C1',
  title: '',
  ud: 'ud',
  cantidad: 0,
  precio: 0,
  ...over,
});

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

describe('certCalc por partida', () => {
  const p = partida({ id: 'p1', cantidad: 100, precio: 10 });
  const row = certCalc(p, { p1: 50 }, { p1: 20 });

  it('a origen / anterior / esta cert', () => {
    expect(toEur(row.aOrigen)).toBe(500); // 50 × 10
    expect(toEur(row.anterior)).toBe(200); // 20 × 10
    expect(toEur(row.estaCert)).toBe(300); // 500 − 200
  });

  it('% de ejecución = ejecutada / ofertada', () => {
    expect(row.ofertada).toBe(100);
    expect(row.pct).toBe(50);
  });

  it('partida no ejecutada → todo 0', () => {
    const r = certCalc(p, {}, {});
    expect(r.aOrigen).toBe(0);
    expect(r.estaCert).toBe(0);
    expect(r.pct).toBe(0);
  });

  it('aplica el coeficiente K al precio', () => {
    const r = certCalc(p, { p1: 50 }, {}, 1.13);
    expect(toEur(r.aOrigen)).toBe(565); // 50 × (10 × 1,13)
  });
});

describe('certTotals (cadena GG+BI → retención → IVA → líquido)', () => {
  const partidas = [partida({ id: 'p1', cantidad: 100, precio: 10 })];
  const t = certTotals(partidas, { p1: 50 }, { p1: 20 }, rates, 0.05);

  it('PEM presupuesto y certificado a origen / anterior', () => {
    expect(toEur(t.budgetPEM)).toBe(1000); // 100 × 10
    expect(toEur(t.certPEM)).toBe(500);
    expect(toEur(t.prevPEM)).toBe(200);
    expect(t.pctGlobal).toBe(50);
  });

  it('PEC a origen, anterior y esta certificación', () => {
    expect(toEur(t.ggbiOrigen)).toBe(95); // 500 × 0,19
    expect(toEur(t.pecOrigen)).toBe(595); // 500 + 95
    expect(toEur(t.pecPrev)).toBe(238); // 200 × 1,19
    expect(toEur(t.pecEsta)).toBe(357); // 595 − 238
  });

  it('retención, base, IVA y líquido a abonar', () => {
    expect(toEur(t.retencion)).toBe(17.85); // 357 × 5%
    expect(toEur(t.base)).toBe(339.15); // 357 − 17,85
    expect(toEur(t.iva)).toBe(33.92); // round2(339,15 × 10%) = 33,92
    expect(toEur(t.liquido)).toBe(373.07); // 339,15 + 33,92
  });
});

describe('extraCalc (precios contradictorios, F4.4)', () => {
  const e = extra({ id: 'x1', cantidad: 4, precio: 25 });
  it('importe a-origen = cantidad · precio, SIN coeficiente K', () => {
    const k = extraCalc(e, 0);
    expect(toEur(k.aOrigen)).toBe(100); // 4 × 25
    expect(toEur(k.anterior)).toBe(0);
    expect(toEur(k.estaCert)).toBe(100);
  });
  it('esta cert = aOrigen − anterior (cantidad de la cert previa)', () => {
    const k = extraCalc(e, 1); // 1 ud certificada antes
    expect(toEur(k.anterior)).toBe(25); // 1 × 25
    expect(toEur(k.estaCert)).toBe(75); // 100 − 25
  });
});

describe('certTotals con contradictorios (F4.4)', () => {
  const partidas = [partida({ id: 'p1', cantidad: 100, precio: 10 })];
  const extras = [extra({ id: 'x1', cantidad: 4, precio: 25 })]; // 100 € a-origen
  const t = certTotals(partidas, { p1: 50 }, { p1: 20 }, rates, 0, 1, extras, []);

  it('suman a certificado/anterior pero NO al PEM de presupuesto', () => {
    expect(toEur(t.budgetPEM)).toBe(1000); // sólo la partida
    expect(toEur(t.certPEM)).toBe(600); // 500 + 100 del contradictorio
    expect(toEur(t.prevPEM)).toBe(200); // el contradictorio es nuevo → anterior 0
  });
  it('el "anterior" del contradictorio sale de prevExtras (mismo id)', () => {
    const prev = [extra({ id: 'x1', cantidad: 1, precio: 25 })];
    const t2 = certTotals(partidas, { p1: 50 }, { p1: 20 }, rates, 0, 1, extras, prev);
    expect(toEur(t2.prevPEM)).toBe(225); // 200 + 25 (1 × 25)
  });
});

describe('modo "esta certificación" (edición)', () => {
  it('muestra ejecutada − anterior y guarda max(0, prev + v)', () => {
    expect(estaCertDisplay(50, 20)).toBe(30);
    expect(estaCertToOrigen(20, 30)).toBe(50); // ida y vuelta
    expect(estaCertToOrigen(20, -30)).toBe(0); // no baja de 0
  });
});

describe('prevDataOf', () => {
  const certs: Cert[] = [
    { id: 'c1', num: 1, period: 'Abr', retencion: 0.05, data: { p1: 10 } },
    { id: 'c2', num: 2, period: 'May', retencion: 0.05, data: { p1: 25 } },
  ];
  it('la primera no tiene anterior; la segunda usa la primera', () => {
    expect(prevDataOf(certs, 0)).toEqual({});
    expect(prevDataOf(certs, 1)).toEqual({ p1: 10 });
  });
});

describe('certChapterRows (avance por capítulo, F4)', () => {
  const chapters: Chapter[] = [
    { id: '01', code: '1', title: 'Cap uno' },
    { id: '02', code: '2', title: 'Cap dos (vacío)' },
  ];
  const partidas: PartidasMap = {
    '01': [partida({ id: 'p1', cantidad: 100, precio: 10 })], // importe 1.000 €
    '02': [],
  };

  it('suma presupuesto y certificado por capítulo y descarta los de 0', () => {
    const rows = certChapterRows(chapters, partidas, { p1: 50 }, {});
    expect(rows).toHaveLength(1); // el cap 02 (budget 0) se filtra
    const r = rows[0]!;
    expect(r.id).toBe('01');
    expect(r.budget).toBe(toCents(1000)); // 100 · 10
    expect(r.cert).toBe(toCents(500)); // 50 · 10 a origen
    expect(r.pct).toBeCloseTo(50);
  });
});

describe('% editable (F4, dogfood #1) — cantidad, no dinero', () => {
  it('pctToCantidad/cantidadToPct son inversos sobre la ofertada', () => {
    expect(pctToCantidad(124.65, 50)).toBe(62.33); // round2(62.325)
    expect(cantidadToPct(100, 50)).toBe(50);
    expect(cantidadToPct(0, 5)).toBe(0); // sin ofertada → 0, no NaN
  });
});

describe('sumLineQty (certificar marcando líneas, F4.3)', () => {
  it('suma las cantidades por línea a-origen, redondeo a 2 dec', () => {
    expect(sumLineQty({ a: 61.2, b: 63.45 })).toBe(124.65);
    expect(sumLineQty({ a: 0.1, b: 0.2 })).toBe(0.3); // round2 corrige el float
  });
  it('vacío/undefined → 0', () => {
    expect(sumLineQty({})).toBe(0);
    expect(sumLineQty(undefined)).toBe(0);
  });
});

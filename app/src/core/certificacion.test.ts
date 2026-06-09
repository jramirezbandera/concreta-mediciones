import { describe, expect, it } from 'vitest';
import {
  certCalc,
  certTotals,
  estaCertDisplay,
  estaCertToOrigen,
  prevDataOf,
} from './certificacion';
import { toEur } from './money';
import type { Cert, Partida, Rates } from './types';

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

import { describe, expect, it } from 'vitest';
import {
  fmtCents,
  fmtEur,
  fmtNum,
  importeCents,
  parseEsNumber,
  pctCents,
  round2,
  scaleCents,
  sumCents,
  toCents,
  toEur,
} from './money';

describe('round2', () => {
  it('redondea a 2 decimales', () => {
    expect(round2(14.2)).toBe(14.2);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.293293)).toBe(2.29);
  });

  it('evita el error de representación de float clásico', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});

describe('fmtNum', () => {
  it('usa miles con punto y decimales con coma', () => {
    expect(fmtNum(28420.18)).toBe('28.420,18');
    expect(fmtNum(2293.29)).toBe('2.293,29');
  });

  it('fuerza separador de miles en 4 cifras', () => {
    expect(fmtNum(1000)).toBe('1.000,00');
  });

  it('respeta el número de decimales', () => {
    expect(fmtNum(12.5, 1)).toBe('12,5');
    expect(fmtNum(7, 0)).toBe('7');
  });

  it('devuelve cadena vacía para valores no numéricos', () => {
    expect(fmtNum(null)).toBe('');
    expect(fmtNum(undefined)).toBe('');
    expect(fmtNum(NaN)).toBe('');
  });
});

describe('fmtEur', () => {
  it('añade el sufijo de euro', () => {
    expect(fmtEur(28420.18)).toBe('28.420,18 €');
    expect(fmtEur(0)).toBe('0,00 €');
  });
});

describe('parseEsNumber', () => {
  it('invierte fmtNum (quita miles, coma → punto)', () => {
    expect(parseEsNumber('28.420,18')).toBe(28420.18);
    expect(parseEsNumber('2.293,29')).toBe(2293.29);
    expect(parseEsNumber('14,20')).toBe(14.2);
  });

  it('acepta enteros y números simples', () => {
    expect(parseEsNumber('1000')).toBe(1000);
    expect(parseEsNumber('5')).toBe(5);
  });

  it('ignora espacios', () => {
    expect(parseEsNumber(' 1.234,56 ')).toBe(1234.56);
  });

  it('devuelve null para entradas inválidas', () => {
    expect(parseEsNumber('')).toBeNull();
    expect(parseEsNumber('abc')).toBeNull();
    expect(parseEsNumber('-')).toBeNull();
  });

  it('T-6: rechaza entrada malformada en vez de tragarla (parseFloat)', () => {
    expect(parseEsNumber('12abc')).toBeNull(); // antes → 12
    expect(parseEsNumber('1,2,3')).toBeNull(); // antes → 1.2
    expect(parseEsNumber('12,')).toBeNull(); // coma sin decimales
    expect(parseEsNumber('1,5e3')).toBeNull(); // notación rara
    expect(parseEsNumber('10%')).toBeNull(); // símbolo pegado
  });

  it('T-6: permite negativos (corrección "esta certificación")', () => {
    expect(parseEsNumber('-12,5')).toBe(-12.5);
    expect(parseEsNumber('-1.234,56')).toBe(-1234.56);
  });
});

describe('dinero en céntimos', () => {
  it('toCents/toEur ida y vuelta', () => {
    expect(toCents(18.42)).toBe(1842);
    expect(toCents(0)).toBe(0);
    expect(toEur(1842)).toBe(18.42);
    expect(toEur(toCents(28420.18))).toBe(28420.18);
  });

  it('sumCents acumula sin error de float (0,1 + 0,2 = 0,3)', () => {
    // El clásico: en float 0.1 + 0.2 = 0.30000000000000004.
    expect(toEur(sumCents([toCents(0.1), toCents(0.2)]))).toBe(0.3);
    expect(sumCents([1842, 2418, 1275])).toBe(5535);
    expect(sumCents([])).toBe(0);
  });

  it('importeCents = round2(cantidad · precio) en céntimos', () => {
    expect(importeCents(14.2, 11.4)).toBe(16188); // 161,88 €
    expect(importeCents(573.95, 18.42)).toBe(1057216); // 10.572,16 €
    expect(importeCents(0, 99)).toBe(0);
  });

  it('scaleCents = round2(importe · factor) — PEC = PEM · (1+gg+bi)', () => {
    expect(scaleCents(toCents(26196.66), 1.19)).toBe(toCents(31174.03)); // round2(31174.0254)
    expect(scaleCents(toCents(100), 1.13)).toBe(11300); // coefK +13%
  });

  it('pctCents = round2(importe · pct/100) — %CI, retención', () => {
    expect(pctCents(toCents(1000), 5)).toBe(toCents(50)); // 5% de 1000
    expect(pctCents(toCents(9), 3)).toBe(toCents(0.27)); // 3% de 9 = 0,27
  });

  it('fmtCents formatea en euros español', () => {
    expect(fmtCents(2842018)).toBe('28.420,18 €');
    expect(fmtCents(0)).toBe('0,00 €');
  });
});

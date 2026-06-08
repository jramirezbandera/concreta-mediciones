import { describe, expect, it } from 'vitest';
import { fmtEur, fmtNum, parseEsNumber, round2 } from './money';

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
});

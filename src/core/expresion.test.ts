import { describe, expect, it } from 'vitest';
import { evalEsExpr, leerCelda } from './expresion';

describe('evalEsExpr', () => {
  it('suma, resta, multiplica y divide con coma decimal', () => {
    expect(evalEsExpr('5,57+3')).toBe(8.57);
    expect(evalEsExpr('12-0,3')).toBe(11.7);
    expect(evalEsExpr('2*4,5')).toBe(9);
    expect(evalEsExpr('9/4')).toBe(2.25);
  });

  it('respeta la precedencia y los paréntesis', () => {
    expect(evalEsExpr('2+3*4')).toBe(14);
    expect(evalEsExpr('(2+3)*4')).toBe(20);
    expect(evalEsExpr('(12 - 0,3) / 2')).toBe(5.85);
    expect(evalEsExpr('-2+5')).toBe(3);
    expect(evalEsExpr('3*-2')).toBe(-6);
  });

  it('admite x, ×, · y ÷ como en papel', () => {
    expect(evalEsExpr('2x3,5')).toBe(7);
    expect(evalEsExpr('2×3,5')).toBe(7);
    expect(evalEsExpr('2·3,5')).toBe(7);
    expect(evalEsExpr('7÷2')).toBe(3.5);
    expect(evalEsExpr('5−2')).toBe(3);
  });

  it('lee cada número con la regla de parseEsNumber (punto de CAD = decimal)', () => {
    expect(evalEsExpr('5,57+3.2')).toBe(8.77); // la coma ya estaba: el punto es decimal
    expect(evalEsExpr('1.234,5+1')).toBe(1235.5); // con coma, el punto son miles
    expect(evalEsExpr(',5+,5')).toBe(1);
  });

  it('no arrastra ruido de coma flotante', () => {
    expect(evalEsExpr('0,1+0,2')).toBe(0.3);
    expect(evalEsExpr('10/3')).toBe(3.333333);
  });

  it('rechaza lo que no se puede calcular', () => {
    for (const s of ['', '5+', '*2', '(2+3', '2+3)', '2/0', '5,57+3a', '1,2,3+1', '2 3', '()']) {
      expect(evalEsExpr(s), s).toBeNull();
    }
  });
});

describe('leerCelda', () => {
  it('un número suelto no guarda operación', () => {
    expect(leerCelda('14,5')).toEqual({ value: 14.5 });
    expect(leerCelda('-2')).toEqual({ value: -2 });
  });

  it('una operación devuelve el resultado y la operación tal cual', () => {
    expect(leerCelda(' 5,57+3 ')).toEqual({ value: 8.57, expr: '5,57+3' });
  });

  it('null si no se puede leer', () => {
    expect(leerCelda('5,57+')).toBeNull();
  });
});

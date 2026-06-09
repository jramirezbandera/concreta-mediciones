import { describe, expect, it } from 'vitest';
import { lineParcial, medTotal, partidaCantidad, partidaImporte } from './medicion';
import { toEur } from './money';
import type { MedLine, Partida } from './types';

const ml = (
  uds: MedLine['uds'],
  largo: MedLine['largo'],
  ancho: MedLine['ancho'],
  alto: MedLine['alto'],
): MedLine => ({ comment: '', uds, largo, ancho, alto });

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

describe('lineParcial', () => {
  it('multiplica las cuatro dimensiones', () => {
    expect(lineParcial(ml(1, 85, 0.6, 1.2))).toBe(61.2);
    expect(lineParcial(ml(8, 1.5, 1.5, 1.4))).toBe(25.2);
  });

  it('una dimensión vacía cuenta como factor 1', () => {
    expect(lineParcial(ml(1, 14.2, '', ''))).toBe(14.2); // arena 0/5
    expect(lineParcial(ml('', '', '', ''))).toBe(1);
    expect(lineParcial(ml(1, 18, 12, ''))).toBe(216);
  });

  it('un 0 explícito SÍ anula la línea (a diferencia del vacío)', () => {
    expect(lineParcial(ml(1, 5, 0, ''))).toBe(0);
    expect(lineParcial(ml(0, 5, 2, 1))).toBe(0);
  });
});

describe('medTotal', () => {
  it('suma los parciales redondeados', () => {
    // p111: zanjas de saneamiento + instalaciones
    expect(medTotal([ml(1, 85, 0.6, 1.2), ml(1, 70.5, 0.5, 1.8)])).toBe(124.65);
  });

  it('devuelve 0 sin líneas', () => {
    expect(medTotal([])).toBe(0);
  });
});

describe('partidaCantidad', () => {
  it('usa la medición si la hay', () => {
    expect(partidaCantidad(partida({ med: [ml(1, 14.2, '', '')] }))).toBe(14.2);
  });

  it('usa la cantidad fija si no hay medición', () => {
    expect(partidaCantidad(partida({ cantidad: 7.5 }))).toBe(7.5);
  });

  it('0 si no hay ni medición ni cantidad', () => {
    expect(partidaCantidad(partida({}))).toBe(0);
  });
});

describe('partidaImporte (céntimos)', () => {
  it('round2(cantidad · precio) en céntimos', () => {
    const arena = partida({ med: [ml(1, 14.2, '', '')], precio: 11.4 });
    expect(partidaImporte(arena)).toBe(16188); // 161,88 €
    expect(toEur(partidaImporte(arena))).toBe(161.88);
  });

  it('aplica el coeficiente K global al precio', () => {
    const arena = partida({ med: [ml(1, 14.2, '', '')], precio: 11.4 });
    // 14,2 × (11,4 × 1,13) = 14,2 × 12,882 = round2(182,9244) = 182,92 €
    expect(toEur(partidaImporte(arena, 1.13))).toBe(182.92);
  });

  it('partida sin cantidad → importe 0', () => {
    expect(partidaImporte(partida({ precio: 99 }))).toBe(0);
  });
});

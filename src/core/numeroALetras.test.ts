import { describe, expect, it } from 'vitest';
import { asciendeLegal, centsALetras, numeroALetras } from './numeroALetras';

describe('numeroALetras', () => {
  it('escribe las irregularidades del español (teens, veinti-, cien/ciento)', () => {
    expect(numeroALetras(0)).toBe('CERO');
    expect(numeroALetras(16)).toBe('DIECISÉIS');
    expect(numeroALetras(21)).toBe('VEINTIUNO');
    expect(numeroALetras(31)).toBe('TREINTA Y UNO');
    expect(numeroALetras(100)).toBe('CIEN');
    expect(numeroALetras(101)).toBe('CIENTO UNO');
    expect(numeroALetras(500)).toBe('QUINIENTOS');
    expect(numeroALetras(700)).toBe('SETECIENTOS');
    expect(numeroALetras(900)).toBe('NOVECIENTOS');
  });

  it('millares y millones: MIL sin «un», UN MILLÓN con él', () => {
    expect(numeroALetras(1000)).toBe('MIL');
    expect(numeroALetras(21000)).toBe('VEINTIÚN MIL'); // apócope ante MIL, siempre
    expect(numeroALetras(201000)).toBe('DOSCIENTOS UN MIL');
    expect(numeroALetras(1_000_000)).toBe('UN MILLÓN');
    expect(numeroALetras(2_000_000)).toBe('DOS MILLONES');
    expect(numeroALetras(1_500_000_000)).toBe('MIL QUINIENTOS MILLONES');
  });

  it('apócope opcional del uno final (ante EUROS)', () => {
    expect(numeroALetras(1, true)).toBe('UN');
    expect(numeroALetras(21, true)).toBe('VEINTIÚN');
    expect(numeroALetras(131, true)).toBe('CIENTO TREINTA Y UN');
    expect(numeroALetras(132, true)).toBe('CIENTO TREINTA Y DOS');
  });
});

describe('centsALetras', () => {
  it('reproduce el pie de un resumen real (258.140,94 €)', () => {
    expect(centsALetras(25_814_094)).toBe(
      'DOSCIENTOS CINCUENTA Y OCHO MIL CIENTO CUARENTA EUROS con NOVENTA Y CUATRO CÉNTIMOS',
    );
  });

  it('reproduce el pie del ejemplo de Presto (448.144,13 €)', () => {
    expect(centsALetras(44_814_413)).toBe(
      'CUATROCIENTOS CUARENTA Y OCHO MIL CIENTO CUARENTA Y CUATRO EUROS con TRECE CÉNTIMOS',
    );
  });

  it('singulares, importe redondo y cero', () => {
    expect(centsALetras(100)).toBe('UN EURO');
    expect(centsALetras(101)).toBe('UN EURO con UN CÉNTIMO');
    expect(centsALetras(2100)).toBe('VEINTIÚN EUROS');
    expect(centsALetras(0)).toBe('CERO EUROS');
  });

  it('negativo (no debería darse, pero no miente)', () => {
    expect(centsALetras(-150)).toBe('MENOS UN EURO con CINCUENTA CÉNTIMOS');
  });
});

describe('asciendeLegal', () => {
  it('es la frase de cierre completa, con punto final', () => {
    expect(asciendeLegal(3_441_611)).toBe(
      'Asciende el presupuesto base de licitación a la expresada cantidad de TREINTA Y CUATRO MIL CUATROCIENTOS DIECISÉIS EUROS con ONCE CÉNTIMOS.',
    );
  });
});

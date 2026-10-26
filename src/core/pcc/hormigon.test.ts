import { describe, expect, it } from 'vitest';
import { leerDesignacion, pideAireOcluido, pidePenetracion } from './hormigon';

/* Designación T-R/C/TM/A (Código Estructural, art. 33.6) validada contra la tabla 27.1.a
   (docs/plan-control-calidad.md §4; K-PCC.52, Q2). */

const leer = (t: string) => leerDesignacion(t)!;

describe('designación del hormigón', () => {
  it('lee tipo, fck, consistencia, árido y clase', () => {
    expect(leer('Hormigón HA-25/B/20/XC2 en zapatas, vertido con bomba').designacion).toEqual({
      texto: 'HA-25/B/20/XC2',
      tipo: 'HA',
      fck: 25,
      consistencia: 'B',
      arido: 20,
      clases: ['XC2'],
      clasesNoValidas: [],
      reciclado: false,
    });
    expect(leer('HA-25/B/20/XC2').avisos).toEqual([]);
  });

  it('acepta espacios, minúsculas, varias clases y el punto final', () => {
    expect(leer('HA 30 / F / 20 / XS1 + XF2').designacion).toMatchObject({ texto: 'HA-30/F/20/XS1+XF2', clases: ['XS1', 'XF2'] });
    expect(leer('hormigón ha-25/b/20/xc2.').designacion).toMatchObject({ texto: 'HA-25/B/20/XC2', clases: ['XC2'] });
    expect(leer('HA–25/B/20/XC1').designacion.fck).toBe(25);
  });

  it('autocompactante y reciclado', () => {
    expect(leer('HA-35/AC/12/XC1').designacion.consistencia).toBe('AC');
    expect(leer('HA-35/(AC-SF2+AC-V1)/12/XC1').designacion).toMatchObject({ consistencia: 'AC', arido: 12, clases: ['XC1'] });
    expect(leer('HRA-30/B/20/XC1').designacion).toMatchObject({ tipo: 'HA', reciclado: true });
    expect(leer('HRM-20/B/20/X0').designacion).toMatchObject({ tipo: 'HM', reciclado: true });
  });

  it('las clases que no son de la tabla 27.1.a quedan aparte, con aviso', () => {
    for (const mala of ['IIa', 'CX1', 'XC2a', 'IIIa'] as const) {
      const r = leer(`HA-25/B/20/${mala}`);
      expect(r.designacion.clases, mala).toEqual([]);
      expect(r.designacion.clasesNoValidas, mala).toEqual([mala]);
      expect(r.avisos.join(' '), mala).toMatch(/no es una clase de exposición de la tabla 27\.1\.a/);
    }
    // una válida y otra no: la válida cuenta
    expect(leer('HA-25/B/20/XC2+Qb').designacion).toMatchObject({ clases: ['XC2'], clasesNoValidas: ['Qb'] });
  });

  it('X0 en armado avisa; en masa no', () => {
    expect(leer('HA-25/B/20/X0').avisos.join(' ')).toMatch(/X0 en hormigón con armaduras/);
    expect(leer('HM-20/B/20/X0').avisos).toEqual([]);
  });

  it('avisa sin clase, sin consistencia y con fck por debajo del mínimo (art. 33.4)', () => {
    expect(leer('HM-20/P/40').avisos.join(' ')).toMatch(/no dice la clase de exposición/);
    expect(leer('HA-25').avisos.join(' ')).toMatch(/sin consistencia; se cuenta como hormigón convencional/);
    expect(leer('HA-20/B/20/XC1').avisos.join(' ')).toMatch(/no puede ser inferior a 25 N\/mm²/);
    expect(leer('HM-20/B/20/X0').avisos.join(' ')).not.toMatch(/inferior/);
  });

  it('sin tipo o sin fck no hay designación', () => {
    expect(leerDesignacion('Hormigón de limpieza en masa, vertido desde camión')).toBeNull();
    expect(leerDesignacion('HA/B/20/XC2')).toBeNull();
    expect(leerDesignacion('Habitación 25 m²')).toBeNull();
    expect(leerDesignacion('CHAPA 25/30')).toBeNull();
  });

  it('qué clases piden penetración de agua y aire ocluido (57.5.7)', () => {
    expect(pidePenetracion(leer('HA-30/B/20/XS1').designacion)).toBe(true);
    expect(pidePenetracion(leer('HA-25/B/20/XC4').designacion)).toBe(false);
    expect(pidePenetracion(leer('HA-25/B/20/IIa').designacion)).toBe(false);
    expect(pideAireOcluido(leer('HA-30/B/20/XC4+XF2').designacion)).toBe(true);
    expect(pideAireOcluido(leer('HA-30/B/20/XF1').designacion)).toBe(false);
    expect(pideAireOcluido(leer('HA-30/B/20/XF4').designacion)).toBe(true);
  });
});

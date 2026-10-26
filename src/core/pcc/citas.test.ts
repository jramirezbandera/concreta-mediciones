import { describe, expect, it } from 'vitest';
import { citasVetadasEn, NO_VETAR } from './citas';
import { designacionImprimible, leerDesignacion } from './hormigon';
import catalogo from './tablas/catalogo.json';
import familias from './tablas/familias.json';

/* Lo que el plan no puede imprimir (K-PCC.50–52, 65, 71; A, B y C (d)). */

const veta = (t: string) => citasVetadasEn(t).map((c) => c.texto);

describe('citas prohibidas', () => {
  it('normas derogadas y sustituidas', () => {
    for (const t of [
      'Según la Instrucción EHE-08',
      'control según EHE',
      'EAE y EFHE',
      'cemento según la RC-08',
      'RD 1630/1992 de productos',
      'Directiva 89/106/CEE',
      'NBE-FL-90',
      'RL-88',
      'laboratorio acreditado',
      'laboratorios homologados',
      'Decreto 13/1988',
      'D 6/2012 JJAA',
      'RD 6/2012',
      'BOJA 19/11/2012',
      'UNE 83300/84',
      'UNE 104281-6-6/85',
      'UNE-EN 13829:2002',
      'ambiente IIa',
      'HA-25/B/20/IIa',
      'clases generales de exposición',
      'Comunidad de Madrid',
      'control a nivel reducido',
      'A rellenar por el proyectista',
      'actuación como laboratorio',
    ])
      expect(veta(t), t).not.toEqual([]);
  });

  it('no veta lo vigente', () => {
    for (const t of [
      ...NO_VETAR,
      'Reglamento (UE) n.º 305/2011 y Reglamento (UE) 2024/3110',
      'Código Estructural (RD 470/2021)',
      'HA-25/B/20/XC2',
      'RC-16 (RD 256/2016)',
      'Decreto 50/2025, art. 27.3 e IT 5',
      'Decreto 67/2011 (BOJA núm. 77, de 19-04-2011)',
      'UNE-EN ISO 9972:2019',
      'tabla A15.2.1',
    ])
      expect(veta(t), t).toEqual([]);
  });

  it('un documento de otra comunidad solo como procedimiento (K-PCC.71)', () => {
    expect(veta('Prueba según el DRC 06/09 de la Generalitat Valenciana.')).not.toEqual([]);
    expect(veta('Procedimiento de referencia: Documento Reconocido DRC 06/09 de la Generalitat Valenciana')).toEqual([]);
  });

  it('ningún texto de familias.json lleva una cita prohibida', () => {
    const textos: string[] = [];
    const recorre = (x: unknown) => {
      if (typeof x === 'string') textos.push(x);
      else if (Array.isArray(x)) x.forEach(recorre);
      else if (x && typeof x === 'object')
        for (const [k, v] of Object.entries(x)) if (!['reconocer', 'texto', 'condicion'].includes(k) || typeof v !== 'string' || !/^[\\^]/.test(v)) recorre(v);
    };
    recorre({ ...familias, excluir: [] });
    for (const t of textos.filter((x) => !/^\^|^\\b/.test(x))) expect(veta(t), t).toEqual([]);
  });

  it('ninguna norma ni descripción del catálogo lleva una cita prohibida', () => {
    for (const e of catalogo.ensayos) for (const t of [e.ensayo, e.norma ?? '']) expect(veta(t), `${e.id}: ${t}`).toEqual([]);
  });

  it('la designación con una clase EHE se imprime sin ella', () => {
    expect(designacionImprimible(leerDesignacion('HA-25/B/20/IIa')!.designacion)).toBe('HA-25/B/20 (clase de exposición por corregir)');
    expect(designacionImprimible(leerDesignacion('HA-30/B/20/XS1+IIa')!.designacion)).toBe('HA-30/B/20/XS1 (clase de exposición por corregir)');
    expect(designacionImprimible(leerDesignacion('HA-25/B/20/XC2')!.designacion)).toBe('HA-25/B/20/XC2');
    expect(veta(designacionImprimible(leerDesignacion('HA-25/B/20/IIa')!.designacion))).toEqual([]);
  });
});

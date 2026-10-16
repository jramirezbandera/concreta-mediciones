import { describe, expect, it } from 'vitest';
import { OBRA_A, OBRA_B, RATES, estudio, estudioB, obraA, obraB } from '../../test/fixtures/rcd/obras';
import { calcularEstudioRcd } from './calculo';
import { documentoRcd, textoPlano, type DocumentoRcd } from './documento';
import type { EstudioRcdDatos } from './tipos';

const META = { denominacion: 'Reforma A', localidad: 'Málaga', promotor: 'Promotora de prueba', constructora: '' };

function docA(over: Partial<EstudioRcdDatos> = {}): DocumentoRcd {
  const { chapters, partidas } = obraA();
  const d = estudio({ capituloGestion: 'g', ...over });
  const r = calcularEstudioRcd({ chapters, partidas, rates: RATES, obra: OBRA_A, estudio: d, hoy: '2026-10-16' });
  return documentoRcd(r, d, META);
}
function docB(over: Partial<EstudioRcdDatos> = {}): DocumentoRcd {
  const { chapters, partidas } = obraB();
  const d = estudioB(over);
  const r = calcularEstudioRcd({ chapters, partidas, rates: RATES, obra: OBRA_B, estudio: d, hoy: '2026-10-16' });
  return documentoRcd(r, d, { ...META, denominacion: 'Unifamiliar B' });
}

/**
 * Lo que la plantilla del estudio y los modelos del COA citan y ya no vale
 * (verificación K-RCD.17 de Instalaciones). Ninguna puede salir en el Word.
 */
const PROHIBIDAS = [
  /MAM\/304/,
  /Ley 10\/1998/,
  /833\/1988|833\/88/,
  /952\/1997/,
  /96\/350/,
  /Ley 5\/2003/,
  /Decreto 4\/1991/,
  /Comunidad de Madrid/,
  /Ley 7\/2007/,
  /art(ículo|\.)\s*104/,
  /a partir de [Yy]eso/,
  /01 04 0[89]/,
  /Ley 22\/2011/,
  /Orden 2726\/2009/,
  /No se prevé operación (de prevención )?alguna/,
];

describe('documento del estudio', () => {
  for (const [nombre, doc] of [
    ['reforma A', docA()],
    ['reforma A, proyecto básico', docA({ fase: 'basico' })],
    ['reforma A, fuera de Andalucía', docA({ comunidad: 'otra' })],
    ['obra nueva B', docB()],
  ] as const) {
    it(`${nombre}: ninguna cita derogada ni de otra comunidad (K-RCD.17)`, () => {
      const texto = textoPlano(doc);
      for (const re of PROHIBIDAS) expect(texto, String(re)).not.toMatch(re);
    });
  }

  it('reforma: los siete apartados, inventario, fianza y anejo, en orden', () => {
    expect(docA().secciones.map((s) => s.id)).toEqual(['objeto', 'agentes', '1', '2', '3', '4', '5', '6', '7', 'inventario', 'fianza', 'anejo']);
  });

  it('proyecto básico: sin 5.º ni 6.º (RD 105/2008 art. 4.2)', () => {
    const ids = docA({ fase: 'basico' }).secciones.map((s) => s.id);
    expect(ids).not.toContain('5');
    expect(ids).not.toContain('6');
    expect(ids).toContain('inventario');
  });

  it('obra nueva: sin inventario y con el método de ratios citado', () => {
    const d = docB();
    expect(d.secciones.map((s) => s.id)).not.toContain('inventario');
    expect(textoPlano(d)).toContain('Herramienta -RCDs =+ ECO-eficiencia');
    expect(textoPlano(d)).not.toContain('Demolición selectiva');
  });

  it('cita la lista de residuos vigente y la Ley 7/2022', () => {
    const t = textoPlano(docA());
    expect(t).toContain('Decisión 2014/955/UE');
    expect(t).toContain('art. 6.1 de la Ley 7/2022');
    expect(t).toContain('Ley 7/2022, art. 30.3');
    expect(t).toContain('Decreto 73/2012, art. 88.1 a)');
    expect(t).toContain('Real Decreto 396/2006');
  });

  it('lo que falta sale como «Pendiente», marcado', () => {
    const d = docA();
    const trozos = d.secciones.flatMap((s) =>
      s.bloques.flatMap((b) => (b.kind === 'p' ? b.p : b.kind === 'lista' ? b.items.flat() : b.t.filas.flat().filter((x) => typeof x !== 'string'))),
    );
    const pendientes = trozos.filter((x) => typeof x !== 'string' && x.pendiente).map((x) => (typeof x === 'string' ? x : x.texto));
    expect(pendientes).toEqual(expect.arrayContaining(['Pendiente: gestor autorizado', 'Pendiente: importe de la fianza según la ordenanza municipal.']));
    expect(pendientes.some((x) => x.includes('ordenanza municipal de residuos'))).toBe(true);
  });

  it('firma el técnico redactor; sin él, no hay firmante', () => {
    expect(docA().firma).toEqual({ nombre: 'Técnica de prueba', sub: 'Arquitecta · Col. 0000' });
    expect(docA({ redactor: null }).firma).toBeNull();
  });

  it('fuera de Andalucía: sin Decreto 73/2012 y con la autonómica pendiente', () => {
    const t = textoPlano(docA({ comunidad: 'otra' }));
    expect(t).not.toContain('Decreto 73/2012');
    expect(t).toContain('Pendiente: normativa autonómica');
  });
});

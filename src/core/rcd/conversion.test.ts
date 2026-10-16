import { describe, expect, it } from 'vitest';
import { convertir, modoAdmitido, unidadRcd, type ResultadoComponente } from './conversion';
import type { ComponenteRcd } from './tipos';

const c = (conversion: ComponenteRcd['conversion'], extra: Partial<ComponenteRcd> = {}): ComponenteRcd => ({
  ler: '17 01 02',
  tipo: 'demolicion',
  conversion,
  ...extra,
});
const ok = (r: ReturnType<typeof convertir>): ResultadoComponente => {
  if ('error' in r) throw new Error(r.error);
  return r;
};

describe('unidades', () => {
  it('normaliza las de los bancos', () => {
    expect(['m3', 'm³', 'M3'].map(unidadRcd)).toEqual(['m3', 'm3', 'm3']);
    expect(['m2', 'm²', 'M2.'].map(unidadRcd)).toEqual(['m2', 'm2', 'm2']);
    expect(['m', 'ml'].map(unidadRcd)).toEqual(['m', 'm']);
    expect(['ud', 'u', 'Ud', 'uds'].map(unidadRcd)).toEqual(['ud', 'ud', 'ud', 'ud']);
    expect(['kg', 't', 'Tn', 'PA', 'h'].map(unidadRcd)).toEqual(['kg', 't', 't', 'pa', 'otra']);
  });

  it('cada modo casa con su unidad', () => {
    expect(modoAdmitido('espesor', 'm²')).toBe(true);
    expect(modoAdmitido('espesor', 'm³')).toBe(false);
    expect(modoAdmitido('pesoUnidad', 'PA')).toBe(true);
    expect(modoAdmitido('directo', 'h')).toBe(true);
  });
});

describe('conversión', () => {
  it('volumen: m³ en obra = medición; t = m³ × densidad', () => {
    const r = ok(convertir(c({ modo: 'volumen' }, { densidad: { tPorM3: 2.5 } }), 4, 'm³'));
    expect(r).toMatchObject({ t: 10, m3EnObra: 4, faltan: [] });
    expect(r.formula).toBe('4 m³ × 2,5 t/m³ = 10 t');
  });

  it('superficie × espesor × densidad', () => {
    const r = ok(convertir(c({ modo: 'espesor', espesor: 0.15 }, { densidad: { tPorM3: 2.5 } }), 2.1, 'm²'));
    expect(r.m3EnObra).toBeCloseTo(0.315, 9);
    expect(r.t).toBeCloseTo(0.7875, 9);
  });

  it('peso por m² del SE-AE, con espesor para los m³', () => {
    const r = ok(convertir(c({ modo: 'pesoSuperficie', tPorM2: 0.06, espesor: 0.045 }), 38.5, 'm2'));
    expect(r.t).toBeCloseTo(2.31, 9);
    expect(r.m3EnObra).toBeCloseTo(1.7325, 9);
  });

  it('longitud × sección', () => {
    const r = ok(convertir(c({ modo: 'seccion', seccion: 0.02 }, { densidad: { tPorM3: 2 } }), 10, 'm'));
    expect(r).toMatchObject({ t: 0.4, m3EnObra: 0.2 });
  });

  it('peso por unidad (y por metro)', () => {
    expect(ok(convertir(c({ modo: 'pesoUnidad', kgPorUd: 25, m3PorUd: null }), 6, 'ud'))).toMatchObject({ t: 0.15, m3EnObra: null });
    expect(ok(convertir(c({ modo: 'pesoUnidad', kgPorUd: 8, m3PorUd: null }), 8, 'm')).formula).toBe('8 m × 8 kg/m = 0,064 t');
  });

  it('masa en kg o t', () => {
    expect(ok(convertir(c({ modo: 'masa' }), 70, 'kg')).t).toBeCloseTo(0.07, 9);
    expect(ok(convertir(c({ modo: 'masa' }, { densidad: { tPorM3: 2 } }), 3, 't'))).toMatchObject({ t: 3, m3EnObra: 1.5 });
  });

  it('directo (del ~R de un .bc3): m³ aparentes del banco', () => {
    const r = ok(convertir(c({ modo: 'directo', tPorUd: 0.1001, m3PorUd: 0.08, m3Base: 'aparente' }), 263.28, 'm²'));
    expect(r.t).toBeCloseTo(26.354, 3);
    expect(r).toMatchObject({ m3EnObra: null });
    expect(r.m3Aparente).toBeCloseTo(21.0624, 6);
  });

  it('reparto de la medición entre componentes', () => {
    const r = ok(convertir(c({ modo: 'volumen' }, { densidad: { tPorM3: 2 }, parte: 0.25 }), 8, 'm³'));
    expect(r).toMatchObject({ t: 4, m3EnObra: 2 });
    expect(r.formula).toBe('8 m³ × 0,25 × 2 t/m³ = 4 t');
  });

  it('lo que falta se dice y no se rellena', () => {
    const r = ok(convertir(c({ modo: 'espesor', espesor: null }), 15, 'm²'));
    expect(r).toMatchObject({ t: null, m3EnObra: null });
    expect(r.faltan).toEqual(['espesor', 'densidad']);
    expect(r.formula).toBe('15 m² × (falta el espesor) × (falta la densidad)');
  });

  it('modo que no casa con la unidad: error con motivo', () => {
    expect(convertir(c({ modo: 'espesor', espesor: 0.1 }), 3, 'm³')).toEqual({ error: 'La partida se mide en m³: no admite «superficie × espesor».' });
  });
});

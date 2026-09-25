import { describe, expect, it } from 'vitest';
import {
  compatibilidad,
  indiceInsercion,
  lineaParaDestino,
  lineasCertificadas,
  normalizarUd,
  ordenTrasDesplazar,
  ordenTrasMover,
  prepararPegado,
} from './medPaste';
import type { Cert, MedLine, Partida } from './types';

const line = (id: string, over: Partial<MedLine> = {}): MedLine => ({
  id,
  comment: '',
  uds: '',
  largo: '',
  ancho: '',
  alto: '',
  ...over,
});

const partida = (over: Partial<Partida> = {}): Partida => ({
  id: 'p1',
  pos: '1.1',
  code: 'EAV011',
  title: 'Destino',
  ud: 'kg',
  precio: 2,
  desc: '',
  med: [],
  items: [],
  ...over,
});

describe('compatibilidad de formas de medir', () => {
  const lin = [line('a', { uds: 2, largo: 5 })];

  it('Peso → Peso es compatible', () => {
    const pes = [line('a', { uds: 2, largo: 5, ancho: 42.2 })];
    const c = compatibilidad(pes, { forma: 'peso', ud: 'kg' }, { forma: 'peso', ud: 'kg' });
    expect(c.compatible).toBe(true);
    expect(c.cambios).toEqual([]);
  });

  it('(a) Peso → Superficie: el kg/m pasa a leerse como Anchura', () => {
    const pes = [line('a', { uds: 2, largo: 5, ancho: 42.2 })];
    const c = compatibilidad(pes, { forma: 'peso', ud: 'kg' }, { forma: 'sup', ud: 'kg' });
    expect(c.compatible).toBe(false);
    expect(c.cambios).toEqual([{ slot: 'ancho', de: 'kg/m', a: 'Anchura', fuera: false }]);
  });

  it('(b) Longitud → Unidades: la longitud cae fuera de la forma destino', () => {
    const c = compatibilidad(lin, { forma: 'lin', ud: 'ud' }, { forma: 'ud', ud: 'ud' });
    expect(c.compatible).toBe(false);
    expect(c.cambios).toEqual([{ slot: 'largo', de: 'Longitud', a: 'Longitud', fuera: true }]);
  });

  it('(c) misma columna pero m → m²: incompatible por la unidad', () => {
    const c = compatibilidad(lin, { forma: 'lin', ud: 'm' }, { forma: 'sup', ud: 'm²' });
    expect(c.cambios).toEqual([]);
    expect(c.udCambia).toBe(true);
    expect(c.compatible).toBe(false);
  });

  it('la ud se normaliza: «ML.» ≡ «m», «m2» ≡ «m²»', () => {
    expect(normalizarUd('ML.')).toBe('m');
    expect(normalizarUd(' m2 ')).toBe('m²');
    expect(compatibilidad(lin, { forma: 'lin', ud: 'ml' }, { forma: 'lin', ud: 'm' }).compatible).toBe(true);
  });

  it('sin origen (texto ajeno) solo cuenta lo que cae fuera', () => {
    expect(compatibilidad(lin, null, { forma: 'sup', ud: 'm²' }).compatible).toBe(true);
    expect(compatibilidad(lin, null, { forma: 'ud', ud: 'ud' }).compatible).toBe(false);
  });

  it('las casillas vacías no cuentan', () => {
    const c = compatibilidad([line('a', { uds: 3 })], { forma: 'vol', ud: 'm³' }, { forma: 'ud', ud: 'm³' });
    expect(c.compatible).toBe(true);
  });
});

describe('lineaParaDestino', () => {
  it('copia en PROFUNDIDAD (expr incluido) y conserva el id', () => {
    const src = line('a', { uds: 8, expr: { uds: '2×4' } });
    const out = lineaParaDestino(src, 'vol');
    expect(out).toEqual(src);
    expect(out).not.toBe(src);
    expect(out.expr).not.toBe(src.expr);
  });

  it('en un destino por Peso rellena el kg/m del perfil que nombra el comentario', () => {
    const out = lineaParaDestino(line('a', { comment: 'Vigas IPE300', uds: 2, largo: 9.5 }), 'peso');
    expect(out.ancho).toBeCloseTo(42.2, 1);
    expect(out.expr?.ancho).toMatch(/IPE ?300/);
  });

  it('un kg/m tecleado a mano manda sobre el perfil', () => {
    const out = lineaParaDestino(line('a', { comment: 'IPE300', ancho: 40 }), 'peso');
    expect(out.ancho).toBe(40);
  });
});

describe('prepararPegado', () => {
  const origen = { code: 'EAV010', forma: 'peso' as const, ud: 'kg' };
  const lines = [line('x', { uds: 2, largo: 5, ancho: 10 }), line('y', { uds: 1, largo: 3, ancho: 10 })];

  it('calcula cantidad e importe del destino antes → después', () => {
    const dest = partida({ medForma: 'peso', med: [line('d1', { uds: 1, largo: 1, ancho: 10 })] });
    const prep = prepararPegado({ destino: dest, chapterId: 'c', destinoForma: 'peso', lines, origen, afterId: null, coefK: 1 });
    expect(prep.compat.compatible).toBe(true);
    expect(prep.antes).toMatchObject({ cantidad: 10, fija: false, importe: 2000 });
    expect(prep.despues).toMatchObject({ cantidad: 140, fija: false, importe: 28000 });
  });

  it('una partida sin líneas parte de su cantidad FIJA', () => {
    const dest = partida({ medForma: 'peso', cantidad: 7 });
    const prep = prepararPegado({ destino: dest, chapterId: 'c', destinoForma: 'peso', lines, origen, afterId: null, coefK: 1 });
    expect(prep.antes).toMatchObject({ cantidad: 7, fija: true });
    expect(prep.despues).toMatchObject({ cantidad: 130, fija: false });
  });

  it('un ancla que no está en el destino se resuelve «al final»', () => {
    const dest = partida({ medForma: 'peso', med: [line('d1')] });
    const prep = prepararPegado({ destino: dest, chapterId: 'c', destinoForma: 'peso', lines, origen, afterId: 'fantasma', coefK: 1 });
    expect(prep.afterId).toBeNull();
  });

  it('indiceInsercion: detrás del ancla, o al final', () => {
    const med = [line('a'), line('b'), line('c')];
    expect(indiceInsercion(med, 'a')).toBe(1);
    expect(indiceInsercion(med, 'c')).toBe(3);
    expect(indiceInsercion(med, null)).toBe(3);
    expect(indiceInsercion(med, 'zz')).toBe(3);
  });
});

describe('lineasCertificadas', () => {
  const cert = (num: number, lineQty: Cert['lineQty']): Cert => ({
    id: `c${num}`,
    num,
    period: '',
    retencion: 0,
    data: {},
    lineQty,
  });

  it('dice qué líneas están certificadas y en qué certificaciones', () => {
    const certs = [cert(1, { p1: { a: 3 } }), cert(2, {}), cert(3, { p1: { a: 3, c: 1, b: 0 } })];
    expect(lineasCertificadas(certs, 'p1', ['a', 'b', 'c', 'd'])).toEqual({
      lineIds: ['a', 'c'],
      certNums: [1, 3],
    });
  });

  it('una partida certificada a mano (sin lineQty) no cuenta', () => {
    const certs = [{ ...cert(1, undefined), data: { p1: 50 } }];
    expect(lineasCertificadas(certs, 'p1', ['a']).lineIds).toEqual([]);
  });
});

describe('reglas de orden', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('ordenTrasMover: delante de otra, al final, y no-op en su sitio', () => {
    expect(ordenTrasMover(ids, 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
    expect(ordenTrasMover(ids, 'a', null)).toEqual(['b', 'c', 'd', 'a']);
    expect(ordenTrasMover(ids, 'b', 'c')).toBeNull(); // ya está delante de c
    expect(ordenTrasMover(ids, 'b', 'b')).toBeNull();
    expect(ordenTrasMover(ids, 'd', null)).toBeNull();
    expect(ordenTrasMover(ids, 'zz', 'a')).toBeNull();
    expect(ordenTrasMover(ids, 'a', 'zz')).toBeNull();
  });

  it('ordenTrasDesplazar: un bloque contiguo sube entero', () => {
    expect(ordenTrasDesplazar(ids, ['b', 'c'], -1)).toEqual(['b', 'c', 'a', 'd']);
    expect(ordenTrasDesplazar(ids, ['b', 'c'], 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('ordenTrasDesplazar: una selección no contigua mueve cada línea una posición', () => {
    expect(ordenTrasDesplazar(ids, ['b', 'd'], -1)).toEqual(['b', 'a', 'd', 'c']);
  });

  it('ordenTrasDesplazar: si una toca el borde, el bloque entero se queda', () => {
    expect(ordenTrasDesplazar(ids, ['a', 'c'], -1)).toBeNull();
    expect(ordenTrasDesplazar(ids, ['b', 'd'], 1)).toBeNull();
    expect(ordenTrasDesplazar(ids, [], 1)).toBeNull();
  });
});

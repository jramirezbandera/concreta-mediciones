import { describe, expect, it } from 'vitest';
import { bc3CodigosPartidas, obraToBc3 } from './bc3export';
import { bc3ToObra } from './bc3import';
import {
  apartarOfertasIlegibles,
  casarOferta,
  compararOfertas,
  empresaDeFichero,
  filasDeObra,
  normalizar,
  partidasCasables,
  type Oferta,
  type OfertaFila,
  type PartidaCasable,
} from './ofertas';
import { DEFAULT_OBRA, DEFAULT_RATES } from './seed';
import type { Chapter, Ilegible, Partida, PartidasMap } from './types';

const partida = (id: string, code: string, title: string, ud: string, cantidad: number, precio: number): Partida => ({
  id,
  pos: id,
  code,
  title,
  ud,
  precio,
  cantidad,
  desc: '',
  med: [],
  items: [],
});
const fila = (code: string, title: string, ud: string, cantidad: number, precio: number): OfertaFila => ({
  code,
  title,
  ud,
  cantidad,
  precio,
});
const casable = (p: Partida): PartidaCasable => ({ id: p.id, code: p.code, title: p.title, ud: p.ud, cantidad: p.cantidad ?? 0 });

const chapters: Chapter[] = [
  { id: 'a', code: '1', title: 'Albañilería' },
  { id: 'b', code: '2', title: 'Pintura' },
];
const partidas: PartidasMap = {
  a: [partida('p1', 'ALB01', 'Tabique de ladrillo', 'm²', 100, 20), partida('p2', 'ALB02', 'Enfoscado', 'm²', 50, 10)],
  b: [partida('p3', 'PIN01', 'Pintura plástica', 'm²', 200, 5)],
};

describe('normalizar', () => {
  it('sin acentos, mayúsculas, signos ni espacios dobles', () => {
    expect(normalizar('  Tabique  de LADRILLO, ½ pie ')).toBe('tabique de ladrillo 1 2 pie');
    expect(normalizar('m²')).toBe(normalizar('M2'));
  });
});

describe('casarOferta', () => {
  const nuestras = Object.values(partidas).flat().map(casable);

  it('por código; la cantidad distinta se guarda y la fila sin precio no cuenta', () => {
    const c = casarOferta(
      [fila('ALB01', 'x', 'm²', 100, 22), fila('ALB02', 'x', 'm²', 55, 9.5), fila('PIN01', 'x', 'm²', 200, 0)],
      nuestras,
    );
    expect(c.precios).toEqual({ p1: 22, p2: 9.5 });
    expect(c.cantidades).toEqual({ p2: 55 });
    expect(c.sinPrecio).toBe(1);
    expect(c.casadas).toBe(2);
    expect(c.sinCasar).toEqual([]);
  });

  it('sin código que case: por título y unidad, solo si es único; lo demás a sinCasar', () => {
    const c = casarOferta(
      [fila('Z1', 'TABIQUE DE LADRILLO', 'm2', 100, 21), fila('Z2', 'Partida nueva', 'ud', 1, 300)],
      nuestras,
    );
    expect(c.precios).toEqual({ p1: 21 });
    expect(c.sinCasar.map((f) => f.code)).toEqual(['Z2']);
  });

  it('el título repetido en la oferta no casa por título (ambiguo)', () => {
    const c = casarOferta([fila('Z1', 'Enfoscado', 'm²', 50, 9), fila('Z2', 'Enfoscado', 'm²', 10, 9)], nuestras);
    expect(c.precios).toEqual({});
    expect(c.sinCasar).toHaveLength(2);
  });

  it('el mismo código en varias partidas se empareja en orden', () => {
    const dos = [casable(partida('q1', 'X', 'Igual', 'ud', 1, 1)), casable(partida('q2', 'X', 'Igual', 'ud', 3, 1))];
    const c = casarOferta([fila('X', 'Igual', 'ud', 1, 8), fila('X', 'Igual', 'ud', 4, 8)], dos);
    expect(c.precios).toEqual({ q1: 8, q2: 8 });
    expect(c.cantidades).toEqual({ q2: 4 });
  });
});

describe('ida y vuelta por .bc3 sin precios', () => {
  it('la oferta que vuelve casa por el código con que viajó, homónimos .2 incluidos', () => {
    const conHomonimo: PartidasMap = {
      ...partidas,
      b: [...partidas.b!, partida('p4', 'ALB01', 'Tabique de ladrillo hueco doble', 'm²', 30, 25)],
    };
    const obra = { chapters, partidas: conHomonimo, recursos: {}, rates: DEFAULT_RATES, obra: DEFAULT_OBRA };
    const devuelta = bc3ToObra(obraToBc3(obra, { sinPrecios: true })).data;
    // La constructora pone precio a todo en Presto.
    let precio = 10;
    for (const ps of Object.values(devuelta.partidas)) for (const p of ps) p.precio = (precio += 1);
    const filas = filasDeObra(devuelta);
    expect(filas.map((f) => f.code)).toEqual(['ALB01', 'ALB02', 'PIN01', 'ALB01.2']);
    const c = casarOferta(filas, partidasCasables(chapters, conHomonimo, bc3CodigosPartidas(obra)));
    expect(c.precios).toEqual({ p1: 11, p2: 12, p3: 13, p4: 14 });
    expect(c.sinCasar).toEqual([]);
    expect(c.cantidades).toEqual({});
  });
});

describe('compararOfertas', () => {
  const oferta = (id: string, precios: Record<string, number>, cantidades: Record<string, number> = {}): Oferta => ({
    id,
    empresa: id,
    fecha: '2026-11-01',
    fichero: `${id}.bc3`,
    precios,
    cantidades,
    sinCasar: [],
  });

  it('importes con NUESTRAS cantidades, mínima por fila, desviación y la mejor completa', () => {
    const c = compararOfertas(chapters, partidas, [
      oferta('A', { p1: 22, p2: 9, p3: 5 }),
      oferta('B', { p1: 18, p2: 11, p3: 6 }, { p3: 210 }),
      oferta('C', { p1: 15 }),
    ]);
    expect(c.pem).toBe(350000); // 2000 + 500 + 1000 €
    const p1 = c.capitulos[0]!.grupos[0]!.rows[0]!;
    expect(p1.ofertas.map((o) => o?.importe)).toEqual([220000, 180000, 150000]);
    expect(p1.ofertas.map((o) => o?.minima)).toEqual([false, false, true]);
    expect(p1.ofertas[0]!.desviacion).toBeCloseTo(10);
    const p3 = c.capitulos[1]!.grupos[0]!.rows[0]!;
    expect(p3.ofertas[1]!.cantidadOferta).toBe(210);
    expect(p3.ofertas[1]!.importe).toBe(120000); // 200 × 6, con nuestra cantidad
    expect(p3.ofertas[2]).toBeNull();
    const [a, b, cc] = c.ofertas;
    expect(a!.total).toBe(365000);
    expect(b!.total).toBe(355000);
    expect(b!.totalSusCantidades).toBe(361000);
    expect(b!.cantidadesDistintas).toBe(1);
    expect(cc!.sinPrecio).toBe(2);
    expect(cc!.desviacion).toBeNull();
    expect(c.ofertas.map((o) => o.mejor)).toEqual([false, true, false]);
    expect(c.capitulos[0]!.totales).toEqual([265000, 235000, 150000]);
  });

  it('sin ofertas sale el presupuesto solo', () => {
    const c = compararOfertas(chapters, partidas, []);
    expect(c.ofertas).toEqual([]);
    expect(c.capitulos[0]!.grupos[0]!.rows[0]!.ofertas).toEqual([]);
  });
});

describe('empresaDeFichero', () => {
  it('el nombre del fichero sin extensión', () => {
    expect(empresaDeFichero('Construcciones_Pérez.bc3')).toBe('Construcciones Pérez');
    expect(empresaDeFichero('.bc3')).toBe('Oferta');
  });
});

describe('apartarOfertasIlegibles', () => {
  type Cargada = { ofertas?: unknown; _ilegible?: Ilegible[] };

  it('aparta la oferta mal formada con su ruta y deja las buenas', () => {
    const buena = { id: 'o', empresa: 'A', fecha: '', fichero: '', precios: { p1: 3 }, cantidades: {}, sinCasar: [] };
    const d = apartarOfertasIlegibles<Cargada>({ ofertas: [buena, { id: 'x', precios: 'no' }] });
    expect(d.ofertas).toEqual([buena]);
    expect(d._ilegible!.map((x) => x.donde)).toEqual(['ofertas/1']);
  });

  it('si no es una lista, fuera entera', () => {
    const d = apartarOfertasIlegibles<Cargada>({ ofertas: { a: 1 } });
    expect(d.ofertas).toBeUndefined();
    expect(d._ilegible!.map((x) => x.donde)).toEqual(['ofertas']);
  });
});

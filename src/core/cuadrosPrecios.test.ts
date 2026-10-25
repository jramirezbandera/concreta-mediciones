import { describe, expect, it } from 'vitest';
import type { Banco, Chapter, Item, Partida } from './types';
import { buildCuadrosPrecios, type CuadroPartidaRow } from './cuadrosPrecios';
import { buildRecursos, descompUnit } from './banco';
import { CHAPTERS, PARTIDAS } from './seed';
import { sumCents } from './money';

const banco: Banco = {
  mo1: { type: 'MO', desc: 'Oficial 1ª', ud: 'h', precio: 20 },
  mo2: { type: 'MO', desc: 'Peón', ud: 'h', precio: 17.5 },
  mq1: { type: 'MQ', desc: 'Hormigonera', ud: 'h', precio: 3.2 },
  mt1: { type: 'MAT', desc: 'Ladrillo', ud: 'ud', precio: 0.15 },
};

const items: Item[] = [
  { code: 'mo1', type: 'MO', cantidad: 0.5 }, // 10,00
  { code: 'mo2', type: 'MO', cantidad: 0.25 }, // 4,38 (4,375)
  { code: 'mq1', type: 'MQ', cantidad: 0.1 }, // 0,32
  { code: 'mt1', type: 'MAT', cantidad: 40 }, // 6,00
  { code: '%MA', type: '%CI', cantidad: 2, desc: 'Medios auxiliares' }, // 2 % de 20,70 = 0,41
  { code: '%CI', type: '%CI', cantidad: 3, desc: 'Costes indirectos' }, // 3 % de 21,11 = 0,63
];

function partida(over: Partial<Partida>): Partida {
  return { id: 'p1', pos: '1.1', code: 'FFR010', title: 'Tabique', ud: 'm²', precio: 0, desc: '', med: [], items: [], ...over };
}
const cap: Chapter[] = [{ id: 'c1', code: '1', title: 'Albañilería', children: [] }];
const filaDe = (p: Partida, coefK = 1): CuadroPartidaRow =>
  buildCuadrosPrecios(cap, { c1: [p] }, banco, coefK).capitulos[0]!.grupos[0]!.rows[0]!;

describe('cuadros de precios — cuadro nº 2', () => {
  it('descompone por tipo y deja cada % en su línea, cerrando en el precio', () => {
    const precio = descompUnit(items, banco);
    expect(precio).toBe(21.74);
    const f = filaDe(partida({ precio, items }));
    expect(f.lineas).toEqual([
      { concepto: 'Mano de obra', importe: 1438 },
      { concepto: 'Maquinaria', importe: 32 },
      { concepto: 'Materiales', importe: 600 },
      { concepto: 'Medios auxiliares (2 %)', importe: 41 },
      { concepto: 'Costes indirectos (3 %)', importe: 63 },
    ]);
    expect(sumCents(f.lineas.map((l) => l.importe))).toBe(f.precio);
  });

  it('no repite el % si la descripción ya lo lleva', () => {
    const conPct: Item[] = [
      { code: 'mo1', type: 'MO', cantidad: 1 },
      { code: '%CI', type: '%CI', cantidad: 3, desc: 'Costes indirectos 3%' },
    ];
    const f = filaDe(partida({ precio: 20.6, items: conPct }));
    expect(f.lineas.map((l) => l.concepto)).toEqual(['Mano de obra', 'Costes indirectos 3%']);
  });

  it('sin justificación: una sola línea con el precio entero', () => {
    const f = filaDe(partida({ precio: 12.3 }));
    expect(f.lineas).toEqual([{ concepto: 'Sin descomposición', importe: 1230 }]);
  });

  it('precio puesto a mano: sin descomposición, aunque tenga justificación', () => {
    expect(filaDe(partida({ precio: 22, items, precioManual: true })).lineas).toEqual([
      { concepto: 'Sin descomposición', importe: 2200 },
    ]);
    // Lo que cuenta es el dato: una marca fósil con el precio ya cuadrado sí descompone.
    expect(filaDe(partida({ precio: 21.74, items, precioManual: true })).lineas).toHaveLength(5);
  });

  it('con K ≠ 1 escala las líneas y el redondeo lo absorbe la mayor', () => {
    const f = filaDe(partida({ precio: 21.74, items }), 1.13);
    expect(f.precio).toBe(2457); // round2(21,74 × 1,13) = 24,57
    expect(f.lineas.map((l) => l.concepto)).toHaveLength(5);
    expect(sumCents(f.lineas.map((l) => l.importe))).toBe(2457);
    // Escaladas suman 24,56 (1625 + 36 + 678 + 46 + 71): el céntimo que falta va a la mayor.
    expect(f.lineas[0]!.importe).toBe(1626);
  });
});

describe('cuadros de precios — cuadro nº 1 y estructura', () => {
  it('lleva el precio con K y en letra', () => {
    const f = filaDe(partida({ precio: 21.74, items }), 1.13);
    expect(f.letras).toBe('VEINTICUATRO EUROS con CINCUENTA Y SIETE CÉNTIMOS');
  });

  it('incluye partidas sin medir y quita los capítulos sin partidas', () => {
    const chapters: Chapter[] = [...cap, { id: 'c2', code: '2', title: 'Vacío', children: [] }];
    const out = buildCuadrosPrecios(chapters, { c1: [partida({ precio: 5 })], c2: [] }, banco);
    expect(out.capitulos.map((c) => c.id)).toEqual(['c1']);
  });

  it('en la obra de ejemplo, cada cuadro nº 2 cierra en el precio del nº 1', () => {
    const out = buildCuadrosPrecios(CHAPTERS, PARTIDAS, buildRecursos(PARTIDAS), 1.07);
    const rows = out.capitulos.flatMap((c) => c.grupos.flatMap((g) => g.rows));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(sumCents(r.lineas.map((l) => l.importe))).toBe(r.precio);
  });
});

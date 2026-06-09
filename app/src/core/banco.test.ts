import { describe, expect, it } from 'vitest';
import {
  buildRecursos,
  descompUnit,
  itemImporteRec,
  precioCuadraDescompuesto,
  precioDescompuesto,
  precioSegunModo,
  recPrecio,
  recursoBase,
  recursoUsage,
} from './banco';
import type { Banco, Item, Partida, PartidasMap } from './types';

// Items de p111 (excavación en zanjas) — descomposición ilustrativa del seed.
const moItem: Item = { code: 'mo001', type: 'MO', desc: 'Peón ordinario', ud: 'h', cantidad: 0.25, precio: 17.52 };
const mqItem: Item = { code: 'mq01ret020', type: 'MQ', desc: 'Retrocargadora', ud: 'h', cantidad: 0.12, precio: 38.5 };
const ciItem: Item = { code: '%CI', type: '%CI', desc: 'Costes indirectos 3%', ud: '%', cantidad: 3.0, precio: 9.0 };
const items111: Item[] = [moItem, mqItem, ciItem];

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

describe('buildRecursos / recursoUsage', () => {
  const partidas: PartidasMap = {
    '01': [
      partida({ id: 'p111', items: items111 }),
      partida({
        id: 'p112',
        items: [
          { code: 'mo001', type: 'MO', desc: 'Peón ordinario', ud: 'h', cantidad: 0.32, precio: 17.52 },
          { code: '%CI', type: '%CI', desc: 'CI', ud: '%', cantidad: 3, precio: 0 },
        ],
      }),
    ],
  };

  it('indexa el banco por código y excluye %CI', () => {
    const banco = buildRecursos(partidas);
    expect(Object.keys(banco).sort()).toEqual(['mo001', 'mq01ret020']);
    expect(banco.mo001).toEqual({ type: 'MO', desc: 'Peón ordinario', ud: 'h', precio: 17.52 });
    expect(banco['%CI']).toBeUndefined();
  });

  it('cuenta el uso de cada recurso (invariante compartido)', () => {
    const u = recursoUsage(partidas);
    expect(u.mo001).toBe(2); // compartido por p111 y p112
    expect(u.mq01ret020).toBe(1);
    expect(u['%CI']).toBeUndefined();
  });
});

describe('recPrecio (precio compartido del banco)', () => {
  it('lee el precio del banco por código, no del item', () => {
    const banco = { mo001: { type: 'MO' as const, desc: '', ud: 'h', precio: 20 } };
    const it: Item = { code: 'mo001', type: 'MO', cantidad: 1, precio: 17.52 };
    expect(recPrecio(it, banco)).toBe(20); // gana el banco
    expect(recPrecio({ code: 'x', type: 'MAT', cantidad: 1, precio: 5 }, banco)).toBe(5); // fallback
  });
});

describe('recursoBase / descompUnit', () => {
  const banco = buildRecursos({ '01': [partida({ items: items111 })] });

  it('coste directo = round2(Σ round2(cantidad · precio)), sin %CI', () => {
    // round2(0,25·17,52)=4,38 + round2(0,12·38,5)=4,62 → 9,00
    expect(recursoBase(items111, banco)).toBe(9.0);
  });

  it('descompUnit = base + %CI (informativo; NO tiene por qué igualar el precio)', () => {
    // 9,00 + round2(9,00·3/100)=0,27 → 9,27. (p111.precio mostrado = 18,42; difieren
    // a propósito: §0 decisión 6, el precio es override manual, no autocalculado.)
    expect(descompUnit(items111, banco)).toBe(9.27);
  });

  it('descompUnit refleja editar el precio del recurso compartido', () => {
    const banco2: Banco = { ...banco, mo001: { type: 'MO', desc: 'Peón ordinario', ud: 'h', precio: 20 } };
    // base = round2(0,25·20)=5,00 + 4,62 = 9,62 ; +3% = 9,91
    expect(recursoBase(items111, banco2)).toBe(9.62);
    expect(descompUnit(items111, banco2)).toBe(9.91);
  });

  it('descompUnit 0 sin items', () => {
    expect(descompUnit([], banco)).toBe(0);
  });
});

describe('itemImporteRec', () => {
  const banco = buildRecursos({ '01': [partida({ items: items111 })] });
  it('recurso normal: round2(cantidad · precioBanco)', () => {
    expect(itemImporteRec(moItem, banco, 9)).toBe(4.38);
  });
  it('%CI: round2(base · cantidad / 100)', () => {
    expect(itemImporteRec(ciItem, banco, 9)).toBe(0.27);
  });
});

describe('precio descompuesto vs override manual (§0 decisión 6)', () => {
  const banco = buildRecursos({ '01': [partida({ items: items111 })] });

  it('precioDescompuesto = suma de la justificación', () => {
    expect(precioDescompuesto(partida({ items: items111 }), banco)).toBe(9.27);
    expect(precioDescompuesto(partida({ items: [] }), banco)).toBe(0);
  });

  it('señal de override: precio ≠ descompUnit → no cuadra', () => {
    // p111 del seed: precio 18,42 con descompuesto 9,27 → salta la señal.
    expect(precioCuadraDescompuesto(partida({ items: items111, precio: 18.42 }), banco)).toBe(false);
    // precio puesto al descompuesto → cuadra.
    expect(precioCuadraDescompuesto(partida({ items: items111, precio: 9.27 }), banco)).toBe(true);
    // sin items no hay descompuesto que contrastar → se considera que cuadra.
    expect(precioCuadraDescompuesto(partida({ items: [], precio: 18.42 }), banco)).toBe(true);
  });

  it('compara en céntimos: ruido binario de float NO dispara override fantasma', () => {
    // descompUnit(items111) = 9,27. Un precio con ruido de float en el último bit
    // (lo que produciría un import/recalc por otra ruta) sigue cuadrando al céntimo.
    const ruidoso = 9.27 + 1e-12; // sub-céntimo: mismo céntimo, distinto binario
    expect(ruidoso).not.toBe(9.27); // de verdad difiere como float (=== daría override)…
    expect(precioCuadraDescompuesto(partida({ items: items111, precio: ruidoso }), banco)).toBe(true); // …pero cuadra
  });

  it('precioSegunModo: descompuesto si no hay override, fijo si lo hay', () => {
    expect(precioSegunModo(partida({ items: items111, precio: 18.42 }), banco)).toBe(9.27);
    expect(precioSegunModo(partida({ items: items111, precio: 18.42, precioManual: true }), banco)).toBe(18.42);
    expect(precioSegunModo(partida({ items: [], precio: 18.42 }), banco)).toBe(18.42);
  });
});

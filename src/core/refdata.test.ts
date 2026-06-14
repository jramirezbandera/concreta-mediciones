import { describe, expect, it } from 'vitest';
import {
  detectCollisions,
  obraToRefSource,
  partidaToRefCopyItem,
  type RefCopyItem,
  type RefPartida,
} from './refdata';
import type { Banco, Chapter, PartidasMap, Partida } from './types';

/* ---- obraToRefSource (adaptar obra propia → fuente) ----------------------- */
describe('obraToRefSource', () => {
  const chapters: Chapter[] = [{ id: '01', code: '1', title: 'Cap' }];
  const partidas: PartidasMap = {
    '01': [
      {
        id: 'p1',
        pos: '1.1',
        code: 'X01',
        title: 'Mi partida',
        ud: 'm²',
        precio: 10,
        desc: 'Descripción larga propia',
        med: [],
        items: [
          { code: 'mo1', type: 'MO', cantidad: 2 },
          { code: '%CI', type: '%CI', cantidad: 3 },
        ],
      } as Partida,
    ],
  };
  const recursos: Banco = { mo1: { type: 'MO', desc: 'Peón ordinario', ud: 'h', precio: 18.5 } };

  it('prefija el id, marca kind/org y conserva la descripción de la partida', () => {
    const rs = obraToRefSource('abc', 'Mi Obra', chapters, partidas, recursos);
    expect(rs.id).toBe('obra:abc');
    expect(rs.kind).toBe('presupuesto');
    expect(rs.org).toBe('Obra propia');
    expect(rs.name).toBe('Mi Obra');
    expect(rs.partidas['01']![0]!.desc).toBe('Descripción larga propia');
  });

  it('HIDRATA los items desde el banco (desc/ud/precio no viven en el item)', () => {
    const rs = obraToRefSource('abc', 'Mi Obra', chapters, partidas, recursos);
    const items = rs.partidas['01']![0]!.items;
    expect(items[0]).toMatchObject({ code: 'mo1', desc: 'Peón ordinario', ud: 'h', precio: 18.5 });
    // %CI no es un recurso del banco: ud '%', precio 0, desc por defecto
    expect(items[1]).toMatchObject({ code: '%CI', type: '%CI', cantidad: 3, ud: '%', precio: 0 });
  });

  it('nombre vacío → "Obra sin nombre"', () => {
    expect(obraToRefSource('x', '', [], {}, {}).name).toBe('Obra sin nombre');
  });
});

/* ---- partidaToRefCopyItem (snapshot para el portapapeles) ----------------- */
describe('partidaToRefCopyItem', () => {
  const recursos: Banco = { mo1: { type: 'MO', desc: 'Peón ordinario', ud: 'h', precio: 18.5 } };
  const partida = (): Partida => ({
    id: 'p1',
    pos: '1.1',
    code: 'X01',
    title: 'Mi partida',
    ud: 'm²',
    precio: 10,
    desc: 'Descripción propia',
    med: [{ id: 'm1', comment: '', dims: {} } as never],
    items: [{ code: 'mo1', type: 'MO', cantidad: 2 }],
  });

  it('hidrata los items desde el banco y conserva desc/precio/ud de la partida', () => {
    const ci = partidaToRefCopyItem(partida(), recursos, 'Obra A');
    expect(ci.sourceName).toBe('Obra A');
    expect(ci.partida.desc).toBe('Descripción propia');
    expect(ci.partida.items[0]).toMatchObject({ code: 'mo1', desc: 'Peón ordinario', ud: 'h', precio: 18.5 });
  });

  it('es un snapshot INMUTABLE: editar la partida origen no muta el portapapeles', () => {
    const src = partida();
    const ci = partidaToRefCopyItem(src, recursos, 'Obra A');
    // mutar el origen después de copiar
    src.title = 'CAMBIADO';
    src.items[0]!.cantidad = 999;
    expect(ci.partida.title).toBe('Mi partida');
    expect(ci.partida.items[0]!.cantidad).toBe(2);
  });
});

/* ---- detectCollisions (colisión de recurso por PRECIO) -------------------- */
describe('detectCollisions', () => {
  const banco: Banco = { mo1: { type: 'MO', desc: 'Peón', ud: 'h', precio: 18 } };
  const item = (code: string, precio: number, desc = 'D'): RefCopyItem => ({
    sourceName: 's',
    partida: {
      id: 'r1',
      pos: '1.1',
      code: 'R',
      title: 'T',
      ud: 'm',
      precio: 1,
      items: [{ code, type: 'MO', cantidad: 1, desc, ud: 'h', precio }],
    } as RefPartida,
  });

  it('mismo código a OTRO precio → colisión', () => {
    const c = detectCollisions([item('mo1', 20)], banco);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ code: 'mo1', existing: { precio: 18 }, incoming: { precio: 20 } });
  });

  it('mismo código y precio (desc distinta) → NO colisión (ruido cosmético)', () => {
    expect(detectCollisions([item('mo1', 18, 'Otra redacción')], banco)).toHaveLength(0);
  });

  it('mismo código y precio pero OTRA unidad → colisión', () => {
    const itUd: RefCopyItem = {
      sourceName: 's',
      partida: {
        id: 'r', pos: '1.1', code: 'R', title: 'T', ud: 'm', precio: 1,
        items: [{ code: 'mo1', type: 'MO', cantidad: 1, desc: 'D', ud: 'jornada', precio: 18 }],
      } as RefPartida,
    };
    expect(detectCollisions([itUd], banco)).toHaveLength(1); // banco mo1 es €/h
  });

  it('precio dentro de medio céntimo → NO colisión (tolerancia)', () => {
    expect(detectCollisions([item('mo1', 18.004)], banco)).toHaveLength(0);
  });

  it('código no presente en el banco → NO colisión', () => {
    expect(detectCollisions([item('nuevo', 99)], banco)).toHaveLength(0);
  });

  it('%CI nunca colisiona', () => {
    const ci: RefCopyItem = {
      sourceName: 's',
      partida: {
        id: 'r2', pos: '1.2', code: 'R2', title: 'T', ud: 'm', precio: 1,
        items: [{ code: '%CI', type: '%CI', cantidad: 3 }],
      } as RefPartida,
    };
    expect(detectCollisions([ci], { '%CI': { type: '%CI', desc: 'x', ud: '%', precio: 5 } })).toHaveLength(0);
  });
});

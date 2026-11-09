/* Lo que lee el agente: los importes salen de los mismos selectores que la app. */
import { beforeEach, describe, expect, it } from 'vitest';
import { toEur } from '../core/money';
import { blankObraData, selectPem, selectResumen, useObraStore } from '../store';
import { arbolObra, buscarEnObra, partidaObra, resumenObra } from './consultas';
import { aplicarLote } from './motor';
import { leerOperaciones } from './operaciones';
import { validarObra } from './validar';

const st = () => useObraStore.getState();

function lote(raw: unknown[]) {
  const l = leerOperaciones(raw);
  if (!l.ok) throw new Error(JSON.stringify(l.errores));
  const r = aplicarLote(useObraStore, l.ops);
  if (!r.ok) throw new Error(JSON.stringify(r.recibos.at(-1)));
}

beforeEach(() => {
  st().loadObra(blankObraData('Vivienda'));
  lote([
    { op: 'crear_capitulo', titulo: 'Movimiento de tierras' },
    { op: 'crear_subcapitulo', padre: '1', titulo: 'Excavaciones' },
    {
      op: 'crear_partida',
      capitulo: '1.1',
      codigo: 'ADE010',
      titulo: 'Excavación en zanjas',
      ud: 'm³',
      precio: 18.5,
      descripcion: 'Excavación en zanjas para cimentaciones.',
      lineas: [
        { comentario: 'Zanja eje A', uds: 1, largo: 12, ancho: 0.6, alto: 0.8 },
        { comentario: 'Zanja eje B', uds: 2, largo: 8, ancho: 0.6, alto: 0.8 },
      ],
    },
    { op: 'crear_capitulo', titulo: 'Cimentación' },
    { op: 'crear_partida', capitulo: '2', titulo: 'Hormigón de limpieza', ud: 'm²' },
    { op: 'set_porcentajes', gg: 13, bi: 6, iva: 10 },
  ]);
});

describe('resumen', () => {
  it('los importes son los de la hoja Resumen de la app, en euros', () => {
    const r = resumenObra(st());
    const app = selectResumen(st());
    expect(r.importes.pem).toBe(toEur(selectPem(st())));
    expect(r.importes.total).toBe(toEur(app.total));
    expect(r.importes.pem).toBe(248.64);
    expect(r.porcentajes).toEqual({ gg: 13, bi: 6, iva: 10, ci: 0 });
    expect(r.capitulos.map((c) => [c.codigo, c.importe])).toEqual([
      ['1', 248.64],
      ['2', 0],
    ]);
    expect(r.recuento).toEqual({ capitulos: 2, partidas: 2, lineas: 2 });
  });
});

describe('árbol', () => {
  it('capítulos, subcapítulos y partidas con su cantidad, precio e importe', () => {
    const a = arbolObra(st());
    if (!a.ok) throw new Error(a.mensaje);
    const [c1, c2] = a.capitulos;
    expect(c1).toMatchObject({ tipo: 'capitulo', codigo: '1', importe: 248.64 });
    expect(c1!.partidas).toBeUndefined();
    expect(c1!.hijos![0]!.partidas![0]).toMatchObject({
      pos: '1.1.1',
      codigo: 'ADE010',
      cantidad: 13.44,
      precio: 18.5,
      importe: 248.64,
      lineas: 2,
    });
    expect(c2!.partidas![0]).toMatchObject({ pos: '2.1', precio: 0, cantidad: 0 });
  });

  it('un capítulo solo, sin partidas, o hasta una profundidad', () => {
    const a = arbolObra(st(), { capitulo: 'Cimentación', partidas: false });
    expect(a.ok && a.capitulos.map((c) => [c.codigo, c.partidas])).toEqual([['2', undefined]]);
    const b = arbolObra(st(), { profundidad: 0 });
    expect(b.ok && b.capitulos[0]!.hijos).toBeUndefined();
    expect(arbolObra(st(), { capitulo: '9' }).ok).toBe(false);
  });
});

describe('partida', () => {
  it('su medición línea a línea, con el parcial de cada una', () => {
    const r = partidaObra(st(), '1.1.1');
    if (!r.ok) throw new Error(r.mensaje);
    expect(r.partida).toMatchObject({
      pos: '1.1.1',
      titulo: 'Excavación en zanjas',
      capitulo: { codigo: '1.1', titulo: 'Excavaciones' },
      cantidad: 13.44,
      importe: 248.64,
      certificada: [],
    });
    expect(r.partida.lineas.map((l) => [l.n, l.comentario, l.ancho, l.parcial])).toEqual([
      [1, 'Zanja eje A', 0.6, 5.76],
      [2, 'Zanja eje B', 0.6, 7.68],
    ]);
    expect(partidaObra(st(), '4.4').ok).toBe(false);
  });
});

describe('buscar', () => {
  it('por texto o código, con dónde está', () => {
    const r = buscarEnObra(st(), 'zanjas');
    expect(r.aciertos).toEqual([
      expect.objectContaining({
        pos: '1.1.1',
        ubicacion: '1 Movimiento de tierras › 1.1 Excavaciones',
      }),
    ]);
    expect(buscarEnObra(st(), 'ade010').aciertos).toHaveLength(1);
  });
});

describe('validar', () => {
  it('una obra hecha con el motor no tiene errores; avisa de lo que falta', () => {
    const v = validarObra(st());
    expect(v.ok).toBe(true);
    expect(v.errores).toEqual([]);
    expect(v.avisos.map((a) => [a.codigo, a.ref])).toEqual([
      ['partida/sin-precio', '2.1'],
      ['partida/sin-cantidad', '2.1'],
    ]);
  });

  it('partidas distintas con el mismo código: aviso; la misma partida en dos sitios, no', () => {
    lote([{ op: 'duplicar_partida', ref: '1.1.1' }]);
    expect(validarObra(st()).cuantos['partida/codigo-repetido']).toBeUndefined();
    lote([{ op: 'set_precio', ref: '1.1.2', valor: 20 }]);
    expect(
      validarObra(st()).avisos.find((a) => a.codigo === 'partida/codigo-repetido')?.mensaje,
    ).toContain('ADE010.2');
  });

  it('lo que deja la obra incoherente es un error', () => {
    const p = st().partidas[st().chapters[1]!.id]![0]!;
    useObraStore.setState((s) => ({ partidas: { ...s.partidas, huerfano: [{ ...p, id: 'x' }] } }));
    useObraStore.setState((s) => {
      const ch2 = s.chapters[1]!.id;
      return {
        partidas: {
          ...s.partidas,
          [ch2]: [{ ...p, sub: 'no-existe', items: [{ code: 'MO001', type: 'MO', cantidad: 1 }] }],
        },
      };
    });
    const v = validarObra(st());
    expect(v.ok).toBe(false);
    expect(v.errores.map((e) => e.codigo).sort()).toEqual([
      'partida/recurso-inexistente',
      'partida/sub-inexistente',
      'partidas/capitulo-inexistente',
    ]);
  });
});

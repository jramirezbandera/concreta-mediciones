/* Validación estricta del catálogo del agente: una op mal escrita rechaza el lote. */
import { describe, expect, it } from 'vitest';
import { leerOperaciones } from './operaciones';

describe('leerOperaciones', () => {
  it('acepta un lote bien escrito y quita los opcionales que no vienen', () => {
    const r = leerOperaciones([
      {
        op: 'crear_partida',
        capitulo: '1',
        titulo: 'Excavación',
        ud: 'm³',
        lineas: [{ comentario: 'A', uds: 2 }],
      },
      { op: 'set_porcentajes', gg: 13 },
    ]);
    expect(r).toEqual({
      ok: true,
      ops: [
        {
          op: 'crear_partida',
          capitulo: '1',
          titulo: 'Excavación',
          ud: 'm³',
          lineas: [{ comentario: 'A', uds: 2 }],
        },
        { op: 'set_porcentajes', gg: 13 },
      ],
    });
  });

  it('una sola op mal escrita rechaza el lote entero, con todas las que fallan', () => {
    const r = leerOperaciones([
      { op: 'crear_capitulo', titulo: 'Bien' },
      { op: 'crear_capitulo', titlo: 'Mal' },
      { op: 'inventada' },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores.map((e) => e.indice)).toEqual([1, 2]);
    expect(r.errores[0]!.mensaje).toContain('«titlo» no es un campo de crear_capitulo');
    expect(r.errores[1]!.mensaje).toContain('no es una operación conocida');
  });

  it.each([
    [{ op: 'crear_partida', capitulo: '1', titulo: 'X', ud: 'm', precio: -1 }, 'negativo'],
    [{ op: 'crear_partida', titulo: 'X', ud: 'm' }, 'falta «capitulo»'],
    [{ op: 'agregar_lineas', ref: '1.1', lineas: [] }, 'no vacía'],
    [
      { op: 'agregar_lineas', ref: '1.1', lineas: [{ largo: '3' }] },
      '«largo» tiene que ser un número',
    ],
    [
      { op: 'agregar_lineas', ref: '1.1', lineas: [{ comment: 'A' }] },
      'campo que no existe: «comment»',
    ],
    [{ op: 'editar_linea', ref: '1.1', indice: 0, campo: 'uds', valor: 2 }, 'entero desde 1'],
    [{ op: 'borrar_lineas', ref: '1.1', indices: [2, 2] }, 'repetidos'],
    [{ op: 'set_porcentajes' }, 'al menos uno'],
    [{ op: 'set_porcentajes', gg: 0.13 * 1000 }, 'entre 0 y 100'],
    [{ op: 'set_coef_k', valor: 0 }, 'mayor que 0'],
    [{ op: 'editar_obra', campo: 'precio', valor: 'x' }, '«campo» tiene que ser uno de'],
    [{ op: 'certificar_100', ambito: 'visible' }, '«ambito» tiene que ser uno de'],
    [{ op: 'certificar_100', ambito: 'capitulo' }, 'falta «ref»'],
  ])('%j → %s', (op, mensaje) => {
    const r = leerOperaciones([op]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores[0]!.mensaje).toContain(mensaje);
  });

  it('no es una lista, o está vacía', () => {
    expect(leerOperaciones({ op: 'crear_capitulo' }).ok).toBe(false);
    expect(leerOperaciones([]).ok).toBe(false);
  });
});

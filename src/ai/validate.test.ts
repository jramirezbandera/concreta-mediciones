import { describe, expect, it } from 'vitest';
import { AiError } from './types';
import { parseChatEnvelope } from './validate';

describe('parseChatEnvelope (F-A3, con ops)', () => {
  it('ops null → turno de consulta, sin descartes', () => {
    const env = parseChatEnvelope({ reply: 'Hola', ops: null });
    expect(env).toEqual({ reply: 'Hola', ops: null, discarded: [] });
  });

  it('narrowea una op válida (crear_partida con líneas)', () => {
    const env = parseChatEnvelope({
      reply: 'Hecho',
      ops: [
        {
          op: 'crear_partida',
          capitulo: '1',
          titulo: 'Excavación',
          ud: 'm³',
          precio: 12.5,
          lineas: [{ uds: 3, largo: 2, ancho: 1.5, alto: null, comentario: 'zapatas' }],
        },
      ],
    });
    expect(env.ops).toHaveLength(1);
    expect(env.ops![0]).toEqual({
      op: 'crear_partida',
      capitulo: '1',
      titulo: 'Excavación',
      ud: 'm³',
      precio: 12.5,
      lineas: [{ comentario: 'zapatas', uds: 3, largo: 2, ancho: 1.5 }], // alto null se cae (=1)
    });
    expect(env.discarded).toHaveLength(0);
  });

  it('op desconocida → descartada con motivo', () => {
    const env = parseChatEnvelope({ reply: 'x', ops: [{ op: 'formatear_disco' }] });
    expect(env.ops).toEqual([]);
    expect(env.discarded).toEqual([{ op: 'formatear_disco', reason: 'tipo de operación desconocido' }]);
  });

  it('faltan campos obligatorios → descartada con motivo, sin frenar a las buenas', () => {
    const env = parseChatEnvelope({
      reply: 'x',
      ops: [
        { op: 'crear_partida', titulo: 'Sin unidad' }, // falta ud
        { op: 'set_precio', ref: '1.1', valor: 20 }, // válida
        { op: 'editar_partida', ref: '1.1', campo: 'inventado', valor: 'X' }, // campo inválido
      ],
    });
    expect(env.ops).toHaveLength(1);
    expect(env.ops![0]).toMatchObject({ op: 'set_precio', ref: '1.1', valor: 20 });
    expect(env.discarded.map((d) => d.op)).toEqual(['crear_partida', 'editar_partida']);
  });

  it('set_precio con valor negativo → descartada', () => {
    const env = parseChatEnvelope({ reply: 'x', ops: [{ op: 'set_precio', ref: '1.1', valor: -5 }] });
    expect(env.ops).toEqual([]);
    expect(env.discarded).toHaveLength(1);
  });

  it('editar_linea de dimensión coerciona a número; comentario exige string', () => {
    const env = parseChatEnvelope({
      reply: 'x',
      ops: [
        { op: 'editar_linea', ref: '1.1', indice: 2, campo: 'ancho', valor: 3.2 },
        { op: 'editar_linea', ref: '1.1', indice: 1, campo: 'comentario', valor: 'muro norte' },
      ],
    });
    expect(env.ops).toHaveLength(2);
    expect(env.ops![0]).toEqual({ op: 'editar_linea', ref: '1.1', indice: 2, campo: 'ancho', valor: 3.2 });
    expect(env.ops![1]).toEqual({ op: 'editar_linea', ref: '1.1', indice: 1, campo: 'comentario', valor: 'muro norte' });
  });

  it('agregar_lineas sin líneas útiles → descartada', () => {
    const env = parseChatEnvelope({ reply: 'x', ops: [{ op: 'agregar_lineas', ref: '1.1', lineas: [] }] });
    expect(env.ops).toEqual([]);
    expect(env.discarded).toHaveLength(1);
  });

  it('narrowea las ops de certificación (F-A4)', () => {
    const env = parseChatEnvelope({
      reply: 'ok',
      ops: [
        { op: 'certificar', ref: '1.1', valor: 6, modo: 'origen' },
        { op: 'certificar_100', ambito: 'capitulo', ref: '2' },
        { op: 'certificar_100', ambito: 'obra' },
        { op: 'crear_certificacion', periodo: 'junio 2026' },
      ],
    });
    expect(env.ops).toEqual([
      { op: 'certificar', ref: '1.1', valor: 6, modo: 'origen' },
      { op: 'certificar_100', ambito: 'capitulo', ref: '2' },
      { op: 'certificar_100', ambito: 'obra' },
      { op: 'crear_certificacion', periodo: 'junio 2026' },
    ]);
  });

  it('certificar con modo inválido y certificar_100 con ámbito inválido → descartadas', () => {
    const env = parseChatEnvelope({
      reply: 'x',
      ops: [
        { op: 'certificar', ref: '1.1', valor: 6, modo: 'total' },
        { op: 'certificar_100', ambito: 'todo' },
      ],
    });
    expect(env.ops).toEqual([]);
    expect(env.discarded).toHaveLength(2);
  });

  it('certificar admite valor negativo (certificar menos en «esta»)', () => {
    const env = parseChatEnvelope({ reply: 'x', ops: [{ op: 'certificar', ref: '1.1', valor: -2, modo: 'esta' }] });
    expect(env.ops).toEqual([{ op: 'certificar', ref: '1.1', valor: -2, modo: 'esta' }]);
  });

  it('`ops` no-array → se ignora con motivo, no muta nada', () => {
    const env = parseChatEnvelope({ reply: 'x', ops: 'crear todo' });
    expect(env.ops).toBeNull();
    expect(env.discarded).toHaveLength(1);
  });

  it('reply ausente o vacío → bad-response', () => {
    for (const raw of [{ ops: null }, { reply: '', ops: null }, { reply: '   ' }]) {
      expect(() => parseChatEnvelope(raw)).toThrow(AiError);
    }
  });

  it('no-objeto → bad-response', () => {
    expect(() => parseChatEnvelope(null)).toThrow(AiError);
    expect(() => parseChatEnvelope('texto')).toThrow(AiError);
    expect(() => parseChatEnvelope(42)).toThrow(AiError);
  });
});

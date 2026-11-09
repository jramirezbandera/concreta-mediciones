/* Motor del agente: cada operación sobre el store de verdad (las mismas acciones
   que la interfaz), el lote todo o nada y las guardas de lo certificado. */
import { beforeEach, describe, expect, it } from 'vitest';
import { partidaCantidad, partidaImporte } from '../core/medicion';
import { findPartidaById } from '../core/tree';
import { blankObraData, useObraStore } from '../store';
import { aplicarLote } from './motor';
import { leerOperaciones, type OperacionAgente } from './operaciones';

const st = () => useObraStore.getState();

/** Aplica un lote ya escrito como lo mandaría el agente (pasando por la validación). */
function lote(raw: unknown[]) {
  const l = leerOperaciones(raw);
  if (!l.ok) throw new Error(JSON.stringify(l.errores));
  return aplicarLote(useObraStore, l.ops);
}

const partida = (pos: string) => {
  for (const ch of st().chapters) {
    const p = st().partidas[ch.id]?.find((x) => x.pos === pos);
    if (p) return p;
  }
  throw new Error(`no hay partida ${pos}`);
};

/** Obra con dos capítulos, un subcapítulo y dos partidas medidas. */
function obraBase() {
  st().loadObra(blankObraData('Prueba'));
  const r = lote([
    { op: 'crear_capitulo', titulo: 'Movimiento de tierras' },
    { op: 'crear_capitulo', titulo: 'Cimentación' },
    { op: 'crear_subcapitulo', padre: '1', titulo: 'Excavaciones' },
    {
      op: 'crear_partida',
      capitulo: '1.1',
      codigo: 'ADE010',
      titulo: 'Excavación en zanjas',
      ud: 'm³',
      precio: 18.5,
      lineas: [
        { comentario: 'Zanja eje A', uds: 1, largo: 12, ancho: 0.6, alto: 0.8 },
        { comentario: 'Zanja eje B', uds: 2, largo: 8, ancho: 0.6, alto: 0.8 },
      ],
    },
    {
      op: 'crear_partida',
      capitulo: 'Cimentación',
      titulo: 'Hormigón de limpieza',
      ud: 'm²',
      precio: 9,
    },
  ]);
  expect(r.ok).toBe(true);
  return r;
}

beforeEach(() => {
  obraBase();
});

describe('crear', () => {
  it('cada recibo dice lo que creó, con su id y su número en el árbol', () => {
    const r = obraBase();
    expect(r.recibos.map((x) => [x.op, x.ref])).toEqual([
      ['crear_capitulo', '1'],
      ['crear_capitulo', '2'],
      ['crear_subcapitulo', '1.1'],
      ['crear_partida', '1.1.1'],
      ['crear_partida', '2.1'],
    ]);
    expect(r.recibos.every((x) => x.id)).toBe(true);
  });

  it('la partida queda con su medición, su precio y su importe, como en la app', () => {
    const p = partida('1.1.1');
    expect(p.code).toBe('ADE010');
    expect(p.med).toHaveLength(2);
    expect(partidaCantidad(p)).toBe(13.44); // 12·0,6·0,8 + 2·8·0,6·0,8
    expect(partidaImporte(p)).toBe(24864); // 13,44 × 18,50 € = 248,64 €
  });

  it('una partida sin código dictado lleva uno libre, no inventado', () => {
    expect(partida('2.1').code).toMatch(/^P\d{3}$/);
  });
});

describe('el lote, todo o nada', () => {
  it('para en la primera op que no se aplica y dice cuántas quedaron sin intentar', () => {
    const r = lote([
      { op: 'crear_capitulo', titulo: 'Estructura' },
      { op: 'agregar_lineas', ref: '9.9', lineas: [{ uds: 1 }] },
      { op: 'crear_capitulo', titulo: 'Cubiertas' },
    ]);
    expect(r.ok).toBe(false);
    expect(r.recibos).toHaveLength(2);
    expect(r.recibos[1]).toMatchObject({
      status: 'no-encontrada',
      op: 'agregar_lineas',
      indice: 1,
    });
    expect(r.sinIntentar).toBe(1);
  });

  it('las ops de un lote van en orden: la segunda ve lo que creó la primera', () => {
    const r = lote([
      { op: 'crear_partida', capitulo: '2', titulo: 'Zapatas', ud: 'm³', precio: 120 },
      {
        op: 'agregar_lineas',
        ref: '2.2',
        lineas: [{ comentario: 'Z1', uds: 4, largo: 1.2, ancho: 1.2, alto: 0.5 }],
      },
    ]);
    expect(r.ok).toBe(true);
    expect(partidaCantidad(partida('2.2'))).toBe(2.88);
  });
});

describe('líneas', () => {
  it('editar_linea y borrar_lineas por su número en la partida', () => {
    const r = lote([
      { op: 'editar_linea', ref: '1.1.1', indice: 2, campo: 'uds', valor: 3 },
      {
        op: 'agregar_lineas',
        ref: '1.1.1',
        lineas: [{ comentario: 'Pozo', uds: 1, largo: 1, ancho: 1, alto: 1 }],
      },
      { op: 'borrar_lineas', ref: '1.1.1', indices: [1, 3] },
    ]);
    expect(r.ok).toBe(true);
    const p = partida('1.1.1');
    expect(p.med.map((l) => [l.comment, l.uds])).toEqual([['Zanja eje B', 3]]);
  });

  it('una línea que no existe para el lote con el motivo', () => {
    const r = lote([{ op: 'borrar_lineas', ref: '1.1.1', indices: [2, 5] }]);
    expect(r.ok).toBe(false);
    expect(r.recibos[0]!.reason).toContain('no existe la 5');
    expect(partida('1.1.1').med).toHaveLength(2);
  });

  it('set_cantidad con medición no cambia nada y lo explica', () => {
    const r = lote([{ op: 'set_cantidad', ref: '1.1.1', valor: 50 }]);
    expect(r.ok).toBe(false);
    expect(r.recibos[0]!.reason).toContain('sale de las líneas');
  });
});

describe('estructura', () => {
  it('mover, duplicar y renombrar', () => {
    const r = lote([
      { op: 'mover_partida', ref: '2.1', destino: '1' },
      { op: 'duplicar_partida', ref: '1.1.1' },
      { op: 'renombrar', ref: '1.1', titulo: 'Excavaciones y rellenos' },
    ]);
    expect(r.ok).toBe(true);
    expect(r.recibos.map((x) => x.ref)).toEqual(['1.1', '1.1.2', '1.1']);
    expect(st().partidas[st().chapters[1]!.id]).toEqual([]);
  });

  it('borrar_contenedor solo vacío', () => {
    const lleno = lote([{ op: 'borrar_contenedor', ref: '2' }]);
    expect(lleno.ok).toBe(false);
    expect(lleno.recibos[0]!.reason).toContain('tiene 1 partida');
    const r = lote([
      { op: 'borrar_partida', ref: '2.1' },
      { op: 'borrar_contenedor', ref: 'Cimentación' },
    ]);
    expect(r.ok).toBe(true);
    expect(st().chapters.map((c) => c.title)).toEqual(['Movimiento de tierras']);
  });
});

describe('lo certificado', () => {
  beforeEach(() => {
    const r = lote([
      { op: 'crear_certificacion', periodo: 'octubre 2026' },
      { op: 'certificar', ref: '1.1.1', valor: 5, modo: 'origen' },
    ]);
    expect(r.ok).toBe(true);
  });

  it('certificar deja la cantidad a origen y lo dice en el recibo', () => {
    const p = partida('1.1.1');
    expect(st().certs.at(-1)!.data[p.id]).toBe(5);
  });

  it('no se toca la medición de una partida certificada sin forzar', () => {
    const sin = lote([{ op: 'agregar_lineas', ref: '1.1.1', lineas: [{ uds: 1 }] }]);
    expect(sin.ok).toBe(false);
    expect(sin.recibos[0]!.reason).toContain('certificada');
    expect(partida('1.1.1').med).toHaveLength(2);
    expect(
      lote([{ op: 'agregar_lineas', ref: '1.1.1', lineas: [{ uds: 1 }], forzar: true }]).ok,
    ).toBe(true);
  });

  it('borrar una partida certificada con forzar deja su rastro en las bajas', () => {
    const id = partida('1.1.1').id;
    expect(lote([{ op: 'borrar_partida', ref: '1.1.1' }]).ok).toBe(false);
    expect(lote([{ op: 'borrar_partida', ref: '1.1.1', forzar: true }]).ok).toBe(true);
    expect(findPartidaById(st().partidas, id)).toBeNull();
    expect(st().bajas[id]).toBeDefined();
  });

  it('una certificación emitida no se cambia', () => {
    useObraStore.setState((s) => ({
      certs: s.certs.map((c) => ({ ...c, emitidaAt: '2026-11-01' })),
    }));
    const r = lote([{ op: 'certificar', ref: '2.1', valor: 1, modo: 'origen' }]);
    expect(r.ok).toBe(false);
    expect(r.recibos[0]!.reason).toContain('emitida');
  });
});

describe('económico y ficha', () => {
  it('porcentajes en %, K y la ficha', () => {
    const ops: OperacionAgente[] = [
      { op: 'set_porcentajes', gg: 13, bi: 6, iva: 21 },
      { op: 'set_coef_k', valor: 0.95 },
      { op: 'editar_obra', campo: 'denominacion', valor: 'Vivienda en calle Mayor 12' },
      { op: 'editar_obra', campo: 'promotor.nombre', valor: 'Promociones Sur SL' },
      { op: 'editar_obra', campo: 'superficieConstruida', valor: 184.5 },
    ];
    expect(aplicarLote(useObraStore, ops).ok).toBe(true);
    expect(st().rates).toMatchObject({ gg: 0.13, bi: 0.06, iva: 0.21, coefK: 0.95 });
    expect(st().obra.denominacion).toBe('Vivienda en calle Mayor 12');
    expect((st().obra.promotor as { nombre: string }).nombre).toBe('Promociones Sur SL');
    expect(st().obra.superficieConstruida).toBe(184.5);
  });
});

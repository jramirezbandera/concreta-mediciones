import { describe, expect, it } from 'vitest';
import type { Partida, PartidasMap } from '../types';
import { ESQUEMA_IA, LOTE_IA, SISTEMA_IA, leerRespuestaIa, mensajeIa, partidasParaIa, propuestasIa } from './ia';
import { PLANTILLAS_IA } from './reglas';

const partida = (id: string, title: string, ud: string, extra: Partial<Partida> = {}): Partida => ({
  id,
  pos: id,
  code: `C${id}`,
  title,
  ud,
  precio: 1,
  desc: '',
  med: [],
  items: [],
  ...extra,
});

const partidas: PartidasMap = {
  a: [
    partida('p1', 'Retirada de falso techo continuo', 'm²'),
    partida('p2', 'Hormigón HA-25 en zapatas', 'm³'),
    partida('p3', 'Rebaje de terreno', 'm³'),
    partida('p4', 'Ya asignada', 'm²', { rcd: { estado: 'confirmada', origen: { tipo: 'manual', motivo: 'x' }, componentes: [] } }),
  ],
};
const preguntadas = partidasParaIa(partidas);

describe('partidasParaIa', () => {
  it('solo las que no tienen residuo, con la descripción recortada', () => {
    expect(preguntadas.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    const larga = partidasParaIa({ a: [partida('x', 't', 'ud', { desc: 'a'.repeat(1000) })] })[0]!;
    expect(larga.desc.length).toBeLessThan(260);
    expect(LOTE_IA).toBeGreaterThan(10);
  });
});

describe('prompt y esquema', () => {
  it('la lista cerrada de plantillas va en el esquema y en las instrucciones', () => {
    const enumPlantilla = ((ESQUEMA_IA.properties as Record<string, { items: { properties: { plantilla: { enum: string[] } } } }>)
      .partidas!.items.properties.plantilla.enum);
    expect(enumPlantilla).toEqual([...PLANTILLAS_IA.map((x) => x.id), 'ninguna']);
    for (const x of PLANTILLAS_IA) expect(SISTEMA_IA).toContain(`- ${x.id}:`);
    expect(mensajeIa(preguntadas)).toContain('"id":"p1"');
  });
});

describe('leerRespuestaIa', () => {
  it('se queda con lo válido de lo preguntado y descarta lo demás', () => {
    const raw = {
      partidas: [
        { id: 'p1', decision: 'plantilla', plantilla: 'yeso', motivo: 'Falso techo de escayola' },
        { id: 'p1', decision: 'noGenera', plantilla: 'ninguna', motivo: 'repetida' },
        { id: 'p2', decision: 'noGenera', plantilla: 'ninguna', motivo: 'Obra nueva' },
        { id: 'p3', decision: 'plantilla', plantilla: 'inventada', motivo: '' },
        { id: 'otra', decision: 'noGenera', plantilla: 'ninguna', motivo: '' },
        { id: 'p3', decision: 'noSe', plantilla: 'ninguna', motivo: '' },
        'basura',
      ],
    };
    expect(leerRespuestaIa(raw, preguntadas)).toEqual([
      { id: 'p1', decision: 'plantilla', plantilla: 'yeso', motivo: 'Falso techo de escayola' },
      { id: 'p2', decision: 'noGenera', plantilla: null, motivo: 'Obra nueva' },
      { id: 'p3', decision: 'noSe', plantilla: null, motivo: 'Sugerido por la IA' },
    ]);
    expect(leerRespuestaIa({ nada: 1 }, preguntadas)).toEqual([]);
    expect(leerRespuestaIa(null, preguntadas)).toEqual([]);
  });
});

describe('propuestasIa', () => {
  it('la plantilla pone el código, la densidad y la conversión; la IA solo el motivo', () => {
    const m = propuestasIa(
      [
        { id: 'p1', decision: 'plantilla', plantilla: 'yeso', motivo: 'Falso techo de escayola' },
        { id: 'p2', decision: 'noGenera', plantilla: null, motivo: 'Obra nueva' },
        { id: 'p3', decision: 'plantilla', plantilla: 'excavacion', motivo: 'Rebaje' },
        { id: 'p4', decision: 'noGenera', plantilla: null, motivo: 'ya asignada: no se toca' },
      ],
      partidas,
      'gemini-x',
    );
    expect([...m.keys()]).toEqual(['p1', 'p2', 'p3']);
    const p1 = m.get('p1')!;
    expect(p1.estado).toBe('propuesta');
    expect(p1.origen).toEqual({ tipo: 'ia', ref: 'gemini-x', motivo: 'Falso techo de escayola' });
    expect(p1.componentes.map((c) => [c.ler, c.tipo, c.conversion.modo])).toEqual([['17 08 02', 'demolicion', 'espesor']]);
    expect(m.get('p2')!.componentes).toEqual([]);
    expect(m.get('p3')!.componentes.map((c) => [c.ler, c.tipo, c.conversion.modo])).toEqual([['17 05 04', 'excavacion', 'volumen']]);
  });

  it('«no lo sé» deja la partida sin asignar', () => {
    expect(propuestasIa([{ id: 'p1', decision: 'noSe', plantilla: null, motivo: '' }], partidas, 'm').size).toBe(0);
  });
});

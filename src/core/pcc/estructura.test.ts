import { describe, expect, it } from 'vitest';
import { calcularEstructura, fcd, serieDe, type EntradaEstructura, type PartidaEstructura } from './estructura';
import { leerDesignacion } from './hormigon';
import type { AceroPartida, DatosGrupo, FilaLote, HormigonPartida, PlanCalidadDatos } from './tipos';

/* Motor de estructura (docs/plan-control-calidad.md §5): los 16 casos de B «Para la app» A6
   (docs/research/control-calidad/B-codigo-estructural.md), uno por uno, y lo que pide la
   sección «Tests» del plan para la estructura. HA-25 salvo que se diga otra cosa. */

let n = 0;
function hormigon(
  fila: FilaLote,
  m3: number,
  designacion = 'HA-25/B/20/XC1',
  extra: Partial<HormigonPartida> & { ud?: string } = {},
): PartidaEstructura {
  const { ud = 'm3', ...h } = extra;
  n += 1;
  return {
    id: `p${n}`,
    code: `H${n}`,
    title: `Hormigón ${designacion}`,
    ud,
    cantidad: m3,
    control: {
      estado: 'confirmada',
      origen: { tipo: 'manual', motivo: 'test' },
      hormigon: { designacion: leerDesignacion(designacion)!.designacion, fila, ...h },
    },
  };
}
function acero(kg: number, a: AceroPartida, ud = 'kg'): PartidaEstructura {
  n += 1;
  return {
    id: `a${n}`,
    code: `A${n}`,
    title: 'Acero B 500 S',
    ud,
    cantidad: kg,
    control: { estado: 'confirmada', origen: { tipo: 'manual', motivo: 'test' }, acero: a },
  };
}
const clave = (p: PartidaEstructura) =>
  `${p.control.hormigon!.fila}|${p.control.hormigon!.dosificacion ?? p.control.hormigon!.designacion.texto}`;
/** Plan con los datos de cada grupo, por su partida. */
function plan(grupos: Array<[PartidaEstructura, DatosGrupo]>, resto: Partial<PlanCalidadDatos> = {}): PlanCalidadDatos {
  return { version: 1, grupos: Object.fromEntries(grupos.map(([p, g]) => [clave(p), g])), ...resto };
}
const calc = (partidas: PartidaEstructura[], p: PlanCalidadDatos = { version: 1 }, obra?: EntradaEstructura['obra']) =>
  calcularEstructura({ partidas, plan: p, obra });
/** Obra A: 300 m² construidos y 2 plantas (de la ficha, TD2). */
const OBRA_300_2 = { superficie: 300, plantas: 2 };
const DCOR: Partial<PlanCalidadDatos> = { hormigon: { distintivo: 'con' } };

describe('A6: lotes y amasadas (tabla 57.5.4.1)', () => {
  it('E1: forjado de 1 planta, 450 m², 60 m³ → 1 lote × 3', () => {
    const f = hormigon('flexion', 60);
    const g = calc([f], plan([[f, { superficie: 450, plantas: 1 }]])).grupos[0]!;
    expect(g).toMatchObject({ lotes: 1, n: 3, amasadas: 3 });
    expect(g.ensayos).toEqual({ resistencia: 3, consistencia: 3, escurrimiento: 0, anilloJapones: 0, probetas: 12 });
  });

  it('E2: forjados de 3 plantas, 1350 m², 180 m³ → 2 × 3', () => {
    const f = hormigon('flexion', 180);
    expect(calc([f], plan([[f, { superficie: 1350, plantas: 3 }]])).grupos[0]).toMatchObject({ lotes: 2, amasadas: 6 });
  });

  it('E3: forjados de 3 plantas, 900 m², 90 m³ → 2 × 3 (la hoja da 1, no aplica las 2 plantas)', () => {
    const f = hormigon('flexion', 90);
    const g = calc([f], plan([[f, { superficie: 900, plantas: 3 }]])).grupos[0]!;
    expect(g).toMatchObject({ lotes: 2, amasadas: 6 });
    expect(g.cuenta).toBe(
      'Elementos a flexión HA-25/B/20/XC1: max(90,00 m³ / 100 → 1; 900 m² / 1.000 → 1; 3 plantas / 2 → 2) = 2 lotes (tabla 57.5.4.1) × 3 amasadas = 6 tomas',
    );
  });

  it('E4: pilares de 3 plantas, 12 m³, 450 m² → 2 × 3', () => {
    const p = hormigon('pilares_muros', 12);
    expect(calc([p], plan([[p, { superficie: 450, plantas: 3 }]])).grupos[0]).toMatchObject({ lotes: 2, amasadas: 6 });
  });

  it('E5: E4 con cubas de 6 m³ → 2 × 2, como interpretación', () => {
    const p = hormigon('pilares_muros', 12);
    const g = calc([p], plan([[p, { superficie: 450, plantas: 3 }]], { hormigon: { cubaM3: 6 } })).grupos[0]!;
    expect(g).toMatchObject({ lotes: 2, n: 2, amasadas: 4 });
    expect(g.notas.join(' ')).toMatch(/INTERPRETACIÓN/);
  });

  it('E6: zapatas, 40 m³ en ≤ 1 semana → 1 × 3', () => {
    const z = hormigon('cim_superficial', 40, 'HA-25/B/20/XC2');
    expect(calc([z], plan([[z, { semanas: 1 }]])).grupos[0]).toMatchObject({ lotes: 1, amasadas: 3 });
  });

  it('E7: E6 en 2 semanas → 2 × 3 (la hoja no aplica el tiempo)', () => {
    const z = hormigon('cim_superficial', 40, 'HA-25/B/20/XC2');
    expect(calc([z], plan([[z, { semanas: 2 }]])).grupos[0]).toMatchObject({ lotes: 2, amasadas: 6 });
  });

  it('E8: losa de cimentación de 260 m³ en un elemento → 1 lote × 8; con distintivo, × 3', () => {
    const l = () => hormigon('cim_superficial', 260, 'HA-25/B/20/XC2', { elementoMayorM3: 260 });
    expect(calc([l()]).grupos[0]).toMatchObject({ fila: 'cim_mayor_200', lotes: 1, n: 8, amasadas: 8 });
    expect(calc([l()], { version: 1, ...DCOR }).grupos[0]).toMatchObject({ lotes: 1, n: 3, amasadas: 3 });
  });

  it('E9: E2 + E4 + E6 con distintivo → 3 lotes × 1 (el mínimo de 3)', () => {
    const f = hormigon('flexion', 180);
    const p = hormigon('pilares_muros', 12);
    const z = hormigon('cim_superficial', 40, 'HA-25/B/20/XC2');
    const r = calc(
      [f, p, z],
      plan([[f, { superficie: 1350, plantas: 3 }], [p, { superficie: 450, plantas: 3 }], [z, { semanas: 1 }]], DCOR),
    );
    expect(r.grupos.map((g) => [g.fila, g.lotes, g.n])).toEqual([
      ['flexion', 1, 1],
      ['pilares_muros', 1, 1],
      ['cim_superficial', 1, 1],
    ]);
    expect(r.totales).toMatchObject({ lotes: 3, amasadas: 3 });
    expect(r.grupos[0]!.notas.join(' ')).toMatch(/× 5 .*también plantas y semanas/);
  });

  it('E10: E1 con fck = 50 → 1 × 6', () => {
    const f = hormigon('flexion', 60, 'HA-50/F/20/XC1');
    expect(calc([f], plan([[f, { superficie: 450, plantas: 1 }]])).grupos[0]).toMatchObject({ lotes: 1, amasadas: 6 });
  });

  it('E11: el control indirecto no se ofrece; con un HA-25, fcd = 16,7 > 15', () => {
    const r = calc([hormigon('flexion', 60)]);
    expect(r.indirecto.ofrecido).toBe(false);
    expect(r.indirecto.motivo).toMatch(/HA-25\/B\/20\/XC1 da fcd = 16,7 N\/mm² > 15/);
    expect(fcd(25)).toBeCloseTo(16.67, 2);
    expect(fcd(20)).toBeCloseTo(13.33, 2);
    expect(calc([hormigon('cim_superficial', 4, 'HM-20/B/20/X0')]).indirecto.motivo).toMatch(/no se ofrece en esta versión/);
  });
});

describe('A6: durabilidad (57.5.7)', () => {
  it('D1: XS1, 1 dosificación, sin distintivo, 4 meses → 1 penetración', () => {
    const m = hormigon('pilares_muros', 18, 'HA-30/B/20/XS1');
    const r = calc([m], { version: 1, dosificaciones: { 'HA-30/B/20/XS1': { meses: 4 } } });
    expect(r.durabilidad).toEqual([expect.objectContaining({ dosificacion: 'HA-30/B/20/XS1', penetracion: 1, aireOcluido: 0 })]);
    expect(r.pendientes).toEqual([]);
  });

  it('D2: ídem, 8 meses → 2', () => {
    const m = hormigon('pilares_muros', 18, 'HA-30/B/20/XS1');
    const r = calc([m], { version: 1, dosificaciones: { 'HA-30/B/20/XS1': { meses: 8 } } });
    expect(r.durabilidad[0]!.penetracion).toBe(2);
    // 6 meses justos: el inicial y ninguno más
    expect(calc([m], { version: 1, dosificaciones: { 'HA-30/B/20/XS1': { meses: 6 } } }).durabilidad[0]!.penetracion).toBe(1);
  });
});

describe('A6: armaduras (arts. 58 y 59)', () => {
  it('F1: ferralla de taller, 9 t, enderezado, sin soldadura, Ø8/10/12/16 → 4 tracciones + 8 geometrías + 15 unidades', () => {
    const r = calc([acero(9000, { tipo: 'ferralla', diametros: [8, 10, 12, 16] })], {
      version: 1,
      acero: { procedencia: 'taller', enderezado: true, soldadura: 'no' },
    });
    expect(r.armaduras).toEqual([
      expect.objectContaining({ control: 'ferralla', lotes: 1, ensayos: { traccion: 4, geometria: 8, dimensiones: 15 } }),
    ]);
  });

  it('B1: barras elaboradas en obra, 9 t, series fina y media → 2 lotes: 4 de cada', () => {
    const r = calc([acero(9000, { tipo: 'barras', diametros: [8, 10, 12, 16] })], {
      version: 1,
      acero: { procedencia: 'obra' },
    });
    expect(r.armaduras).toEqual([
      expect.objectContaining({ control: 'barras', lotes: 2, ensayos: { traccion: 4, doblado: 4, masaMetro: 4, geometria: 4 } }),
    ]);
  });
});

describe('A6: lotes de ejecución (tabla 63.1)', () => {
  it('X1: 3 plantas × 150 m², 12 zapatas → 2 + 2 + 2', () => {
    const z = hormigon('cim_superficial', 30, 'HA-25/B/20/XC2');
    const f = hormigon('flexion', 60);
    const p = hormigon('pilares_muros', 10);
    const r = calc(
      [z, f, p],
      plan([[z, { superficie: 150, elementos: 12 }]]),
      { superficie: 450, plantas: 3 },
    );
    expect(r.ejecucion.lotes.map((l) => [l.fila, l.lotes])).toEqual([
      ['cimentacion', 2],
      ['flexion', 2],
      ['pilares_muros', 2],
    ]);
    expect(r.ejecucion.nivel).toBe('normal');
  });
});

describe('grupos, datos y pendientes', () => {
  it('XC1 y XC2 van en grupos distintos por defecto y juntos con la misma dosificación', () => {
    const a = hormigon('flexion', 30, 'HA-25/B/20/XC1');
    const b = hormigon('flexion', 30, 'HA-25/B/20/XC2');
    expect(calc([a, b]).grupos).toHaveLength(2);
    const c = hormigon('flexion', 30, 'HA-25/B/20/XC1', { dosificacion: 'central-1' });
    const d = hormigon('flexion', 30, 'HA-25/B/20/XC2', { dosificacion: 'central-1' });
    const r = calc([c, d]);
    expect(r.grupos).toHaveLength(1);
    expect(r.grupos[0]).toMatchObject({ clave: 'flexion|central-1', volumen: 60 });
  });

  it('un HA-25 de cimentación y uno de forjados no comparten lote', () => {
    expect(calc([hormigon('cim_superficial', 20), hormigon('flexion', 20)]).grupos).toHaveLength(2);
  });

  it('redondea hacia arriba al final y nunca da un ensayo fraccionario (K-PCC.57)', () => {
    const f = hormigon('flexion', 100.0001);
    const r = calc([f], plan([[f, { superficie: 1000, plantas: 2 }]]));
    expect(r.grupos[0]!.lotes).toBe(2);
    const exacto = hormigon('flexion', 0.1 + 0.2 + 99.7);
    expect(calc([exacto], plan([[exacto, { superficie: 1000, plantas: 2 }]])).grupos[0]!.lotes).toBe(1);
  });

  it('sin consistencia cuenta como convencional, con aviso (K-PCC.56)', () => {
    const r = calc([hormigon('flexion', 30, 'HA-25')]);
    expect(r.grupos[0]!.amasadas).toBeGreaterThan(0);
    expect(r.grupos[0]!.ensayos.consistencia).toBe(3);
    expect(r.avisos.map((a) => a.texto).join(' ')).toMatch(/se cuenta como hormigón convencional \(K-PCC\.56\)/);
  });

  it('autocompactante: escurrimiento por amasada y un anillo japonés cada 4', () => {
    const f = hormigon('flexion', 180, 'HA-30/AC/12/XC1');
    const g = calc([f], plan([[f, { superficie: 1350, plantas: 3 }]])).grupos[0]!;
    expect(g.ensayos).toEqual({ resistencia: 6, consistencia: 0, escurrimiento: 6, anilloJapones: 2, probetas: 24 });
  });

  it('forjado medido en m² sin m³ por m² → pendiente; con él, cuenta', () => {
    const sin = hormigon('flexion', 300, 'HA-25/B/20/XC1', { ud: 'm2' });
    const r = calc([sin]);
    expect(r.grupos).toEqual([]);
    expect(r.pendientes).toEqual([expect.objectContaining({ id: `m3PorUd:${sin.id}`, partidaId: sin.id })]);
    const con = hormigon('flexion', 300, 'HA-25/B/20/XC1', { ud: 'm²', m3PorUd: 0.15 });
    expect(calc([con]).grupos[0]).toMatchObject({ volumen: 45 });
    expect(calc([con]).grupos[0]!.partidas[0]!.formula).toBe('300 m² × 0,150 m³/m²');
  });

  it('sin fila de la tabla → pendiente y fuera de los lotes', () => {
    const p = hormigon('flexion', 10);
    delete p.control.hormigon!.fila;
    const r = calc([p]);
    expect(r.grupos).toEqual([]);
    expect(r.pendientes[0]!.texto).toMatch(/falta el tipo de elemento/);
  });

  it('la designación con clase no válida cuenta para los lotes y no da durabilidad (Q2)', () => {
    const p = hormigon('flexion', 3, 'HA-25/B/20/IIa');
    const r = calc([p]);
    expect(r.grupos[0]).toMatchObject({ volumen: 3, lotes: 1, amasadas: 3 });
    expect(r.durabilidad).toEqual([]);
    expect(r.avisos.some((a) => a.partidaId === p.id && /IIa/.test(a.texto))).toBe(true);
  });

  it('un tipo con dos clases se cuenta una vez (K-PCC.59)', () => {
    const m = hormigon('pilares_muros', 18, 'HA-30/B/20/XS1+XF2');
    const r = calc([m], { version: 1, dosificaciones: { 'HA-30/B/20/XS1+XF2': { meses: 4 } } });
    expect(r.durabilidad).toEqual([expect.objectContaining({ penetracion: 1, aireOcluido: 1, clases: ['XS1', 'XF2'] })]);
  });

  it('sin meses de suministro: el ensayo inicial y el dato pendiente', () => {
    const r = calc([hormigon('pilares_muros', 18, 'HA-30/B/20/XS1')]);
    expect(r.durabilidad[0]!.penetracion).toBe(1);
    expect(r.pendientes.map((p) => p.id)).toContain('meses:HA-30/B/20/XS1');
  });

  it('con distintivo no hay durabilidad, pero sí lotes (K-PCC.58)', () => {
    const ps = () => [hormigon('flexion', 180), hormigon('pilares_muros', 18, 'HA-30/B/20/XS1')];
    const sin = calc(ps());
    const con = calc(ps(), { version: 1, ...DCOR });
    expect(sin.durabilidad).toHaveLength(1);
    expect(con.durabilidad).toEqual([]);
    expect(con.totales.amasadas).toBeGreaterThan(0);
    expect(con.totales.amasadas).not.toBe(sin.totales.amasadas);
  });

  it('pilares de 3 plantas, 20 m³, 400 m² → 2 lotes (K-PCC.55)', () => {
    const p = hormigon('pilares_muros', 20);
    expect(calc([p], plan([[p, { superficie: 400, plantas: 3 }]])).grupos[0]!.lotes).toBe(2);
  });

  it('losa de 400 m³ en un elemento → N = 12; con distintivo, 4 (caso B)', () => {
    const l = () => hormigon('cim_superficial', 400, 'HA-30/B/20/XC2', { elementoMayorM3: 400 });
    expect(calc([l()]).grupos[0]).toMatchObject({ lotes: 1, amasadas: 12 });
    expect(calc([l()], { version: 1, ...DCOR }).grupos[0]).toMatchObject({ lotes: 1, amasadas: 4 });
  });

  it('cimentación de más de 200 m³ sin decir el mayor elemento: se supone < 200 m³, con aviso', () => {
    const z = hormigon('cim_superficial', 250, 'HA-25/B/20/XC2');
    const r = calc([z]);
    expect(r.grupos[0]!.fila).toBe('cim_superficial');
    expect(r.avisos.some((a) => a.id === `elementoMayor:${z.id}`)).toBe(true);
  });

  it('los datos de la obra prerrellenan los grupos y el del grupo manda (D7)', () => {
    const f = hormigon('flexion', 45);
    const p = hormigon('pilares_muros', 5);
    const r = calc([f, p], { version: 1 }, OBRA_300_2);
    expect(r.grupos.map((g) => [g.lotes, g.superficie, g.plantas])).toEqual([
      [1, { valor: 300, origen: 'obra' }, { valor: 2, origen: 'obra' }],
      [1, { valor: 300, origen: 'obra' }, { valor: 2, origen: 'obra' }],
    ]);
    const r2 = calc([f, p], plan([[f, { plantas: 3 }]]), OBRA_300_2);
    expect(r2.grupos[0]).toMatchObject({ lotes: 2, plantas: { valor: 3, origen: 'grupo' } });
    expect(r2.grupos[1]!.lotes).toBe(1);
  });

  it('sin superficie, plantas ni semanas: esos criterios no se aplican, con aviso', () => {
    const r = calc([hormigon('flexion', 45)]);
    const ids = r.avisos.map((a) => a.id);
    expect(ids.some((id) => id.startsWith('superficie:'))).toBe(true);
    expect(ids.some((id) => id.startsWith('plantas:'))).toBe(true);
    expect(ids.some((id) => id.startsWith('semanas:'))).toBe(true);
    expect(ids).toContain('distintivo');
  });

  it('control al 100 %: todas las amasadas, con la cuba; sin cuba, pendiente', () => {
    const f = hormigon('flexion', 45);
    expect(calc([f], { version: 1, hormigon: { modalidad: 'cien', cubaM3: 7 } }).grupos[0]).toMatchObject({ lotes: null, amasadas: 7 });
    const r = calc([f], { version: 1, hormigon: { modalidad: 'cien' } });
    expect(r.pendientes.map((p) => p.id)).toContain('cubaM3');
  });

  it('obra A: zapatas, forjado, pilares y muro (9 amasadas más las del muro)', () => {
    const zapatas = hormigon('cim_superficial', 40, 'HA-25/B/20/XC2');
    const forjado = hormigon('flexion', 45, 'HA-25/B/20/XC1');
    const pilares = hormigon('pilares_muros', 5, 'HA-25/B/20/XC1');
    const muro = hormigon('pilares_muros', 18, 'HA-30/B/20/XS1');
    const r = calc([zapatas, forjado, pilares, muro], { version: 1, dosificaciones: { 'HA-30/B/20/XS1': { meses: 4 } } }, OBRA_300_2);
    expect(r.grupos.map((g) => [g.clave, g.lotes, g.amasadas])).toEqual([
      ['cim_superficial|HA-25/B/20/XC2', 1, 3],
      ['flexion|HA-25/B/20/XC1', 1, 3],
      ['pilares_muros|HA-25/B/20/XC1', 1, 3],
      ['pilares_muros|HA-30/B/20/XS1', 1, 3],
    ]);
    expect(r.totales.amasadas).toBe(12);
    expect(r.durabilidad.map((d) => [d.dosificacion, d.penetracion])).toEqual([['HA-30/B/20/XS1', 1]]);
    // con distintivo: el mínimo de 3 lotes y N = 1
    const con = calc([zapatas, forjado, pilares, muro], { version: 1, ...DCOR }, OBRA_300_2);
    expect(con.totales).toMatchObject({ lotes: 4, amasadas: 4 });
  });

  it('con distintivo y menos de tres grupos, se sube a tres lotes', () => {
    const f = hormigon('flexion', 60);
    const p = hormigon('pilares_muros', 10);
    const r = calc([f, p], { version: 1, ...DCOR }, OBRA_300_2);
    expect(r.totales.lotes).toBe(3);
    expect(r.grupos[0]).toMatchObject({ lotes: 2, amasadas: 2 });
    expect(r.grupos[0]!.cuenta).toMatch(/= 2 lotes \(tabla 57\.5\.4\.1, × 5\) × 1 amasada = 2 tomas$/);
    expect(r.grupos[0]!.notas.join(' ')).toMatch(/Mínimo de 3 lotes/);
  });
});

describe('armaduras: procedencia, distintivos y datos que faltan', () => {
  it('sin procedencia → ferralla de taller (59.2) con aviso; con «obra» → art. 58 por serie', () => {
    const r = calc([acero(6500, { tipo: 'barras', diametros: [8, 10, 12, 16] })]);
    expect(r.armaduras[0]!.control).toBe('ferralla');
    expect(r.avisos.map((a) => a.id)).toEqual(expect.arrayContaining(['procedencia', 'enderezadoSoldadura']));
    const obra = calc([acero(6500, { tipo: 'barras', diametros: [8, 10, 12, 16], procedencia: 'obra' })]);
    expect(obra.armaduras[0]).toMatchObject({ control: 'barras', lotes: 2 });
  });

  it('la ferralla del caso A: 6,5 t con enderezado → 1 lote, 4 tracciones + 8 geometrías + 15 unidades', () => {
    const r = calc([acero(6500, { tipo: 'ferralla', diametros: [8, 10, 12, 16] })], { version: 1, acero: { enderezado: true, soldadura: 'no' } });
    expect(r.armaduras[0]).toMatchObject({ lotes: 1, ensayos: { traccion: 4, geometria: 8, dimensiones: 15 } });
    expect(r.armaduras[0]!.cuenta).toBe(
      'Ferralla: 6,50 t / 25 → 1 lote (59.2.4.2) → 4 tracciones + 8 geometrías (2 × 4 Ø) + 15 unidades medidas (59.2.4.4)',
    );
  });

  it('tabla 59.2.4.3: soldadura no resistente añade doblados; sin enderezado ni soldadura, la DF puede eximir', () => {
    const p = () => acero(30000, { tipo: 'ferralla', diametros: [8, 12, 25] });
    expect(calc([p()], { version: 1, acero: { enderezado: false, soldadura: 'noResistente' } }).armaduras[0]).toMatchObject({
      lotes: 2,
      ensayos: { traccion: 8, doblado: 8, dimensiones: 30 },
    });
    const ex = calc([p()], { version: 1, acero: { enderezado: false, soldadura: 'no' } }).armaduras[0]!;
    expect(ex.ensayos).toEqual({ traccion: 8, dimensiones: 30 });
    expect(ex.notas.join(' ')).toMatch(/podrá eximir/);
    // geometría solo de las series fina y media
    expect(calc([p()], { version: 1, acero: { enderezado: true, soldadura: 'no' } }).armaduras[0]!.ensayos.geometria).toBe(8);
  });

  it('acero con distintivo: tracciones y doblados a la mitad; ferralla con distintivo: solo documentación', () => {
    const p = () => acero(9000, { tipo: 'ferralla', diametros: [8, 10] });
    expect(calc([p()], { version: 1, acero: { enderezado: true, soldadura: 'no', distintivos: { barras: true } } }).armaduras[0]!.ensayos).toMatchObject({ traccion: 2 });
    const con = calc([p()], { version: 1, acero: { distintivos: { ferralla: true } } }).armaduras[0]!;
    expect(con).toMatchObject({ distintivo: true, ensayos: {} });
  });

  it('ferralla con enderezado sin diámetros: la geometría queda pendiente', () => {
    const r = calc([acero(9000, { tipo: 'ferralla' })], { version: 1, acero: { enderezado: true, soldadura: 'no' } });
    expect(r.armaduras[0]!.ensayos).toMatchObject({ traccion: 4, geometria: 0, dimensiones: 15 });
    expect(r.pendientes.map((p) => p.id)).toContain('diametros:ferralla');
  });

  it('barras en obra: lotes de 30 t por serie con los kg de cada una; sin ellos, el mínimo y pendiente', () => {
    const conSeries = acero(70000, { tipo: 'barras', procedencia: 'obra', series: { fina: 0.6, media: 0.4 } });
    expect(calc([conSeries]).armaduras[0]).toMatchObject({ lotes: 3, ensayos: { traccion: 6 } }); // 42 t → 2, 28 t → 1
    const r = calc([acero(70000, { tipo: 'barras', procedencia: 'obra', diametros: [8, 12] })]);
    expect(r.armaduras[0]!.lotes).toBe(3);
    expect(r.pendientes.map((p) => p.id)).toContain('series:barras');
  });

  it('más de 300 t de barras: química en uno de cada cuatro lotes, mínimo 5', () => {
    const r = calc([acero(310000, { tipo: 'barras', procedencia: 'obra', series: { media: 1 } })]);
    expect(r.armaduras[0]).toMatchObject({ lotes: 11, ensayos: { quimica: 5 } });
  });

  it('mallas: lotes de 30 t con dos paneles cada uno', () => {
    expect(calc([acero(1200, { tipo: 'mallas' })]).armaduras[0]).toMatchObject({
      control: 'mallas',
      lotes: 1,
      ensayos: { traccion: 2, doblado: 2, masaMetro: 2, geometria: 2, despegue: 2, dimensiones: 2 },
    });
  });

  it('acero de un hormigón «incluso armadura»: kg por unidad; sin ellos, pendiente', () => {
    expect(calc([acero(10, { tipo: 'ferralla', kgPorUd: 40 }, 'm3')]).armaduras[0]!.kg).toBe(400);
    const r = calc([acero(10, { tipo: 'ferralla' }, 'm3')]);
    expect(r.armaduras).toEqual([]);
    expect(r.pendientes[0]!.id).toMatch(/^kgPorUd:/);
  });

  it('series de diámetros del art. 58', () => {
    expect([6, 10, 12, 20, 25, 32, 40].map(serieDe)).toEqual(['fina', 'fina', 'media', 'media', 'gruesa', 'gruesa', 'muyGruesa']);
  });
});

describe('ejecución', () => {
  it('cimentación con zapatas medidas en ud: el número sale de la medición', () => {
    const z = hormigon('cim_superficial', 12, 'HA-25/B/20/XC2', { ud: 'ud', m3PorUd: 1.2 });
    const r = calc([z]);
    expect(r.ejecucion.lotes).toEqual([expect.objectContaining({ fila: 'cimentacion', lotes: 2 })]);
  });

  it('otros elementos a compresión: no están en la tabla 63.1, aviso', () => {
    const r = calc([hormigon('otros_compresion', 10)]);
    expect(r.ejecucion.lotes).toEqual([]);
    expect(r.avisos.some((a) => a.id === 'ejecucion:otros_compresion')).toBe(true);
  });

  it('muros por metros: 120 m → 3 lotes', () => {
    const m = hormigon('pilares_muros', 30, 'HA-30/B/20/XC2');
    expect(calc([m], plan([[m, { muroM: 120 }]])).ejecucion.lotes[0]).toMatchObject({ fila: 'pilares_muros', lotes: 3 });
  });
});

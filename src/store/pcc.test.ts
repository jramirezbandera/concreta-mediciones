import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { calcularPlanCalidad } from '../core/pcc/calculo';
import { necesitaRevision } from '../core/pcc/reglas';
import { partidaToRefCopyItem } from '../core/refdata';
import type { Partida } from '../core/types';
import { obraA, RATES } from '../test/fixtures/pcc/obras';
import { parseObraJson, buildExportText } from '../persist/transfer';
import { blankObraData, fromSerializable, useObraStore } from './index';
import { __resetHistoryForTests, initHistory, undo } from './temporal';

const state = () => useObraStore.getState();

function partida(id: string, code: string, title: string, ud: string, cantidad: number, extra: Partial<Partida> = {}): Partida {
  return { id, pos: id, code, title, ud, precio: 10, cantidad, desc: '', med: [], items: [], ...extra };
}

beforeEach(() => {
  __resetHistoryForTests();
  const d = blankObraData('Unifamiliar');
  d.obra.provincia = 'Málaga';
  d.chapters = [
    { id: 'e', code: '1', title: 'Estructura' },
    { id: 'q', code: '2', title: 'Control de calidad' },
  ];
  d.partidas = {
    e: [
      partida('p1', '05HHL00010', 'Hormigón para armar HA-25/B/20/XC1 en forjados y losas', 'm3', 45, { fromBase: true }),
      partida('p2', '06LMM00101', 'Fábrica de ladrillo cara vista de 1/2 pie', 'm2', 220),
      partida('p3', '05HHL00010', 'Hormigón para armar HA-25/B/20/XC1 en forjados y losas', 'm3', 10),
      partida('p4', 'X9', 'Partida alzada de imprevistos', 'ud', 1),
    ],
    q: [partida('c1', '18HHC00010', 'Ensayo de consistencia del hormigón', 'ud', 3)],
  };
  state().loadObra(d);
  initHistory(useObraStore);
});
afterEach(() => __resetHistoryForTests());

const p = (ch: string, id: string) => state().partidas[ch]!.find((x) => x.id === id)!;

describe('plan de control de calidad en el store', () => {
  it('empezar: plan vacío, capítulo de control por el título y propuestas en las partidas', () => {
    const n = state().iniciarPlanCalidad();
    expect(n).toBe(4); // p1, p2, p3 y c1 (p4 no la reconoce ninguna regla)
    expect(state().planCalidad).toMatchObject({ version: 1, capituloControl: 'q' });
    expect(p('e', 'p1').pcc).toMatchObject({ estado: 'propuesta', familia: 'hormigon-estructural', hormigon: { fila: 'flexion' } });
    expect(p('q', 'c1').pcc!.estado).toBe('capituloControl');
    expect(p('e', 'p4').pcc).toBeUndefined();
    // empezar otra vez no pisa nada
    expect(state().iniciarPlanCalidad()).toBe(0);
  });

  it('asignar control no quita la marca BASE (no es una edición de precio)', () => {
    state().iniciarPlanCalidad();
    state().confirmarControles([{ chapterId: 'e', partidaId: 'p1' }]);
    expect(p('e', 'p1').fromBase).toBe(true);
  });

  it('confirmar guarda la huella; sin familia → sin control', () => {
    state().iniciarPlanCalidad();
    state().setControlPartida('e', 'p2', { estado: 'propuesta', origen: { tipo: 'manual', motivo: 'x' } });
    expect(state().confirmarControles([{ chapterId: 'e', partidaId: 'p1' }, { chapterId: 'e', partidaId: 'p2' }])).toBe(2);
    expect(p('e', 'p1').pcc).toMatchObject({ estado: 'confirmada', huella: { code: '05HHL00010', ud: 'm3' } });
    expect(p('e', 'p2').pcc!.estado).toBe('sinControl');
    expect(p('e', 'p2').pcc!.huella).toBeUndefined();
    // confirmar otra vez lo ya confirmado no cuenta
    expect(state().confirmarControles([{ chapterId: 'e', partidaId: 'p1' }])).toBe(0);
  });

  it('una confirmada que cambia de título pasa a revisar; al confirmarla otra vez las reglas la vuelven a leer (O6)', () => {
    state().iniciarPlanCalidad();
    state().confirmarControles([{ chapterId: 'e', partidaId: 'p1' }]);
    state().editPartidaField('e', 'p1', 'title', 'Hormigón para armar HA-30/B/20/XC1 en forjados y losas');
    expect(necesitaRevision(p('e', 'p1').pcc!, p('e', 'p1'))).toBe(true);
    expect(state().confirmarControles([{ chapterId: 'e', partidaId: 'p1' }])).toBe(1);
    const c = p('e', 'p1').pcc!;
    expect(c.estado).toBe('confirmada');
    expect(c.hormigon!.designacion.texto).toBe('HA-30/B/20/XC1');
    expect(necesitaRevision(c, p('e', 'p1'))).toBe(false);
  });

  it('lo puesto a mano se conserva al confirmar otra vez (O6)', () => {
    state().iniciarPlanCalidad();
    const c = p('e', 'p1').pcc!;
    state().setControlPartida('e', 'p1', { ...c, origen: { tipo: 'manual', motivo: 'a mano' }, hormigon: { ...c.hormigon!, fila: 'pilares_muros' } });
    state().confirmarControles([{ chapterId: 'e', partidaId: 'p1' }]);
    state().editPartidaField('e', 'p1', 'title', 'Hormigón HA-30/B/20/XC1 en forjados');
    state().confirmarControles([{ chapterId: 'e', partidaId: 'p1' }]);
    expect(p('e', 'p1').pcc).toMatchObject({ estado: 'confirmada', hormigon: { fila: 'pilares_muros', designacion: { texto: 'HA-25/B/20/XC1' } } });
    expect(necesitaRevision(p('e', 'p1').pcc!, p('e', 'p1'))).toBe(false);
  });

  it('cada acción es un paso de Deshacer', () => {
    state().iniciarPlanCalidad();
    state().confirmarControles([{ chapterId: 'e', partidaId: 'p1' }]);
    state().setPlanCalidad({ plantas: 2 });
    undo();
    expect(state().planCalidad!.plantas).toBeUndefined();
    undo();
    expect(p('e', 'p1').pcc!.estado).toBe('propuesta');
    undo();
    expect(state().planCalidad).toBeUndefined();
    expect(p('e', 'p1').pcc).toBeUndefined();
  });

  it('aplicar a las partidas con el mismo código, cada una con su huella', () => {
    state().iniciarPlanCalidad();
    state().confirmarControles([{ chapterId: 'e', partidaId: 'p1' }]);
    state().setControlPartida('e', 'p3', null);
    expect(state().aplicarControlAHomonimos('e', 'p1')).toBe(1);
    expect(p('e', 'p3').pcc).toMatchObject({ estado: 'confirmada', familia: 'hormigon-estructural' });
    expect(necesitaRevision(p('e', 'p3').pcc!, p('e', 'p3'))).toBe(false);
  });

  it('tomar precios los guarda en el plan sin pisar los demás, y se deshace', () => {
    state().iniciarPlanCalidad();
    const precio = (ensayo: string, n: number) => ({ ensayo, codigo: 'X', precio: n, ud: 'ud', banco: 'BCCA', fecha: '2026-10-26' });
    state().tomarPreciosPlan({ a: precio('a', 10) });
    state().tomarPreciosPlan({ b: precio('b', 20) });
    expect(Object.keys(state().planCalidad!.precios!)).toEqual(['a', 'b']);
    undo();
    expect(Object.keys(state().planCalidad!.precios!)).toEqual(['a']);
  });

  it('copiar una partida a otra obra lleva su control', () => {
    state().iniciarPlanCalidad();
    state().confirmarControles([{ chapterId: 'e', partidaId: 'p2' }]);
    const item = partidaToRefCopyItem({ ...p('e', 'p2'), code: 'NUEVO' }, state().recursos, 'Otra obra');
    state().requestCopyRefPartidas([item], { chId: 'e', subId: null }, false);
    const copia = state().partidas.e!.find((x) => x.code === 'NUEVO')!;
    expect(copia.pcc).toMatchObject({ estado: 'confirmada', familia: 'fabrica-ladrillo' });
  });

  it('cargar otra obra no hereda el plan', () => {
    state().iniciarPlanCalidad();
    state().loadObra(blankObraData('Otra'));
    expect(state().planCalidad).toBeUndefined();
  });
});

describe('ida y vuelta por .json', () => {
  it('la obra A se guarda, se recarga y da el mismo plan', () => {
    const o = obraA();
    const d = blankObraData('Obra A');
    Object.assign(d, { chapters: o.chapters, partidas: o.partidas, obra: o.obra, rates: RATES, planCalidad: o.plan });
    state().loadObra(d);
    const calc = () => {
      const s = state();
      return calcularPlanCalidad({ chapters: s.chapters, partidas: s.partidas, banco: s.recursos, rates: s.rates, obra: s.obra, plan: s.planCalidad!, hoy: '2026-10-26' });
    };
    const antes = calc();
    state().loadObra(fromSerializable(parseObraJson(buildExportText())));
    const despues = calc();
    expect(despues).toEqual(antes);
    expect(despues.estructura.totales.amasadas).toBe(15);
  });
});

describe('«Crear capítulo de control de calidad» (A2)', () => {
  const propuesta = (ensayo: string, codigoBanco: string | null) => ({ ensayo, codigoBanco, title: `Ensayo ${ensayo}`, ud: 'amasada', cantidad: 3, precio: 59.28, desc: 'Texto' });

  it('crea el capítulo, lo enlaza y marca cada partida con su ensayo; Deshacer lo quita entero', () => {
    state().iniciarPlanCalidad();
    state().setPlanCalidad({ capituloControl: null });
    const capitulos = state().chapters.length;
    // 18HHC00010 ya lo usa la obra (c1): la nueva partida lleva un código nuevo.
    const n = state().crearCapituloControl([propuesta('j03-008', '18HHL00010'), propuesta('j03-009', '18HHC00010'), propuesta('app-x', null)]);
    expect(n).toBe(3);
    const ch = state().chapters.at(-1)!;
    expect(ch).toMatchObject({ code: '3', title: 'Control de calidad' });
    expect(state().planCalidad!.capituloControl).toBe(ch.id);
    const ps = state().partidas[ch.id]!;
    expect(ps.map((x) => x.code)).toEqual(['18HHL00010', 'P001', 'P002']);
    expect(ps[0]).toMatchObject({ cantidad: 3, precio: 59.28, ud: 'amasada', items: [], pcc: { estado: 'capituloControl', ensayo: 'j03-008' } });
    undo();
    expect(state().chapters).toHaveLength(capitulos);
    expect(state().partidas[ch.id]).toBeUndefined();
    expect(state().planCalidad!.capituloControl).toBeNull();
  });

  it('sin plan o sin partidas no hace nada', () => {
    expect(state().crearCapituloControl([propuesta('j03-008', null)])).toBe(0);
    state().iniciarPlanCalidad();
    expect(state().crearCapituloControl([])).toBe(0);
  });
});

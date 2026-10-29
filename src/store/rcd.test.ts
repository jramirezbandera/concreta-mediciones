import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Partida } from '../core/types';
import { calcularEstudioRcd } from '../core/rcd/calculo';
import { partidasGestion } from '../core/rcd/capitulo';
import { blankObraData, fromSerializable, toSerializable, useObraStore } from './index';
import { __resetHistoryForTests, initHistory, undo } from './temporal';

const state = () => useObraStore.getState();

function partida(id: string, code: string, title: string, ud: string, cantidad: number, extra: Partial<Partida> = {}): Partida {
  return { id, pos: id, code, title, ud, precio: 10, cantidad, desc: '', med: [], items: [], ...extra };
}

beforeEach(() => {
  __resetHistoryForTests();
  const d = blankObraData('Reforma');
  d.chapters = [
    { id: 'd', code: '1', title: 'Demoliciones' },
    { id: 'g', code: '2', title: 'Gestión de residuos' },
  ];
  d.partidas = {
    d: [
      partida('p1', '01ADS00001', 'DEMOLICIÓN DE TABIQUE DE L/ HUECO SENCILLO, C. MANUAL, T. VERT.', 'm2', 20, { fromBase: true }),
      partida('p2', 'DLC010', 'Desmontaje de hoja de carpintería exterior de aluminio', 'Ud', 3),
      partida('p3', '01ADS00001', 'DEMOLICIÓN DE TABIQUE DE L/ HUECO SENCILLO, C. MANUAL, T. VERT.', 'm2', 5),
      partida('p4', 'FFQ010', 'Tabique de ladrillo hueco doble', 'm2', 30),
    ],
    g: [partida('g1', 'GRA010', 'Transporte de residuos inertes con contenedor + canon', 'Ud', 2)],
  };
  state().loadObra(d);
  initHistory(useObraStore);
});
afterEach(() => __resetHistoryForTests());

const p = (ch: string, id: string) => state().partidas[ch]!.find((x) => x.id === id)!;

describe('estudio de residuos en el store', () => {
  it('empezar: datos vacíos, capítulo de gestión por el título y propuestas en las partidas', () => {
    const n = state().iniciarEstudioRcd();
    expect(n).toBe(4); // p1, p2, p3 y g1 (p4 es obra nueva, sin regla)
    expect(state().estudioRcd).toMatchObject({ version: 1, capituloGestion: 'g', tipos: [] });
    expect(p('d', 'p1').rcd).toMatchObject({ estado: 'propuesta', componentes: [{ ler: '17 01 02' }] });
    expect(p('g', 'g1').rcd!.estado).toBe('gestion');
    expect(p('d', 'p4').rcd).toBeUndefined();
    // empezar otra vez no pisa nada
    expect(state().iniciarEstudioRcd()).toBe(0);
  });

  it('empezar sin partidas fuera de la gestión: básico de obra nueva con ECO-eficiencia', () => {
    state().loadObra({ ...blankObraData('Vivienda'), chapters: [{ id: 'g', code: '1', title: 'Gestión de residuos' }], partidas: { g: [] } });
    state().iniciarEstudioRcd();
    expect(state().estudioRcd).toMatchObject({ fase: 'basico', tipos: ['nueva'], ratios: { metodo: 'ecoeficiencia', nivel: 'detallado' } });
  });

  it('asignar residuo no quita la marca BASE (no es una edición de precio)', () => {
    state().iniciarEstudioRcd();
    state().confirmarResiduos([{ chapterId: 'd', partidaId: 'p1' }]);
    expect(p('d', 'p1').fromBase).toBe(true);
  });

  it('confirmar: con componentes → confirmada; sin ellos → no genera', () => {
    state().iniciarEstudioRcd();
    state().setResiduoPartida('d', 'p2', { estado: 'propuesta', origen: { tipo: 'regla', motivo: 'x' }, componentes: [] });
    expect(state().confirmarResiduos([{ chapterId: 'd', partidaId: 'p1' }, { chapterId: 'd', partidaId: 'p2' }])).toBe(2);
    expect(p('d', 'p1').rcd!.estado).toBe('confirmada');
    expect(p('d', 'p2').rcd!.estado).toBe('noGenera');
  });

  it('cada acción es un paso de Deshacer', () => {
    state().iniciarEstudioRcd();
    state().confirmarResiduos([{ chapterId: 'd', partidaId: 'p1' }]);
    undo();
    expect(p('d', 'p1').rcd!.estado).toBe('propuesta');
    undo();
    expect(state().estudioRcd).toBeUndefined();
    expect(p('d', 'p1').rcd).toBeUndefined();
  });

  it('aplicar a las partidas con el mismo código', () => {
    state().iniciarEstudioRcd();
    state().setResiduoPartida('d', 'p1', {
      estado: 'confirmada',
      origen: { tipo: 'manual', motivo: 'revisada' },
      componentes: [{ ler: '17 01 07', tipo: 'demolicion', conversion: { modo: 'pesoSuperficie', tPorM2: 0.09, espesor: 0.07 } }],
    });
    expect(state().aplicarResiduoAHomonimos('d', 'p1')).toBe(1);
    expect(p('d', 'p3').rcd).toEqual(p('d', 'p1').rcd);
    expect(p('d', 'p3').rcd).not.toBe(p('d', 'p1').rcd);
  });

  it('datos del estudio y quitarlo; se guarda en la copia', () => {
    state().iniciarEstudioRcd();
    state().setEstudioRcd({ tipos: ['reforma'], amianto: 'no' });
    expect(toSerializable(state()).estudioRcd).toMatchObject({ tipos: ['reforma'], amianto: 'no' });
    state().quitarEstudioRcd();
    expect(toSerializable(state())).not.toHaveProperty('estudioRcd');
    expect(p('d', 'p1').rcd).toBeDefined(); // las asignaciones se quedan
  });

  it('crear el capítulo de gestión desde la estimación: una partida por código, enlazado, y se deshace', () => {
    state().iniciarEstudioRcd();
    state().setEstudioRcd({ capituloGestion: null, precios: { '17 01 02': { eurPorT: 12 } } });
    state().confirmarResiduos([{ chapterId: 'd', partidaId: 'p1' }]);
    const st = state();
    const r = calcularEstudioRcd({ chapters: st.chapters, partidas: st.partidas, rates: st.rates, obra: st.obra, estudio: st.estudioRcd!, hoy: '2026-10-16' });
    const n = state().crearCapituloGestionRcd(partidasGestion(r, st.estudioRcd!, 7).partidas);
    expect(n).toBe(2); // contenedores de la fracción mineral + entrega del 17 01 02
    const ch = state().chapters.at(-1)!;
    expect(ch.title).toBe('Gestión de residuos');
    expect(state().estudioRcd!.capituloGestion).toBe(ch.id);
    const [tr, g] = state().partidas[ch.id]!;
    expect(tr).toMatchObject({ ud: 'Ud', cantidad: 1, precio: 0, rcd: { estado: 'gestion', gestiona: { capacidadContenedorM3: 7 } } });
    expect(g).toMatchObject({ ud: 't', cantidad: 1.2, precio: 12, rcd: { estado: 'gestion', gestiona: { codigos: ['17 01 02'] } } });
    undo();
    expect(state().chapters.some((c) => c.id === ch.id)).toBe(false);
    expect(state().estudioRcd!.capituloGestion).toBeNull();
  });

  it('cargar otra obra no hereda el estudio', () => {
    state().iniciarEstudioRcd();
    state().loadObra(blankObraData('Otra'));
    expect(state().estudioRcd).toBeUndefined();
  });
});

describe('volver a revisar un residuo confirmado si cambia la partida (TD1)', () => {
  const calc = () => {
    const s = state();
    return calcularEstudioRcd({ chapters: s.chapters, partidas: s.partidas, rates: s.rates, obra: s.obra, estudio: s.estudioRcd!, hoy: '2026-10-26' });
  };
  const suma = (id: string) => calc().porCodigo.some((f) => f.origen.some((o) => o.kind === 'partida' && o.partidaId === id));

  it('confirmar guarda la huella; cambiar el título lo saca del estudio y lo pide en «Antes de entregar»', () => {
    state().iniciarEstudioRcd();
    state().confirmarResiduos([{ chapterId: 'd', partidaId: 'p1' }]);
    expect(p('d', 'p1').rcd!.huella).toEqual({ code: '01ADS00001', title: 'DEMOLICIÓN DE TABIQUE DE L/ HUECO SENCILLO, C. MANUAL, T. VERT.', desc: '', ud: 'm2' });
    expect(suma('p1')).toBe(true);
    state().editPartidaField('d', 'p1', 'title', 'DEMOLICIÓN DE TABIQUE DE L/ HUECO DOBLE, C. MANUAL, T. VERT.');
    expect(p('d', 'p1').rcd!.estado).toBe('confirmada'); // no cambia solo
    expect(suma('p1')).toBe(false);
    expect(calc().pendientes.find((x) => x.id === 'revisar:p1')).toMatchObject({ apartado: '1', partidaId: 'p1' });
  });

  it('cambiar la unidad también; y confirmar otra vez conserva los residuos corregidos con la huella nueva', () => {
    state().iniciarEstudioRcd();
    state().confirmarResiduos([{ chapterId: 'd', partidaId: 'p1' }]);
    const corregido = { ...p('d', 'p1').rcd!, componentes: p('d', 'p1').rcd!.componentes.map((c) => ({ ...c, ler: '17 01 07' })) };
    state().setResiduoPartida('d', 'p1', corregido);
    state().editPartidaField('d', 'p1', 'ud', 'm3');
    expect(suma('p1')).toBe(false);
    expect(state().confirmarResiduos([{ chapterId: 'd', partidaId: 'p1' }])).toBe(1);
    expect(p('d', 'p1').rcd).toMatchObject({ estado: 'confirmada', componentes: [{ ler: '17 01 07' }], huella: { ud: 'm3' } });
    expect(calc().pendientes.map((x) => x.id)).not.toContain('revisar:p1');
  });

  it('un residuo confirmado sin huella (de antes de TD1) sigue contando', () => {
    state().iniciarEstudioRcd();
    state().confirmarResiduos([{ chapterId: 'd', partidaId: 'p1' }]);
    const { huella: _h, ...sin } = p('d', 'p1').rcd!;
    state().setResiduoPartida('d', 'p1', sin);
    state().editPartidaField('d', 'p1', 'title', 'Otro título');
    expect(suma('p1')).toBe(true);
  });

  it('confirmar no toca las confirmadas que no han cambiado', () => {
    state().iniciarEstudioRcd();
    state().confirmarResiduos([{ chapterId: 'd', partidaId: 'p1' }]);
    expect(state().confirmarResiduos([{ chapterId: 'd', partidaId: 'p1' }])).toBe(0);
  });

  it('aplicar a homónimos: cada partida con su propia huella', () => {
    state().iniciarEstudioRcd();
    state().confirmarResiduos([{ chapterId: 'd', partidaId: 'p1' }]);
    state().editPartidaField('d', 'p3', 'desc', 'Texto propio de p3');
    state().aplicarResiduoAHomonimos('d', 'p1');
    expect(p('d', 'p3').rcd!.huella!.desc).toBe('Texto propio de p3');
    expect(suma('p3')).toBe(true);
  });

  it('una huella ilegible aparta el residuo a `_ilegible` sin romper la obra', () => {
    state().iniciarEstudioRcd();
    state().confirmarResiduos([{ chapterId: 'd', partidaId: 'p1' }]);
    const d = JSON.parse(JSON.stringify(toSerializable(state()))) as ReturnType<typeof toSerializable>;
    (d.partidas.d![0]!.rcd as unknown as { huella: unknown }).huella = 'x';
    state().loadObra(fromSerializable(d));
    expect(p('d', 'p1').rcd).toBeUndefined();
    expect(state()._ilegible?.some((x) => x.donde === 'partidas/d/p1/rcd')).toBe(true);
  });
});

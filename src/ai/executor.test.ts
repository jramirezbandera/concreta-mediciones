/* Tests del executor (F-A3) — el crítico. Conduce el store vivo: siembra una obra
   en blanco con fixtures, aplica operaciones y comprueba efecto + postcondiciones,
   sello, gate de readonly, tope, obra vacía y la REGRESIÓN de borrar+editar. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyProposals, currentSeal, MAX_OPS_PER_TURN, planTurn } from './executor';
import type { Operation } from './ops';
import { blankObraData, useObraStore } from '../store';
import { useSessionStore } from '../persist';
import { medTotal, partidaCantidad } from '../core/medicion';
import type { Chapter, MedLine, Partida, PartidasMap } from '../core/types';
import { __resetHistoryForTests, __setThrottleMsForTests, initHistory, undo } from '../store/temporal';

const line = (o: Partial<MedLine>): MedLine => ({ id: `m-${Math.random()}`, comment: '', uds: '', largo: '', ancho: '', alto: '', ...o });
const partida = (o: Partial<Partida> & Pick<Partida, 'id' | 'pos'>): Partida => ({
  code: '——',
  title: 'P',
  ud: 'ud',
  precio: 0,
  desc: '',
  med: [],
  items: [],
  ...o,
});

function setObra(chapters: Chapter[], partidas: PartidasMap, active?: string): void {
  useObraStore.setState({
    ...blankObraData(),
    chapters,
    partidas,
    active: active ?? chapters[0]?.id ?? '__ALL__',
    curCert: 0,
    openPartidaId: null,
  });
}

const CH: Chapter[] = [
  { id: 'c1', code: '1', title: 'Movimiento de tierras', children: [] },
  { id: 'c2', code: '2', title: 'Albañilería', children: [] },
];

beforeEach(() => {
  useSessionStore.getState().setReadonly(false);
  setObra(structuredClone(CH), { c1: [partida({ id: 'p1', pos: '1.1', title: 'Excavación', ud: 'm³', precio: 10 })], c2: [] });
});

describe('planTurn — resolución y clasificación', () => {
  it('crear_partida (directa) crea la partida con líneas inline, precio y ud', () => {
    const ops: Operation[] = [
      { op: 'crear_partida', capitulo: '2', titulo: 'Fábrica de ladrillo', ud: 'm²', precio: 24.5, lineas: [{ uds: 2, largo: 3 }] },
    ];
    const res = planTurn(ops, currentSeal());
    expect(res.applied).toHaveLength(1);
    const p = useObraStore.getState().partidas.c2![0]!;
    expect(p.title).toBe('Fábrica de ladrillo');
    expect(p.ud).toBe('m²');
    expect(p.precio).toBe(24.5);
    expect(medTotal(p.med)).toBe(6); // 2·3, ancho/alto vacíos = 1
  });

  it('parcial: vacío=1 y un 0 explícito anula la línea', () => {
    planTurn([{ op: 'crear_partida', capitulo: '1', titulo: 'X', ud: 'm', lineas: [{ uds: 2, largo: 3 }, { uds: 5, largo: 0 }] }], currentSeal());
    const p = useObraStore.getState().partidas.c1!.find((x) => x.title === 'X')!;
    expect(medTotal(p.med)).toBe(6); // 6 + (5·0=0)
  });

  it('agregar_lineas (directa) por pos suma líneas a la partida existente', () => {
    const res = planTurn([{ op: 'agregar_lineas', ref: '1.1', lineas: [{ uds: 4 }, { uds: 1, largo: 2, ancho: 2 }] }], currentSeal());
    expect(res.applied).toHaveLength(1);
    expect(partidaCantidad(useObraStore.getState().partidas.c1![0]!)).toBe(8); // 4 + 4
  });

  it('ref inexistente → no-encontrada, no muta', () => {
    const res = planTurn([{ op: 'set_precio', ref: '9.9', valor: 5 }], currentSeal());
    expect(res.notFound).toHaveLength(1);
    expect(res.proposals).toHaveLength(0);
  });

  it('editar/borrar/set son PROPUESTAS (no se aplican solas)', () => {
    const res = planTurn([{ op: 'set_precio', ref: '1.1', valor: 99 }], currentSeal());
    expect(res.applied).toHaveLength(0);
    expect(res.proposals).toHaveLength(1);
    expect(useObraStore.getState().partidas.c1![0]!.precio).toBe(10); // aún sin aplicar
  });

  it('capítulo destino inexistente en crear_partida → no-encontrada', () => {
    const res = planTurn([{ op: 'crear_partida', capitulo: '7', titulo: 'X', ud: 'ud' }], currentSeal());
    expect(res.notFound).toHaveLength(1);
  });
});

describe('planTurn — límites y contexto', () => {
  it('gate de solo-lectura: no muta NADA y lo señala', () => {
    useSessionStore.getState().setReadonly(true);
    const res = planTurn([{ op: 'crear_capitulo', titulo: 'Nuevo' }], currentSeal());
    expect(res.readonlyBlocked).toBe(true);
    expect(res.applied).toHaveLength(0);
    expect(useObraStore.getState().chapters).toHaveLength(2);
  });

  it('sello: si cambió obra/cert, no aplica nada', () => {
    const stale = { ...currentSeal(), curCert: 99 };
    const res = planTurn([{ op: 'crear_capitulo', titulo: 'Nuevo' }], stale);
    expect(res.sealChanged).toBe(true);
    expect(useObraStore.getState().chapters).toHaveLength(2);
  });

  it('tope de ~40 ops: aplica 40 y anuncia el resto', () => {
    const ops: Operation[] = Array.from({ length: 50 }, (_, i) => ({ op: 'crear_capitulo', titulo: `C${i}` }));
    const res = planTurn(ops, currentSeal());
    expect(res.applied).toHaveLength(MAX_OPS_PER_TURN);
    expect(res.overflow).toBe(10);
  });

  it('obra vacía: crea el capítulo que falta y lo declara', () => {
    setObra([], {});
    const res = planTurn([{ op: 'crear_partida', titulo: 'Primera', ud: 'ud' }], currentSeal());
    expect(res.createdChapter).toBe('Capítulo 1');
    const st = useObraStore.getState();
    expect(st.chapters).toHaveLength(1);
    expect(st.partidas[st.chapters[0]!.id]).toHaveLength(1);
  });

  it('crear_partida en otro capítulo → revealPartida salta hasta ella', () => {
    planTurn([{ op: 'crear_partida', capitulo: '2', titulo: 'En cap 2', ud: 'ud' }], currentSeal());
    const st = useObraStore.getState();
    const created = st.partidas.c2!.find((p) => p.title === 'En cap 2')!;
    expect(st.openPartidaId).toBe(created.id);
    expect(st.active).toBe('c2');
  });
});

describe('set_cantidad', () => {
  it('con medición → rechazada con motivo (no-op disfrazado)', () => {
    setObra(structuredClone(CH), { c1: [partida({ id: 'p1', pos: '1.1', med: [line({ uds: 5 })] })], c2: [] });
    const res = planTurn([{ op: 'set_cantidad', ref: '1.1', valor: 12 }], currentSeal());
    expect(res.proposals).toHaveLength(0);
    expect(res.skipped).toHaveLength(1);
    expect(res.skipped[0]!.reason).toMatch(/medición/);
  });

  it('sin medición → propuesta → al aplicar fija la cantidad', () => {
    const plan = planTurn([{ op: 'set_cantidad', ref: '1.1', valor: 12 }], currentSeal());
    expect(plan.proposals).toHaveLength(1);
    const ap = applyProposals(plan.proposals, currentSeal());
    expect(ap.applied).toHaveLength(1);
    expect(useObraStore.getState().partidas.c1![0]!.cantidad).toBe(12);
  });
});

describe('applyProposals — dos fases (REGRESIÓN Issue 2)', () => {
  beforeEach(() => {
    setObra(structuredClone(CH), {
      c1: [partida({ id: 'p1', pos: '1.1', med: [line({ id: 'L1', uds: 1 }), line({ id: 'L2', uds: 2 }), line({ id: 'L3', uds: 3 })] })],
      c2: [],
    });
  });

  it('borrar línea 2 + editar línea 3 en el mismo turno NO se pisan tras el splice', () => {
    const ops: Operation[] = [
      { op: 'borrar_linea', ref: '1.1', indice: 2 },
      { op: 'editar_linea', ref: '1.1', indice: 3, campo: 'alto', valor: 9 },
    ];
    const plan = planTurn(ops, currentSeal());
    expect(plan.proposals).toHaveLength(2);
    applyProposals(plan.proposals, currentSeal());
    const med = useObraStore.getState().partidas.c1![0]!.med;
    // L2 borrada; L1 intacta; L3 recibe alto=9 (no L1, que sería el índice 3-1 tras el splice).
    expect(med.map((l) => l.id)).toEqual(['L1', 'L3']);
    expect(med.find((l) => l.id === 'L3')!.alto).toBe(9);
    expect(med.find((l) => l.id === 'L1')!.alto).toBe('');
  });

  it('índice fuera de rango → omitida con motivo', () => {
    const plan = planTurn([{ op: 'editar_linea', ref: '1.1', indice: 9, campo: 'ancho', valor: 2 }], currentSeal());
    expect(plan.proposals).toHaveLength(0);
    expect(plan.skipped).toHaveLength(1);
  });

  it('la partida se borró antes de aplicar → no-encontrada (postcondición)', () => {
    const plan = planTurn([{ op: 'set_precio', ref: '1.1', valor: 50 }], currentSeal());
    useObraStore.getState().deletePartida('c1', 'p1');
    const ap = applyProposals(plan.proposals, currentSeal());
    expect(ap.applied).toHaveLength(0);
    expect(ap.notFound).toHaveLength(1);
  });

  it('applyProposals respeta readonly y sello', () => {
    const plan = planTurn([{ op: 'set_precio', ref: '1.1', valor: 50 }], currentSeal());
    const staleSeal = { ...currentSeal(), curCert: 42 };
    expect(applyProposals(plan.proposals, staleSeal).sealChanged).toBe(true);
    useSessionStore.getState().setReadonly(true);
    expect(applyProposals(plan.proposals, currentSeal()).readonlyBlocked).toBe(true);
  });
});

describe('certificación (F-A4)', () => {
  beforeEach(() => {
    useObraStore.setState({
      ...blankObraData(),
      chapters: structuredClone(CH),
      partidas: {
        c1: [partida({ id: 'p1', pos: '1.1', title: 'Excavación', ud: 'm³', precio: 10, med: [line({ uds: 6 })] })],
        c2: [
          partida({ id: 'p2', pos: '2.1', title: 'Muro', ud: 'm²', precio: 20, med: [line({ uds: 5 })] }),
          partida({ id: 'p3', pos: '2.2', title: 'Enfoscado', ud: 'm²', precio: 8, med: [line({ uds: 10 })] }),
        ],
      },
      certs: [{ id: 'c1', num: 1, period: 'junio 2026', retencion: 0, data: {} }],
      active: 'c1',
      curCert: 0,
      openPartidaId: null,
    });
  });

  it('certificar → propuesta con cert destino nombrada; aplica a-origen', () => {
    const plan = planTurn([{ op: 'certificar', ref: '1.1', valor: 6, modo: 'origen' }], currentSeal());
    expect(plan.applied).toHaveLength(0);
    expect(plan.proposals).toHaveLength(1);
    expect(plan.proposals[0]!.certDest).toEqual({ num: 1, period: 'junio 2026', firmado: false });
    applyProposals(plan.proposals, currentSeal());
    expect(useObraStore.getState().certs[0]!.data.p1).toBe(6);
  });

  it('certificar_100 ámbito capítulo → un scope; aplica al 100% en un solo set', () => {
    const plan = planTurn([{ op: 'certificar_100', ambito: 'capitulo', ref: '2' }], currentSeal());
    expect(plan.proposals).toHaveLength(1);
    const sc = plan.proposals[0]!.scope!;
    expect(sc.count).toBe(2);
    expect([...sc.ids].sort()).toEqual(['p2', 'p3']);
    applyProposals(plan.proposals, currentSeal());
    const data = useObraStore.getState().certs[0]!.data;
    expect(data.p2).toBe(5);
    expect(data.p3).toBe(10);
    expect(data.p1).toBeUndefined(); // el capítulo 1 no se toca
  });

  it('certificar_100 ámbito obra → todas las partidas', () => {
    const plan = planTurn([{ op: 'certificar_100', ambito: 'obra' }], currentSeal());
    expect(plan.proposals[0]!.scope!.count).toBe(3);
  });

  it('certificar_100 con todo ya al 100% → omitida con motivo', () => {
    useObraStore.setState({ certs: [{ id: 'c1', num: 1, period: '', retencion: 0, data: { p2: 5, p3: 10 } }] });
    const plan = planTurn([{ op: 'certificar_100', ambito: 'capitulo', ref: '2' }], currentSeal());
    expect(plan.proposals).toHaveLength(0);
    expect(plan.skipped).toHaveLength(1);
  });

  it('crear_certificacion → propuesta; aplica crea la cert nº2 con su periodo', () => {
    const plan = planTurn([{ op: 'crear_certificacion', periodo: 'julio 2026' }], currentSeal());
    expect(plan.proposals).toHaveLength(1);
    applyProposals(plan.proposals, currentSeal());
    const st = useObraStore.getState();
    expect(st.certs).toHaveLength(2);
    expect(st.certs[1]!.period).toBe('julio 2026');
  });

  it('agregar_lineas sobre partida CERTIFICADA → propuesta (baja el % en silencio), no directa', () => {
    useObraStore.setState({ certs: [{ id: 'c1', num: 1, period: '', retencion: 0, data: { p1: 6 } }] });
    const plan = planTurn([{ op: 'agregar_lineas', ref: '1.1', lineas: [{ uds: 4 }] }], currentSeal());
    expect(plan.applied).toHaveLength(0);
    expect(plan.proposals).toHaveLength(1);
    expect(useObraStore.getState().partidas.c1![0]!.med).toHaveLength(1); // aún sin aplicar
    applyProposals(plan.proposals, currentSeal());
    expect(useObraStore.getState().partidas.c1![0]!.med).toHaveLength(2);
  });

  it('agregar_lineas sobre partida NO certificada → directa (como F-A3)', () => {
    const plan = planTurn([{ op: 'agregar_lineas', ref: '2.1', lineas: [{ uds: 3 }] }], currentSeal());
    expect(plan.applied).toHaveLength(1);
    expect(plan.proposals).toHaveLength(0);
  });

  it('cert ya exportada (firmadoAt) → certDest.firmado avisa', () => {
    useObraStore.setState({ certs: [{ id: 'c1', num: 1, period: 'junio', retencion: 0, data: {}, firmadoAt: '2026-06-30T00:00:00Z' }] });
    const plan = planTurn([{ op: 'certificar', ref: '1.1', valor: 6, modo: 'origen' }], currentSeal());
    expect(plan.proposals[0]!.certDest!.firmado).toBe(true);
  });
});

describe('un turno = UNA entrada de undo', () => {
  afterEach(() => __resetHistoryForTests());

  it('dictar 3 partidas y editar → un solo Ctrl+Z revierte el turno entero', () => {
    setObra(structuredClone(CH), { c1: [], c2: [] });
    __setThrottleMsForTests(10_000); // ventana amplia: todo el turno coalesce en una entrada
    initHistory(useObraStore);
    const ops: Operation[] = [
      { op: 'crear_partida', capitulo: '1', titulo: 'A', ud: 'ud' },
      { op: 'crear_partida', capitulo: '1', titulo: 'B', ud: 'ud' },
      { op: 'crear_partida', capitulo: '1', titulo: 'C', ud: 'ud' },
    ];
    planTurn(ops, currentSeal());
    expect(useObraStore.getState().partidas.c1).toHaveLength(3);
    undo();
    expect(useObraStore.getState().partidas.c1).toHaveLength(0);
  });
});

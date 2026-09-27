/* Acciones de los planos PDF (§4 de la especificación): un paso de Deshacer
   cada una, `expect` por operación y `stale` sin tocar nada. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { medFormaDe } from '../core/medForma';
import { escalaDe } from '../core/planoDatos';
import { prepararMedida, type NewPlanoLine } from '../core/planoMedida';
import type { Escala, MedForma, OrigenPlano, Partida, PlanoMeta } from '../core/types';
import a0 from '../test/fixtures/planos/obra-v6-a0.json';
import { applyPaste, copyLines, pasteLines } from './medLineOps';
import { useClipboardStore } from './clipboardStore';
import { useMedUiStore } from './medUiStore';
import { fromSerializable, useObraStore, useToastStore, type ObraData } from './index';
import { textoResultado } from './motivos';
import { __historyState, __resetHistoryForTests, initHistory, undo } from './temporal';

const st = () => useObraStore.getState();
const A0 = a0 as unknown as ObraData;
const P = (id: string) => Object.values(st().partidas).flat().find((p) => p.id === id)!;
const doc = () => ({ docToken: st().docToken });
const plano = () => st().planos[0]!;

/** Obra A0 cargada (un plano calibrado a 1:50 y 7 líneas medidas). */
function cargarA0(): void {
  st().loadObra(fromSerializable(structuredClone(A0)));
}

/** Medida de 5 m (Longitud) sobre la página 1, preparada contra el estado vivo. */
function medir5m(partidaId: string, over: Partial<Parameters<typeof prepararMedida>[0]> = {}) {
  const p = P(partidaId);
  const pl = plano();
  const r = prepararMedida({
    herramienta: 'longitud',
    puntos: [
      [100, 100],
      [383.46, 100],
    ],
    plano: pl,
    pagina: 1,
    escala: escalaDe(pl, 1),
    partida: p,
    fijas: {},
    restar: false,
    comentario: 'P1 · Nuevo',
    formaId: 'f-nueva',
    at: '2026-09-26T12:00:00.000Z',
    ...over,
  });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r;
}
const chapterOf = (partidaId: string) =>
  Object.entries(st().partidas).find(([, ps]) => ps.some((p) => p.id === partidaId))![0];
const expectDe = (pl: PlanoMeta, calRev: string | null = escalaDe(pl, 1)?.rev ?? null) => ({
  ...doc(),
  planoId: pl.id,
  huella: pl.huella,
  pagina: 1,
  calRev,
});
function destino(partidaId: string, lineas: NewPlanoLine[], medForma?: 'area') {
  const p = P(partidaId);
  return { chapterId: chapterOf(partidaId), partidaId, lineas, expectForma: medFormaDe(p) as MedForma, expectUd: p.ud, ...(medForma ? { medForma } : {}) };
}

beforeEach(() => {
  __resetHistoryForTests();
  st().reset();
  useClipboardStore.getState().clear();
  useMedUiStore.getState().reset();
  useToastStore.getState().clear();
  cargarA0();
  initHistory(useObraStore);
});
afterEach(() => {
  __resetHistoryForTests();
  vi.useRealTimers();
});

describe('cada acción es UN paso de Deshacer y `stale` no toca nada', () => {
  it('addPlanoLines: alta de la línea medida; Deshacer la quita', () => {
    const r = medir5m('p-tabique');
    const antes = P('p-tabique').med.length;
    const res = st().addPlanoLines({ destinos: [destino('p-tabique', r.lineas)], expect: expectDe(plano()) });
    expect(res.ids).toHaveLength(1);
    const l = P('p-tabique').med.at(-1)!;
    expect(l).toMatchObject({ id: res.ids[0], largo: 5, expr: { largo: '5' }, comment: 'P1 · Nuevo' });
    expect((l.origen as OrigenPlano).formaId).toBe('f-nueva');
    expect(__historyState().past).toBe(1);
    undo();
    expect(P('p-tabique').med).toHaveLength(antes);
  });

  it('con otra obra, otra escala u otra forma de medir: `stale` y nada cambia', () => {
    const r = medir5m('p-tabique');
    const d = destino('p-tabique', r.lineas);
    const antes = JSON.stringify(st().partidas);
    expect(st().addPlanoLines({ destinos: [d], expect: { ...expectDe(plano()), docToken: 'otra' } })).toMatchObject({
      reason: 'stale',
      detalle: { cambio: 'obra' },
    });
    expect(st().addPlanoLines({ destinos: [d], expect: expectDe(plano(), 'otra-rev') })).toMatchObject({
      reason: 'stale',
      detalle: { cambio: 'escala' },
    });
    expect(st().addPlanoLines({ destinos: [d], expect: { ...expectDe(plano()), huella: 'x' } })).toMatchObject({
      reason: 'stale',
      detalle: { cambio: 'plano' },
    });
    expect(
      st().addPlanoLines({ destinos: [{ ...d, expectForma: 'sup' }], expect: expectDe(plano()) }),
    ).toMatchObject({ reason: 'stale', detalle: { cambio: 'forma' } });
    expect(JSON.stringify(st().partidas)).toBe(antes);
    expect(__historyState().past).toBe(0);
    expect(textoResultado({ reason: 'stale', detalle: { cambio: 'escala' } })).toMatch(/escala/);
  });

  it('el cambio a Superficie directa va en el MISMO paso de Deshacer que la medida', () => {
    // una partida L×A sin líneas: Superficie cambia la forma sola
    useObraStore.setState((s) => {
      s.partidas.c01!.push({ ...structuredClone(A0.partidas.c01![2]!), id: 'p-lxa', med: [], medForma: undefined } as Partida);
    });
    __resetHistoryForTests();
    initHistory(useObraStore);
    const r = prepararMedida({
      herramienta: 'superficie',
      puntos: [
        [0, 0],
        [283.46, 0],
        [283.46, 226.77],
      ],
      plano: plano(),
      pagina: 1,
      escala: escalaDe(plano(), 1),
      partida: P('p-lxa'),
      fijas: {},
      restar: false,
      comentario: 'x',
      formaId: 'f-x',
      at: 'x',
    });
    expect(r.ok && r.cambioForma).toBe('area');
    if (!r.ok) return;
    st().addPlanoLines({ destinos: [destino('p-lxa', r.lineas, 'area')], expect: expectDe(plano()) });
    expect(P('p-lxa').medForma).toBe('area');
    expect(__historyState().past).toBe(1);
    undo();
    expect(P('p-lxa').medForma).toBeUndefined();
    expect(P('p-lxa').med).toHaveLength(0);
  });

  it('attach / rename / label / remove: un paso cada una; con otro docToken, `stale`', () => {
    const meta: PlanoMeta = { ...structuredClone(plano()), id: 'pl-2', nombre: 'Cubierta', escalas: {}, huella: 'h2' };
    expect(st().attachPlano({ meta, expect: { docToken: 'otra' } })).toMatchObject({ reason: 'stale' });
    expect(st().attachPlano({ meta, expect: doc() })).toEqual({ ids: ['pl-2'] });
    expect(st().renamePlano({ planoId: 'pl-2', nombre: '  Cubierta N  ', expect: doc() })).toEqual({ ids: ['pl-2'] });
    expect(st().setPlanoPageLabel({ planoId: 'pl-2', pagina: 1, etiqueta: 'CU', expect: doc() })).toEqual({ ids: ['pl-2'] });
    expect(st().removePlano({ planoId: 'pl-2', expect: doc() })).toEqual({ ids: ['pl-2'] });
    expect(st().planos[1]).toMatchObject({ nombre: 'Cubierta N', etiquetas: { 1: 'CU' } });
    expect(st().planos[1]!.quitado).toBeTruthy();
    expect(__historyState().past).toBe(4);
    undo();
    expect(st().planos[1]!.quitado).toBeUndefined();
  });
});

describe('escala', () => {
  const escalaNueva = (): Escala => ({ ...structuredClone(escalaDe(plano(), 1)!), rev: 'cal-2', n: 100, mPorUnidad: 0.0352777 });

  it('con líneas medidas con escala: `has-lines` y la escala no cambia', () => {
    const res = st().setPlanoPageScale({ planoId: plano().id, pagina: 1, escala: escalaNueva(), expect: doc() });
    expect(res).toEqual({ ids: [], reason: 'has-lines', detalle: { n: 6 } });
    expect(escalaDe(plano(), 1)!.rev).toBe('cal-p1-1');
    expect(textoResultado(res)).toBe(
      'Esta página ya tiene 6 líneas medidas con esta escala. Recalcularlas llega más adelante; para medir a otra escala, adjunta el PDF otra vez.',
    );
  });

  it('con solo líneas de Recuento, calibra (se puede contar antes de calibrar)', () => {
    useObraStore.setState((s) => {
      for (const ps of Object.values(s.partidas))
        for (const p of ps) p.med = p.med.filter((l) => (l.origen as OrigenPlano | undefined)?.herramienta === 'recuento');
    });
    expect(st().setPlanoPageScale({ planoId: plano().id, pagina: 1, escala: escalaNueva(), expect: doc() })).toEqual({
      ids: [plano().id],
    });
    expect(escalaDe(plano(), 1)!.rev).toBe('cal-2');
  });
});

describe('quitar y volver a adjuntar', () => {
  it('quitar deja las líneas con sus números y `origen`; adjuntar la misma huella lo revive', () => {
    const id = plano().id;
    st().removePlano({ planoId: id, expect: doc() });
    expect(P('p-tabique').med[0]!.largo).toBe(9.45);
    expect((P('p-tabique').med[0]!.origen as OrigenPlano).planoId).toBe(id);
    const res = st().attachPlano({ meta: { ...structuredClone(plano()), id: 'pl-nuevo', quitado: undefined }, expect: doc() });
    expect(res).toEqual({ ids: [id] });
    expect(st().planos).toHaveLength(1);
    expect(plano().quitado).toBeUndefined();
    expect(escalaDe(plano(), 1)!.rev).toBe('cal-p1-1');
  });

  it('«Adjuntar otra vez (para otra escala)»: otro plano con los mismos bytes', () => {
    const res = st().attachPlano({ meta: { ...structuredClone(plano()), id: 'pl-detalle', escalas: {} }, expect: doc(), nuevo: true });
    expect(res).toEqual({ ids: ['pl-detalle'] });
    expect(st().planos.map((p) => p.huella)).toEqual([plano().huella, plano().huella]);
  });

  it('quitar → Deshacer → el plano vuelve (la capa se ve otra vez)', () => {
    st().removePlano({ planoId: plano().id, expect: doc() });
    undo();
    expect(plano().quitado).toBeUndefined();
  });
});

describe('«Volver a medir»', () => {
  const linea = () => P('p-tabique').med[0]!;
  const valores = () => {
    const l = linea();
    return { comment: l.comment, uds: l.uds, largo: l.largo, ancho: l.ancho, alto: l.alto };
  };
  const remedir = (over: Record<string, unknown> = {}) => {
    const r = medir5m('p-tabique', { formaId: 'f-otra', comentario: linea().comment });
    return st().remeasureLine({
      lineId: 'l-tabique',
      preparada: r.lineas[0]!,
      expect: { ...expectDe(plano()), expectForma: 'lin', expectUd: 'm', valores: valores(), ...over },
    });
  };

  it('sustituye valores, `expr` y `origen` con una `formaId` nueva; el id y `uds` se conservan', () => {
    useObraStore.setState((s) => {
      s.partidas.c01![0]!.med[0]!.uds = 2; // un 2 tecleado
    });
    expect(remedir()).toEqual({ ids: ['l-tabique'] });
    expect(linea()).toMatchObject({ id: 'l-tabique', uds: 2, largo: 5, expr: { largo: '5' } });
    expect((linea().origen as OrigenPlano).formaId).toBe('f-otra');
    expect(__historyState().past).toBe(2);
  });

  it('sobre una línea certificada pasa por la guarda de certificadas', () => {
    st().setCurCert(0);
    st().setCertLine('p-tabique', 'l-tabique', 9.45);
    const r = remedir();
    expect(r).toMatchObject({ reason: 'certificada', detalle: { linea: 1 } });
    expect(linea().largo).toBe(9.45);
    expect(textoResultado(r)).toMatch(/^La línea 1 está certificada en C1/);
    expect(remedir({ certificadaOk: true })).toEqual({ ids: ['l-tabique'] });
  });

  it('si la línea cambió mientras se medía: `stale`', () => {
    const r = medir5m('p-tabique', { formaId: 'f-otra' });
    const v = valores();
    st().editMedLine('c01', 'p-tabique', 0, 'comment', 'retocado');
    expect(
      st().remeasureLine({
        lineId: 'l-tabique',
        preparada: r.lineas[0]!,
        expect: { ...expectDe(plano()), expectForma: 'lin', expectUd: 'm', valores: v },
      }),
    ).toMatchObject({ reason: 'stale', detalle: { cambio: 'linea' } });
  });
});

describe('formaId: una forma, una geometría', () => {
  /** Misma `formaId` ⇒ mismos plano, página, herramienta y puntos, en toda la obra. */
  function invariante(): void {
    const vistas = new Map<string, string>();
    for (const ps of Object.values(st().partidas))
      for (const p of ps)
        for (const l of p.med) {
          const o = l.origen as OrigenPlano | undefined;
          if (!o) continue;
          const clave = JSON.stringify([o.planoId, o.pagina, o.herramienta, o.puntos]);
          expect(vistas.get(o.formaId) ?? clave, o.formaId).toBe(clave);
          vistas.set(o.formaId, clave);
        }
  }

  it('duplicar da una forma nueva; el invariante se mantiene', () => {
    const r = st().duplicateMedLines('c01', 'p-tabique', ['l-tabique']);
    const copia = P('p-tabique').med.find((l) => l.id === r.ids[0])!;
    expect((copia.origen as OrigenPlano).formaId).not.toBe('f-tabique');
    expect((copia.origen as OrigenPlano).puntos).toEqual((P('p-tabique').med[0]!.origen as OrigenPlano).puntos);
    invariante();
  });

  it('copiar y pegar da una forma nueva; mover (cortar y pegar) la conserva', () => {
    copyLines('p-tabique', ['l-tabique']);
    pasteLines('p-tabique', null, { authority: true });
    const pegada = P('p-tabique').med.at(-1)!;
    expect((pegada.origen as OrigenPlano).formaId).not.toBe('f-tabique');
    invariante();
    // cortar la original y pegarla en la partida de vigas (misma forma de columnas: lin → peso no; usar otra lin)
    useObraStore.setState((s) => {
      s.partidas.c01!.push({ ...structuredClone(A0.partidas.c01![0]!), id: 'p-tab2', med: [] } as Partida);
    });
    copyLines('p-tabique', ['l-tabique'], { cut: true });
    pasteLines('p-tab2', null, { authority: true });
    const movida = P('p-tab2').med[0]!;
    expect((movida.origen as OrigenPlano).formaId).toBe('f-tabique');
    invariante();
  });

  it('pegar en una obra sin el plano, o en otra forma de medir, quita el `origen` y conserva los números', () => {
    copyLines('p-tabique', ['l-tabique']);
    // otra forma de medir: la partida de solado (Superficie directa, m²)
    pasteLines('p-solado', null, { authority: true });
    const rev = useMedUiStore.getState().review;
    expect(rev?.kind).toBe('paste');
    if (rev?.kind === 'paste') applyPaste(rev.prep);
    const enSolado = P('p-solado').med.at(-1)!;
    expect(enSolado.largo).toBe(9.45);
    expect(enSolado.origen).toBeUndefined();
    // otra obra (sin ese plano)
    const clip = useClipboardStore.getState().medLines!;
    st().loadObra(fromSerializable({ ...structuredClone(A0), planos: [] }));
    useClipboardStore.getState().setMedClip(clip);
    pasteLines('p-tabique', null, { authority: true });
    const enOtra = P('p-tabique').med.at(-1)!;
    expect(enOtra.largo).toBe(9.45);
    expect(enOtra.origen).toBeUndefined();
  });
});

describe('textos de motivos (uno por motivo)', () => {
  it.each([
    ['no-partida', 'La partida ya no existe.'],
    ['no-plano', 'Ese plano ya no está en la obra.'],
    ['sin-calibrar', 'Calibra esta página para medir longitudes y superficies. Recuento funciona sin escala.'],
  ] as const)('%s', (reason, texto) => {
    expect(textoResultado({ reason })).toBe(texto);
  });
  it('pegar conserva sus textos', () => {
    expect(textoResultado({ reason: 'no-partida' }, 'pegar')).toBe('No se pudo pegar: la partida ya no existe');
  });
});


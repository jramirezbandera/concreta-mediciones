/* Acciones de líneas de medición por id (plan «reordenar, copiar y duplicar
   líneas de medición»): reordenan conservando ids, copian con ids nuevos, cada
   una es UN paso de Deshacer y un no-op no toca nada (ni historial ni BASE). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MedLine } from '../core/types';
import { useObraStore, useToastStore } from './index';
import { applyPaste, copyLines, pasteLines } from './medLineOps';
import { useClipboardStore } from './clipboardStore';
import { useMedUiStore } from './medUiStore';
import {
  __historyState,
  __resetHistoryForTests,
  __setThrottleMsForTests,
  getDomainRevision,
  initHistory,
  undo,
} from './temporal';

const st = () => useObraStore.getState();
const P = (id: string) => Object.values(st().partidas).flat().find((p) => p.id === id)!;
const ids = (id: string) => P(id).med.map((l) => l.id);

beforeEach(() => {
  __resetHistoryForTests();
  st().reset();
  useClipboardStore.getState().clear();
  useMedUiStore.getState().reset();
  useToastStore.getState().clear();
  initHistory(useObraStore);
});
afterEach(() => {
  __resetHistoryForTests();
  vi.useRealTimers();
});

describe('moveMedLine — reordenar una línea', () => {
  it('la coloca delante de otra CONSERVANDO los ids (la cert por líneas la sigue viendo)', () => {
    const [a, b] = ids('p111');
    st().setCertLine('p111', b!, 5); // certificada antes de reordenar
    const r = st().moveMedLine('01', 'p111', b!, a!);
    expect(r).toEqual({ ids: [b] });
    expect(ids('p111')).toEqual([b, a]);
    expect(st().certs[st().curCert]!.lineQty?.p111?.[b!]).toBe(5);
    expect(P('p111').fromBase).toBe(false);
  });

  it('soltar en su sitio es no-op: sin entrada de Deshacer y sin quitar el chip BASE', () => {
    __resetHistoryForTests();
    useObraStore.setState((s) => {
      s.partidas['01']!.find((p) => p.id === 'p111')!.fromBase = true;
    });
    initHistory(useObraStore);
    const [a, b] = ids('p111');
    expect(st().moveMedLine('01', 'p111', a!, b!)).toEqual({ ids: [], reason: 'noop' });
    expect(__historyState().past).toBe(0);
    expect(P('p111').fromBase).toBe(true);
  });

  it('busca la partida por id aunque el capítulo indicado sea otro', () => {
    const [a, b] = ids('p111');
    expect(st().moveMedLine('02', 'p111', b!, a!).ids).toEqual([b]);
    expect(st().moveMedLine('01', 'nope', b!, a!).reason).toBe('no-partida');
  });
});

describe('moveMedLinesBy — subir/bajar un bloque', () => {
  it('sube una línea y en el borde no hace nada', () => {
    const [a, b] = ids('p111');
    expect(st().moveMedLinesBy('01', 'p111', [b!], -1).ids).toEqual([b]);
    expect(ids('p111')).toEqual([b, a]);
    expect(st().moveMedLinesBy('01', 'p111', [b!], -1).reason).toBe('noop');
  });
});

describe('insertMedLines — pegar copias', () => {
  const src = (): MedLine[] => [
    { id: 'orig-1', comment: 'Uno', uds: 2, largo: 3, ancho: '', alto: '', expr: { uds: '1+1' } },
    { id: 'orig-2', comment: 'Dos', uds: 1, largo: 4, ancho: '', alto: '' },
  ];

  it('inserta COPIAS con ids nuevos detrás del ancla, `expr` copiado en profundidad', () => {
    const [a, b] = ids('p112');
    const lines = src();
    const r = st().insertMedLines('01', 'p112', lines, a!);
    expect(r.ids).toHaveLength(2);
    expect(r.ids).not.toContain('orig-1');
    expect(ids('p112')).toEqual([a, ...r.ids, b]);
    const pegada = P('p112').med[1]!;
    expect(pegada).toMatchObject({ comment: 'Uno', uds: 2, largo: 3, expr: { uds: '1+1' } });
    expect(pegada.expr).not.toBe(lines[0]!.expr);
  });

  it('sin ancla (o con un ancla que no está) pega al final', () => {
    const before = ids('p112');
    const r = st().insertMedLines('01', 'p112', src(), 'fantasma');
    expect(ids('p112')).toEqual([...before, ...r.ids]);
  });

  it('en un destino por Peso rellena el kg/m del perfil del comentario', () => {
    st().setMedForma('01', 'p112', 'peso');
    const r = st().insertMedLines('01', 'p112', [{ id: 'x', comment: 'IPE300', uds: 2, largo: 9.5, ancho: '', alto: '' }], null);
    const l = P('p112').med.find((m) => m.id === r.ids[0])!;
    expect(l.ancho).toBeCloseTo(42.2, 1);
  });

  it('partida inexistente o nada que pegar → motivo, sin tocar nada', () => {
    expect(st().insertMedLines('01', 'nope', src(), null)).toEqual({ ids: [], reason: 'no-partida' });
    expect(st().insertMedLines('01', 'p112', [], null)).toEqual({ ids: [], reason: 'no-lines' });
    expect(__historyState().past).toBe(0);
  });
});

describe('duplicateMedLines / deleteMedLines', () => {
  it('duplicar deja las copias justo detrás de la ÚLTIMA indicada, en su orden', () => {
    const [a, b] = ids('p112');
    const r = st().duplicateMedLines('01', 'p112', [b!, a!]);
    expect(ids('p112')).toEqual([a, b, ...r.ids]);
    expect(P('p112').med[2]!.comment).toBe(P('p112').med[0]!.comment);
  });

  it('borrar en bloque; ids que no existen → no-lines', () => {
    const [a, b] = ids('p112');
    expect(st().deleteMedLines('01', 'p112', [a!, 'fantasma']).ids).toEqual([a]);
    expect(ids('p112')).toEqual([b]);
    expect(st().deleteMedLines('01', 'p112', ['fantasma']).reason).toBe('no-lines');
  });
});

describe('historial: cada acción estructural es UN paso de Deshacer', () => {
  it('editar y pegar a menos de 700 ms: Deshacer revierte SOLO el pegado', () => {
    __setThrottleMsForTests(700);
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    st().editMedLine('01', 'p112', 0, 'comment', 'Editado');
    vi.setSystemTime(1200);
    st().insertMedLines('01', 'p112', [{ id: 'x', comment: 'Pegada', uds: 1, largo: '', ancho: '', alto: '' }], null);
    expect(P('p112').med).toHaveLength(3);
    undo();
    expect(P('p112').med).toHaveLength(2);
    expect(P('p112').med[0]!.comment).toBe('Editado'); // la edición ajena sigue
  });

  it('reordenar y deshacer vuelve al orden exacto', () => {
    const before = ids('p111');
    st().moveMedLinesBy('01', 'p111', [before[1]!], -1);
    undo();
    expect(ids('p111')).toEqual(before);
  });
});

describe('aviso con Deshacer atado a la revisión del dominio', () => {
  it('pegar y editar a <700 ms: el aviso deja de ofrecer Deshacer', () => {
    __setThrottleMsForTests(700);
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    expect(copyLines('p111', ids('p111'))).toBe(true);
    pasteLines('p112', null);
    const t = useToastStore.getState();
    expect(t.action?.label).toBe('Deshacer');
    expect(t.rev).toBe(getDomainRevision());
    vi.setSystemTime(1200);
    st().editMedLine('01', 'p112', 0, 'comment', 'Otra cosa');
    expect(useToastStore.getState().msg).toBeNull(); // descartado
    expect(useToastStore.getState().action).toBeNull();
  });

  it('el run guardado no deshace una edición posterior', () => {
    copyLines('p111', ids('p111'));
    pasteLines('p112', null);
    const run = useToastStore.getState().action!.run;
    st().editMedLine('01', 'p112', 0, 'comment', 'Posterior');
    run(); // botón viejo: no debe deshacer «Posterior»
    expect(P('p112').med[0]!.comment).toBe('Posterior');
    expect(P('p112').med).toHaveLength(4);
  });

  it('el Deshacer del aviso revierte el pegado entero', () => {
    copyLines('p111', ids('p111'));
    pasteLines('p112', null);
    expect(P('p112').med).toHaveLength(4);
    useToastStore.getState().action!.run();
    expect(P('p112').med).toHaveLength(2);
  });
});

describe('medLineOps — pegar', () => {
  it('lo pegado queda seleccionado y el aviso dice la cantidad A → B', () => {
    copyLines('p111', [ids('p111')[0]!]);
    pasteLines('p112', null);
    const ui = useMedUiStore.getState();
    expect(ui.partidaId).toBe('p112');
    expect(ui.selected).toEqual([ids('p112')[2]]);
    expect(useToastStore.getState().msg).toMatch(/^1 línea pegada en E02SZ070 · .+ → .+ m³$/);
  });

  it('en una partida con cantidad fija dice «cantidad fija A → medida B»', () => {
    st().deleteMedLines('01', 'p112', ids('p112'));
    st().setCantidad('01', 'p112', 7);
    copyLines('p111', [ids('p111')[0]!]);
    pasteLines('p112', null);
    expect(useToastStore.getState().msg).toMatch(/cantidad fija 7,00 → medida/);
  });

  it('formas incompatibles abren el diálogo en vez de pegar; aplicar lo pega', () => {
    st().setMedForma('01', 'p111', 'peso');
    copyLines('p111', ids('p111'));
    pasteLines('p112', null); // p112 mide por volumen (m³)
    const review = useMedUiStore.getState().review;
    expect(review?.kind).toBe('paste');
    expect(P('p112').med).toHaveLength(2); // aún nada
    if (review?.kind === 'paste') applyPaste(review.prep);
    expect(P('p112').med).toHaveLength(4);
  });

  it('copiar líneas vacía las partidas copiadas, y viceversa', () => {
    useClipboardStore.getState().setClip([], 'Obra');
    copyLines('p111', ids('p111'));
    expect(useClipboardStore.getState().items).toBeNull();
    useClipboardStore.getState().setClip([], 'Obra');
    expect(useClipboardStore.getState().medLines).toBeNull();
  });

  it('la selección se poda tras deshacer', () => {
    copyLines('p111', ids('p111'));
    pasteLines('p112', null);
    expect(useMedUiStore.getState().selected).toHaveLength(2);
    undo();
    expect(useMedUiStore.getState().selected).toEqual([]);
  });
});

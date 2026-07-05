import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetSyncForTests } from '../persist/sync';
import { ALL, blankObraData, useObraStore, useToastStore } from './index';
import {
  __historyState,
  __resetHistoryForTests,
  __setThrottleMsForTests,
  initHistory,
  redo,
  undo,
  useHistoryStore,
} from './temporal';

const state = () => useObraStore.getState();
const allPartidas = () => Object.values(state().partidas).flat();
const canUndo = () => useHistoryStore.getState().canUndo;
const canRedo = () => useHistoryStore.getState().canRedo;

beforeEach(() => {
  __resetHistoryForTests(); // desuscribe un historial de un test previo
  state().reset(); // resiembra el dominio demo (8 cap · 9 partidas · 3 certs)
  initHistory(useObraStore); // suscribe con la obra sembrada como línea base
});

afterEach(() => {
  __resetHistoryForTests();
  vi.useRealTimers();
});

describe('temporal — mecánica del historial', () => {
  it('una edición de dominio crea una entrada y undo la restaura', () => {
    expect(canUndo()).toBe(false);
    const before = state().obra.denominacion;
    state().setObraPath('denominacion', 'Cambiada');
    expect(state().obra.denominacion).toBe('Cambiada');
    expect(canUndo()).toBe(true);
    expect(__historyState().past).toBe(1);
    undo();
    expect(state().obra.denominacion).toBe(before);
    expect(canUndo()).toBe(false);
  });

  it('una acción de UI (navegar) NO crea entrada de historial', () => {
    state().setView('resumen');
    state().setActive('02');
    state().togglePartida('p111');
    expect(__historyState().past).toBe(0);
    expect(canUndo()).toBe(false);
  });

  it('throttle leading-edge: una ráfaga = una entrada, undo restaura el valor pre-ráfaga', () => {
    __setThrottleMsForTests(700);
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const before = state().obra.denominacion;
    state().setObraPath('denominacion', 'A');
    state().setObraPath('denominacion', 'AB');
    state().setObraPath('denominacion', 'ABC'); // misma ventana → se coalescen
    expect(state().obra.denominacion).toBe('ABC');
    expect(__historyState().past).toBe(1);
    undo();
    expect(state().obra.denominacion).toBe(before); // pre-ráfaga, no 'AB'
  });

  it('dos ráfagas separadas por más de la ventana = dos entradas', () => {
    __setThrottleMsForTests(700);
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    state().setObraPath('denominacion', 'A');
    vi.setSystemTime(2000); // > 700 ms después
    state().setObraPath('denominacion', 'B');
    expect(__historyState().past).toBe(2);
  });

  it('ventana deslizante: teclear seguido más allá de la ventana inicial sigue siendo UNA entrada', () => {
    __setThrottleMsForTests(700);
    vi.useFakeTimers();
    // Sesión de tecleo continua (~150 ms/pulsación) que CRUZA el límite de la
    // ventana inicial (t=700): sin deslizamiento se partiría en 2 entradas.
    for (let t = 0, i = 0; t <= 1800; t += 150, i++) {
      vi.setSystemTime(t);
      state().setObraPath('denominacion', 'x'.repeat(i + 1));
    }
    expect(__historyState().past).toBe(1);
    undo();
    expect(state().obra.denominacion).not.toMatch(/^x+$/); // valor pre-sesión
  });

  it('respeta el límite de profundidad (descarta la entrada más vieja)', () => {
    __setThrottleMsForTests(0); // cada edición = una entrada
    for (let i = 0; i < 30; i++) state().setObraPath('denominacion', `v${i}`);
    expect(__historyState().past).toBe(25); // LIMIT
  });

  it('redo rehace lo deshecho; una edición nueva invalida el redo', () => {
    const before = state().obra.denominacion;
    state().setObraPath('denominacion', 'X');
    undo();
    expect(state().obra.denominacion).toBe(before);
    expect(canRedo()).toBe(true);
    redo();
    expect(state().obra.denominacion).toBe('X');
    expect(canRedo()).toBe(false);
    // Una edición nueva tras un undo invalida el rehacer.
    state().setObraPath('denominacion', 'Y');
    undo();
    expect(canRedo()).toBe(true);
    state().setObraPath('denominacion', 'Z');
    expect(canRedo()).toBe(false);
  });

  it('cargar/cambiar de obra vacía el historial (un undo no cruza obras)', () => {
    state().setObraPath('denominacion', 'Editada');
    expect(canUndo()).toBe(true);
    state().loadObra(blankObraData('Obra B'));
    expect(__historyState().past).toBe(0);
    expect(canUndo()).toBe(false);
    undo(); // no-op: sin historial
    expect(state().obra.denominacion).toBe('Obra B');
  });

  it('undo/redo limpian el toast pendiente (D-08 simétrico: el «Deshacer» del toast no sobrevive al undo)', () => {
    state().setObraPath('denominacion', 'X');
    useToastStore.getState().show('«P» eliminada', { label: 'Deshacer', run: () => {} });
    undo();
    expect(useToastStore.getState().msg).toBeNull();
    expect(useToastStore.getState().action).toBeNull();
    useToastStore.getState().show('otro aviso');
    redo();
    expect(useToastStore.getState().msg).toBeNull();
  });

  it('notify solo escribe en el flanco: los suscriptores NO se notifican por pulsación', () => {
    __setThrottleMsForTests(0); // cada edición = una entrada (peor caso de notify)
    let calls = 0;
    const unsub = useHistoryStore.subscribe(() => {
      calls++;
    });
    state().setObraPath('denominacion', 'a'); // canUndo false→true: notifica
    state().setObraPath('denominacion', 'b'); // true→true: NO notifica
    state().setObraPath('denominacion', 'c'); // true→true: NO notifica
    unsub();
    expect(calls).toBe(1);
  });

  it('__resetSyncForTests también resetea el historial (aislamiento simétrico entre tests)', () => {
    state().setObraPath('denominacion', 'X');
    expect(canUndo()).toBe(true);
    __resetSyncForTests();
    expect(canUndo()).toBe(false);
    expect(__historyState()).toEqual({ past: 0, future: 0 });
    // Y desarma la suscripción: sin re-init, las ediciones nuevas no registran.
    state().setObraPath('denominacion', 'Y');
    expect(canUndo()).toBe(false);
  });
});

describe('temporal — reconciliación de UI tras undo', () => {
  it('undo de addChapter no deja `active` sobre un capítulo inexistente', () => {
    const nCh = state().chapters.length;
    state().addChapter('Nuevo');
    const newId = state().active; // addChapter deja `active` en el capítulo nuevo
    expect(state().chapters.some((c) => c.id === newId)).toBe(true);
    undo();
    expect(state().chapters).toHaveLength(nCh); // el capítulo desaparece
    expect(state().active).toBe(ALL); // reconciliado: no cuelga del borrado
  });

  it('undo de addCert clampa `curCert` dentro del array', () => {
    const nCerts = state().certs.length;
    state().addCert();
    expect(state().certs).toHaveLength(nCerts + 1);
    expect(state().curCert).toBe(nCerts); // addCert deja curCert en la nueva
    undo();
    expect(state().certs).toHaveLength(nCerts);
    expect(state().curCert).toBe(nCerts - 1); // clampado al último válido
  });
});

describe('temporal — integración con «Completar»', () => {
  it('undo revierte «Completar la obra» (masiva) restaurando data y lineQty exactos', () => {
    __setThrottleMsForTests(0); // setCertLine y completePartidas = entradas distintas
    state().setCurCert(0);
    const p = allPartidas().find((x) => x.id === 'p111')!;
    state().setCertLine('p111', p.med[0]!.id, 3); // marca UNA línea ANTES de completar
    const dataBefore = state().certs[0]!.data;
    const lineQtyBefore = state().certs[0]!.lineQty;
    expect(lineQtyBefore?.p111).toBeDefined();

    state().completePartidas(allPartidas().map((x) => x.id)); // masiva: 100% a origen
    expect(state().certs[0]!.data).not.toBe(dataBefore); // completar cambió el estado

    undo();
    expect(state().certs[0]!.data).toEqual(dataBefore); // data restaurada EXACTA
    expect(state().certs[0]!.lineQty).toEqual(lineQtyBefore); // marcado por líneas EXACTO
  });
});

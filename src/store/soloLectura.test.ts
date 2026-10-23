/* Pestaña de solo lectura (T-19): el store rechaza las ediciones de la obra y lo
   avisa; la navegación, las cargas de la persistencia y la vuelta a dueña no. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSessionStore } from '../persist/sessionStore';
import { __resetSyncForTests } from '../persist/sync';
import { blankObraData, permitirCarga, useObraStore, useToastStore } from './index';
import { __historyState, __resetHistoryForTests, initHistory, undo } from './temporal';

const state = () => useObraStore.getState();
const toast = () => useToastStore.getState();
const soloLectura = () => useSessionStore.getState().setReadonly(true, 'otra-pestana');
const microtask = () => Promise.resolve();

beforeEach(() => {
  __resetSyncForTests();
  __resetHistoryForTests();
  state().reset(); // obra demo, con la pestaña aún dueña
  initHistory(useObraStore);
  toast().clear();
});

afterEach(() => {
  __resetSyncForTests(); // devuelve la sesión a dueña para el resto de specs
  __resetHistoryForTests();
});

describe('soloLectura — el store no edita la obra', () => {
  it('rechaza una edición de dominio y lo explica con un aviso', async () => {
    const antes = state().obra.denominacion;
    soloLectura();
    state().setObraPath('denominacion', 'Cambiada');
    expect(state().obra.denominacion).toBe(antes);
    await microtask();
    expect(toast().msg).toBe('Esta obra está abierta en otra pestaña: aquí solo se puede ver.');
    expect(toast().tone).toBe('warn');
  });

  it('rechaza la acción entera, también su parte de interfaz', () => {
    const capitulos = state().chapters.length;
    const activo = state().active;
    soloLectura();
    state().addChapter('Nuevo'); // alta + seleccionarlo: atómica
    expect(state().chapters).toHaveLength(capitulos);
    expect(state().active).toBe(activo);
  });

  it('deja navegar: cambiar de vista o de capítulo no toca la obra', () => {
    soloLectura();
    state().setView('resumen');
    state().setActive('02');
    expect(state().view).toBe('resumen');
    expect(state().active).toBe('02');
  });

  it('una ráfaga de ediciones rechazadas enseña un solo aviso, el último en pantalla', async () => {
    soloLectura();
    state().setObraPath('denominacion', 'A');
    toast().show('Línea pegada'); // el aviso de éxito que la acción enseñaría después
    state().setObraPath('denominacion', 'AB');
    const tick = toast().tick;
    await microtask();
    expect(toast().tick).toBe(tick + 1);
    expect(toast().msg).toMatch(/solo se puede ver/);
  });

  it('la persistencia sí carga una obra (traspaso, conmutar)', () => {
    soloLectura();
    permitirCarga(() => state().loadObra(blankObraData('Leída de disco')));
    expect(state().obra.denominacion).toBe('Leída de disco');
    state().setObraPath('denominacion', 'Editada'); // fuera de la carga, sigue bloqueada
    expect(state().obra.denominacion).toBe('Leída de disco');
  });

  it('Deshacer no toca las pilas en solo lectura y vuelve a funcionar como dueña', () => {
    const antes = state().obra.denominacion;
    state().setObraPath('denominacion', 'Cambiada');
    expect(__historyState().past).toBe(1);
    soloLectura();
    undo();
    expect(state().obra.denominacion).toBe('Cambiada');
    expect(__historyState()).toEqual({ past: 1, future: 0 });
    useSessionStore.getState().setReadonly(false);
    undo();
    expect(state().obra.denominacion).toBe(antes);
  });

  it('el motivo cambia el aviso: obra guardada por una versión más nueva', async () => {
    useSessionStore.getState().setReadonly(true, 'mas-nueva');
    state().setObraPath('denominacion', 'X');
    await microtask();
    expect(toast().msg).toMatch(/versión más nueva/);
  });
});

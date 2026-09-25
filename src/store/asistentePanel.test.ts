import { beforeEach, describe, expect, it } from 'vitest';
import { useObraStore } from './obraStore';

beforeEach(() => {
  useObraStore.getState().reset();
});

describe('panel del asistente ↔ Referencia (regla única del hueco lateral, D4)', () => {
  it('arranca cerrado', () => {
    expect(useObraStore.getState().lateral).toBeNull();
  });

  it('abrir el asistente pliega Referencia (y su pantalla completa)', () => {
    useObraStore.getState().setRefOpen(true);
    useObraStore.getState().setRefMax(true);
    expect(useObraStore.getState().lateral).toBe('ref');
    useObraStore.getState().setAsistenteOpen(true);
    expect(useObraStore.getState().lateral).toBe('asistente');
    expect(useObraStore.getState().refMaximized).toBe(false);
  });

  it('abrir Referencia pliega el asistente', () => {
    useObraStore.getState().setAsistenteOpen(true);
    useObraStore.getState().setRefOpen(true);
    expect(useObraStore.getState().lateral).toBe('ref');
  });

  it('sin argumento alterna', () => {
    useObraStore.getState().setAsistenteOpen();
    expect(useObraStore.getState().lateral).toBe('asistente');
    useObraStore.getState().setAsistenteOpen();
    expect(useObraStore.getState().lateral).toBeNull();
  });

  it('cerrar un panel que no está abierto no toca el otro', () => {
    useObraStore.getState().setAsistenteOpen(true);
    useObraStore.getState().setRefOpen(false);
    expect(useObraStore.getState().lateral).toBe('asistente');
  });

  it('cargar otra obra cierra el asistente', () => {
    useObraStore.getState().setAsistenteOpen(true);
    useObraStore.getState().reset();
    expect(useObraStore.getState().lateral).toBeNull();
  });
});

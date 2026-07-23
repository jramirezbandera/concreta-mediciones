import { beforeEach, describe, expect, it } from 'vitest';
import { useObraStore } from './obraStore';

beforeEach(() => {
  useObraStore.getState().reset();
});

describe('panel del asistente ↔ Referencia (regla única del hueco lateral, D4)', () => {
  it('arranca cerrado', () => {
    expect(useObraStore.getState().asistenteOpen).toBe(false);
    expect(useObraStore.getState().refOpen).toBe(false);
  });

  it('abrir el asistente pliega Referencia', () => {
    useObraStore.getState().setRefOpen(true);
    expect(useObraStore.getState().refOpen).toBe(true);
    useObraStore.getState().setAsistenteOpen(true);
    expect(useObraStore.getState().asistenteOpen).toBe(true);
    expect(useObraStore.getState().refOpen).toBe(false);
  });

  it('abrir Referencia pliega el asistente (y su pantalla completa)', () => {
    useObraStore.getState().setAsistenteOpen(true);
    useObraStore.getState().setRefOpen(true);
    expect(useObraStore.getState().refOpen).toBe(true);
    expect(useObraStore.getState().asistenteOpen).toBe(false);
  });

  it('sin argumento alterna', () => {
    useObraStore.getState().setAsistenteOpen();
    expect(useObraStore.getState().asistenteOpen).toBe(true);
    useObraStore.getState().setAsistenteOpen();
    expect(useObraStore.getState().asistenteOpen).toBe(false);
  });

  it('cargar otra obra cierra el asistente', () => {
    useObraStore.getState().setAsistenteOpen(true);
    useObraStore.getState().reset();
    expect(useObraStore.getState().asistenteOpen).toBe(false);
  });
});

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToastStore } from '../store';
import { PersistUI } from './PersistUI';
import { usePersistStore } from './persistStore';
import { useSessionStore } from './sessionStore';

const reloadToLatest = vi.hoisted(() => vi.fn());
vi.mock('../update/appVersion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../update/appVersion')>()),
  reloadToLatest,
}));

beforeEach(() => {
  reloadToLatest.mockReset();
  usePersistStore.setState({ recovery: null, recoveryKey: null, masNueva: null, status: 'idle' });
  useSessionStore.setState({ activeId: 'a', obras: [], readonly: false, readonlyMotivo: null });
  useToastStore.setState({ msg: null, action: null, tick: 0 });
});
afterEach(() => {
  useSessionStore.setState({ activeId: null, readonly: false, readonlyMotivo: null });
});

describe('PersistUI · obra de una versión más nueva (Etapa 0)', () => {
  it('la obra en pantalla: pide recargar, sin «Descartar» y sin el aviso de otra pestaña', () => {
    usePersistStore.setState({ masNueva: { id: 'a', nombre: 'A' } });
    useSessionStore.getState().setReadonly(true, 'mas-nueva');
    render(<PersistUI />);
    expect(
      screen.getByText(/Esta obra se guardó con una versión más nueva de Concreta: recarga la página/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Descartar/ })).toBeNull();
    expect(screen.queryByText(/abierta en otra pestaña/)).toBeNull();
  });

  it('otra obra (la de pantalla se abrió en su lugar): la nombra', () => {
    usePersistStore.setState({ masNueva: { id: 'v7', nombre: 'Reforma ático' } });
    render(<PersistUI />);
    expect(screen.getByText(/La obra «Reforma ático» se guardó con una versión más nueva/)).toBeInTheDocument();
  });

  it('«Recargar» guarda y recarga; si no puede, lo dice y se puede reintentar', async () => {
    usePersistStore.setState({ masNueva: { id: 'a', nombre: 'A' } });
    reloadToLatest.mockResolvedValue('sin-red');
    render(<PersistUI />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Recargar' }));
    });
    expect(reloadToLatest).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().msg).toMatch(/Sin conexión/);
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeEnabled();
  });
});

describe('PersistUI · motivo de la solo lectura', () => {
  it('otra pestaña', () => {
    useSessionStore.getState().setReadonly(true);
    render(<PersistUI />);
    expect(screen.getByText(/abierta en otra pestaña/)).toBeInTheDocument();
  });

  it('heredada pero sin poder releerla', () => {
    useSessionStore.getState().setReadonly(true, 'sin-recargar');
    render(<PersistUI />);
    expect(screen.getByText(/no se pudo volver a leer/)).toBeInTheDocument();
    expect(screen.queryByText(/abierta en otra pestaña/)).toBeNull();
  });
});

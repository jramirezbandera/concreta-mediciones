import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToastStore } from '../store';
import type { ReloadResult } from './appVersion';
import { UpdatePrompt } from './UpdatePrompt';
import { useUpdateStore } from './updateStore';

const reloadToLatest = vi.hoisted(() => vi.fn<() => Promise<ReloadResult>>());
vi.mock('./appVersion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./appVersion')>()),
  reloadToLatest,
}));

describe('UpdatePrompt', () => {
  beforeEach(() => {
    useUpdateStore.setState({ latest: null, broken: false, snoozed: null });
    reloadToLatest.mockReset();
  });

  it('no pinta nada mientras la app está al día', () => {
    const { container } = render(<UpdatePrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('aparece al detectar un build nuevo, sin robar el foco', () => {
    render(<UpdatePrompt />);
    act(() => useUpdateStore.getState().found('new'));
    expect(screen.getByText('Nueva versión disponible')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar' })).not.toHaveFocus();
  });

  it('«Más tarde» lo cierra', () => {
    useUpdateStore.getState().found('new');
    render(<UpdatePrompt />);
    fireEvent.click(screen.getByRole('button', { name: 'Más tarde' }));
    expect(screen.queryByText('Nueva versión disponible')).toBeNull();
  });

  it('explica el motivo cuando un chunk ya no carga', () => {
    useUpdateStore.getState().found('new', true);
    render(<UpdatePrompt />);
    expect(screen.getByText(/parte de la app ya no carga/)).toBeInTheDocument();
  });

  it('«Actualizar» recarga y queda en espera', async () => {
    reloadToLatest.mockReturnValue(new Promise(() => {})); // la página se recarga
    useUpdateStore.getState().found('new');
    render(<UpdatePrompt />);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(reloadToLatest).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Actualizando/ })).toBeDisabled();
  });

  it('sin red: vuelve a habilitarse y lo avisa', async () => {
    reloadToLatest.mockResolvedValue('sin-red');
    useUpdateStore.getState().found('new');
    render(<UpdatePrompt />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    });
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled();
    expect(useToastStore.getState().msg).toMatch(/no se pudo actualizar/);
  });

  it('guardado fallido: no recarga, vuelve a habilitarse y dice por qué', async () => {
    reloadToLatest.mockResolvedValue('sin-guardar');
    useUpdateStore.getState().found('new');
    render(<UpdatePrompt />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    });
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled();
    expect(useToastStore.getState().msg).toMatch(/no se ha recargado para no perderlos/);
  });
});

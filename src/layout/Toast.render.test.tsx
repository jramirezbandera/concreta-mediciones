/* El aviso transitorio es REACTIVO al store: antes cacheaba mensaje y acción, y
   un `clear()` (deshacer, cambiar de obra) dejaba a la vista un «Deshacer» que
   ya no hacía nada. Y los avisos de siempre siguen apareciendo (regresión). */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deletePartidaWithUndo } from '../hooks/usePartidaDelete';
import { blankObraData, useClipboardStore, useObraStore, useToastStore } from '../store';
import { __resetHistoryForTests, initHistory, undo } from '../store/temporal';
import { ClipboardToast } from './ClipboardToast';
import { Toast } from './Toast';

const show = (...args: Parameters<ReturnType<typeof useToastStore.getState>['show']>) =>
  act(() => useToastStore.getState().show(...args));

beforeEach(() => {
  __resetHistoryForTests();
  useObraStore.getState().reset();
  useToastStore.getState().clear();
  useClipboardStore.getState().clear();
  initHistory(useObraStore);
});
afterEach(() => {
  __resetHistoryForTests();
  vi.useRealTimers();
});

describe('Toast — se oculta cuando el store lo descarta', () => {
  it('clear() lo quita de la pantalla (y su Deshacer)', () => {
    render(<Toast />);
    show('Pegadas', { label: 'Deshacer', run: () => {} });
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeInTheDocument();
    act(() => useToastStore.getState().clear());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('un undo() global lo quita', () => {
    render(<Toast />);
    act(() => useObraStore.getState().setObraPath('denominacion', 'X'));
    show('Algo', { label: 'Deshacer', run: () => {} });
    act(() => undo());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('cargar otra obra lo quita', () => {
    render(<Toast />);
    show('Algo', { label: 'Deshacer', run: () => {} });
    act(() => useObraStore.getState().loadObra(blankObraData('Otra')));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('se cierra solo; con el ratón encima, no', () => {
    vi.useFakeTimers();
    render(<Toast />);
    show('Hola');
    fireEvent.mouseEnter(screen.getByRole('status'));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole('status')).toHaveTextContent('Hola');
    fireEvent.mouseLeave(screen.getByRole('status'));
    act(() => vi.advanceTimersByTime(2300));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('el tono de error se anuncia como alerta', () => {
    render(<Toast />);
    show('No se pudo pegar', undefined, { tone: 'error' });
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo pegar');
  });
});

describe('avisos de siempre (regresión)', () => {
  it('«<código> copiada al portapapeles» al copiar una partida', () => {
    render(
      <>
        <ClipboardToast />
        <Toast />
      </>,
    );
    const p = useObraStore.getState().partidas['01']![0]!;
    act(() => useClipboardStore.getState().setClip([{ sourceName: 'Obra', partida: { ...p, items: [] } }], 'Obra'));
    expect(screen.getByRole('status')).toHaveTextContent(`${p.code} copiada al portapapeles`);
  });

  it('borrar una partida ofrece Deshacer y lo aplica', () => {
    render(<Toast />);
    const n = useObraStore.getState().partidas['01']!.length;
    act(() => deletePartidaWithUndo('01', 'p111'));
    expect(useObraStore.getState().partidas['01']!).toHaveLength(n - 1);
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(useObraStore.getState().partidas['01']!).toHaveLength(n);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

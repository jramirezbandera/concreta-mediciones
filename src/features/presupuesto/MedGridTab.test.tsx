import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useObraStore } from '../../store';
import { __resetHistoryForTests, initHistory, undo } from '../../store/temporal';
import type { Partida } from '../../core/types';
import { DetailPanel } from './DetailPanel';

// Harness suscrito al store: la partida (y sus líneas) se actualizan al editar,
// para poder probar el autofocus a la fila creada por Tab/Enter al final.
function Harness() {
  const p = useObraStore((s) => s.partidas['01']!.find((x) => x.id === 'p111')!) as Partida;
  return <DetailPanel p={p} chapterId="01" />;
}

const med = () => useObraStore.getState().partidas['01']!.find((x) => x.id === 'p111')!.med;

beforeEach(() => {
  useObraStore.getState().reset();
});

describe('Tab/Enter editable en líneas de medición', () => {
  it('Tab pasa a la celda siguiente y la deja EN EDICIÓN con foco', () => {
    render(<Harness />);
    fireEvent.click(screen.getAllByLabelText('Unidades')[0]!); // abre uds de la 1ª línea
    const uds = screen.getAllByLabelText('Unidades')[0]!;
    expect(uds.tagName).toBe('INPUT');
    fireEvent.keyDown(uds, { key: 'Tab' });
    const largo = screen.getAllByLabelText('Longitud')[0]!;
    expect(largo.tagName).toBe('INPUT'); // editable, no en reposo (el bug original)
    expect(largo).toHaveFocus();
  });

  it('Shift+Tab vuelve a la celda anterior', () => {
    render(<Harness />);
    fireEvent.click(screen.getAllByLabelText('Longitud')[0]!);
    fireEvent.keyDown(screen.getAllByLabelText('Longitud')[0]!, { key: 'Tab', shiftKey: true });
    const uds = screen.getAllByLabelText('Unidades')[0]!;
    expect(uds.tagName).toBe('INPUT');
    expect(uds).toHaveFocus();
  });

  it('Enter baja en la misma columna a la fila siguiente', () => {
    render(<Harness />);
    fireEvent.click(screen.getAllByLabelText('Unidades')[0]!);
    fireEvent.keyDown(screen.getAllByLabelText('Unidades')[0]!, { key: 'Enter' });
    const uds2 = screen.getAllByLabelText('Unidades')[1]!;
    expect(uds2.tagName).toBe('INPUT');
    expect(uds2).toHaveFocus();
  });

  it('Tab en la última celda crea una línea nueva y la enfoca', () => {
    render(<Harness />);
    const n = med().length;
    fireEvent.click(screen.getAllByLabelText('Altura')[n - 1]!); // último "alto"
    fireEvent.keyDown(screen.getAllByLabelText('Altura')[n - 1]!, { key: 'Tab' });
    expect(med()).toHaveLength(n + 1); // fila creada
    const newComment = screen.getAllByLabelText('Comentario de la línea')[n]!;
    expect(newComment.tagName).toBe('INPUT');
    expect(newComment).toHaveFocus();
  });

  it('Ctrl+Enter añade una línea nueva', () => {
    render(<Harness />);
    const n = med().length;
    fireEvent.click(screen.getAllByLabelText('Unidades')[0]!);
    fireEvent.keyDown(screen.getAllByLabelText('Unidades')[0]!, { key: 'Enter', ctrlKey: true });
    expect(med()).toHaveLength(n + 1);
  });

  describe('fila provisional (Enter de más al terminar)', () => {
    /** Enter en la última fila: crea la provisional con su «Unidades» abierto. */
    function enterAlFinal() {
      const n = med().length;
      fireEvent.click(screen.getAllByLabelText('Unidades')[n - 1]!);
      fireEvent.keyDown(screen.getAllByLabelText('Unidades')[n - 1]!, { key: 'Enter' });
      expect(med()).toHaveLength(n + 1);
      return n;
    }

    it('cerrar la partida con la fila en blanco la quita', () => {
      const { unmount } = render(<Harness />);
      const n = enterAlFinal();
      unmount();
      expect(med()).toHaveLength(n);
    });

    it('sacar el foco de la fila en blanco la quita', () => {
      vi.useFakeTimers();
      try {
        render(<Harness />);
        const n = enterAlFinal();
        const nueva = screen.getAllByLabelText('Unidades')[n]!;
        const otra = screen.getAllByLabelText('Unidades')[0]!;
        otra.focus();
        fireEvent.blur(nueva, { relatedTarget: otra });
        act(() => vi.runAllTimers());
        expect(med()).toHaveLength(n);
      } finally {
        vi.useRealTimers();
      }
    });

    it('si se escribe algo en ella, se queda', () => {
      const { unmount } = render(<Harness />);
      const n = enterAlFinal();
      const nueva = screen.getAllByLabelText('Unidades')[n]!;
      fireEvent.change(nueva, { target: { value: '3' } });
      fireEvent.blur(nueva); // el blur confirma
      unmount();
      expect(med()).toHaveLength(n + 1);
      expect(med()[n]!.uds).toBe(3);
    });

    it('un Ctrl+Z tras quitarla no la resucita: deshace lo último que sí se escribió', () => {
      __resetHistoryForTests();
      initHistory(useObraStore);
      try {
        const { unmount } = render(<Harness />);
        const n = med().length;
        const antes = med()[n - 1]!.uds;
        fireEvent.click(screen.getAllByLabelText('Unidades')[n - 1]!);
        const uds = screen.getAllByLabelText('Unidades')[n - 1]!;
        fireEvent.change(uds, { target: { value: '7' } });
        fireEvent.keyDown(uds, { key: 'Enter' }); // confirma 7 y crea la provisional
        expect(med()).toHaveLength(n + 1);
        unmount(); // cierra la partida: se quita la provisional
        expect(med()).toHaveLength(n);
        undo();
        expect(med()).toHaveLength(n);
        expect(med()[n - 1]!.uds).toBe(antes);
      } finally {
        __resetHistoryForTests();
      }
    });

    it('la de Ctrl+Enter (alta explícita) no se quita', () => {
      const { unmount } = render(<Harness />);
      const n = med().length;
      fireEvent.click(screen.getAllByLabelText('Unidades')[0]!);
      fireEvent.keyDown(screen.getAllByLabelText('Unidades')[0]!, { key: 'Enter', ctrlKey: true });
      unmount();
      expect(med()).toHaveLength(n + 1);
    });
  });

  it('Escape cancela la edición de la celda (vuelve a reposo)', () => {
    render(<Harness />);
    fireEvent.click(screen.getAllByLabelText('Unidades')[0]!);
    expect(screen.getAllByLabelText('Unidades')[0]!.tagName).toBe('INPUT');
    fireEvent.keyDown(screen.getAllByLabelText('Unidades')[0]!, { key: 'Escape' });
    expect(screen.getAllByLabelText('Unidades')[0]!.tagName).toBe('BUTTON'); // en reposo
  });
});

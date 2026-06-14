import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useObraStore } from '../../store';
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

  it('Escape cancela la edición de la celda (vuelve a reposo)', () => {
    render(<Harness />);
    fireEvent.click(screen.getAllByLabelText('Unidades')[0]!);
    expect(screen.getAllByLabelText('Unidades')[0]!.tagName).toBe('INPUT');
    fireEvent.keyDown(screen.getAllByLabelText('Unidades')[0]!, { key: 'Escape' });
    expect(screen.getAllByLabelText('Unidades')[0]!.tagName).toBe('BUTTON'); // en reposo
  });
});

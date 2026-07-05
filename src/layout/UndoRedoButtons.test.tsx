import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useObraStore } from '../store';
import { __resetHistoryForTests, initHistory } from '../store/temporal';
import { UndoRedoButtons } from './UndoRedoButtons';

const denominacion = () => useObraStore.getState().obra.denominacion;

beforeEach(() => {
  __resetHistoryForTests();
  useObraStore.getState().reset();
  initHistory(useObraStore);
});
afterEach(() => {
  __resetHistoryForTests();
});

describe('UndoRedoButtons (T6)', () => {
  it('deshabilitados sin historial; click deshace/rehace y el estado de los botones sigue', () => {
    render(<UndoRedoButtons />);
    const undoBtn = screen.getByRole('button', { name: 'Deshacer' });
    const redoBtn = screen.getByRole('button', { name: 'Rehacer' });
    expect(undoBtn).toBeDisabled();
    expect(redoBtn).toBeDisabled();

    const before = denominacion();
    act(() => {
      useObraStore.getState().setObraPath('denominacion', 'Editada');
    });
    expect(undoBtn).toBeEnabled(); // hay algo que deshacer
    expect(redoBtn).toBeDisabled();

    fireEvent.click(undoBtn);
    expect(denominacion()).toBe(before); // deshecho
    expect(undoBtn).toBeDisabled();
    expect(redoBtn).toBeEnabled(); // y ahora hay algo que rehacer

    fireEvent.click(redoBtn);
    expect(denominacion()).toBe('Editada'); // rehecho
    expect(undoBtn).toBeEnabled();
    expect(redoBtn).toBeDisabled();
  });
});

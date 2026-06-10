import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditableNum } from './EditableNum';

describe('EditableNum', () => {
  it('muestra el valor con formato español', () => {
    render(<EditableNum value={28420.18} onCommit={() => {}} ariaLabel="Importe" />);
    expect(screen.getByRole('button', { name: 'Importe' })).toHaveTextContent('28.420,18');
  });

  it('al editar quita los separadores de miles', () => {
    render(<EditableNum value={1234.5} onCommit={() => {}} ariaLabel="Cantidad" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cantidad' }));
    expect(screen.getByRole('textbox', { name: 'Cantidad' })).toHaveValue('1234,50');
  });

  it('confirma el valor parseado con Enter', () => {
    const onCommit = vi.fn();
    render(<EditableNum value={10} onCommit={onCommit} ariaLabel="Cantidad" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cantidad' }));
    const input = screen.getByRole('textbox', { name: 'Cantidad' });
    fireEvent.change(input, { target: { value: '14,20' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith(14.2);
  });

  it('confirma al perder el foco (blur)', () => {
    const onCommit = vi.fn();
    render(<EditableNum value={10} onCommit={onCommit} ariaLabel="Cantidad" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cantidad' }));
    const input = screen.getByRole('textbox', { name: 'Cantidad' });
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(7);
  });

  it('Esc cancela sin confirmar', () => {
    const onCommit = vi.fn();
    render(<EditableNum value={10} onCommit={onCommit} ariaLabel="Cantidad" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cantidad' }));
    const input = screen.getByRole('textbox', { name: 'Cantidad' });
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cantidad' })).toHaveTextContent('10,00');
  });

  it('no confirma una entrada no numérica', () => {
    const onCommit = vi.fn();
    render(<EditableNum value={10} onCommit={onCommit} ariaLabel="Cantidad" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cantidad' }));
    const input = screen.getByRole('textbox', { name: 'Cantidad' });
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
  });
});

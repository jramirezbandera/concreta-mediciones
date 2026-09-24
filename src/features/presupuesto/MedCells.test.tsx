import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MedNum } from './MedCells';

/* MedNum es la celda numérica de medición (admite VACÍO = factor 1). Comparte con
   EditableNum el pipeline `toDecimalComma` (onChange) + `parseEsNumber` (commit),
   así que debe aceptar el punto del numpad como coma y omitir el 0 de un decimal. */
describe('MedNum', () => {
  it('muestra "·" cuando el valor está vacío', () => {
    render(<MedNum value="" onCommit={() => {}} ariaLabel="Largo" />);
    expect(screen.getByRole('button', { name: 'Largo' })).toHaveTextContent('·');
  });

  it('confirma un valor normal con Enter', () => {
    const onCommit = vi.fn();
    render(<MedNum value={2} onCommit={onCommit} ariaLabel="Largo" />);
    fireEvent.click(screen.getByRole('button', { name: 'Largo' }));
    const input = screen.getByRole('textbox', { name: 'Largo' });
    fireEvent.change(input, { target: { value: '14,5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith(14.5);
  });

  it('admite omitir el 0 con el punto del numpad (".2" → 0,2)', () => {
    const onCommit = vi.fn();
    render(<MedNum value={2} onCommit={onCommit} ariaLabel="Largo" />);
    fireEvent.click(screen.getByRole('button', { name: 'Largo' }));
    const input = screen.getByRole('textbox', { name: 'Largo' });
    fireEvent.change(input, { target: { value: '.2' } }); // numpad: punto, sin el 0
    expect(input).toHaveValue(',2'); // se muestra ya como coma
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith(0.2);
  });

  it('admite omitir el 0 con la coma (",7" → 0,7)', () => {
    const onCommit = vi.fn();
    render(<MedNum value={2} onCommit={onCommit} ariaLabel="Largo" />);
    fireEvent.click(screen.getByRole('button', { name: 'Largo' }));
    const input = screen.getByRole('textbox', { name: 'Largo' });
    fireEvent.change(input, { target: { value: ',7' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith(0.7);
  });

  it('calcula una operación y la entrega junto con el resultado', () => {
    const onCommit = vi.fn();
    render(<MedNum value="" onCommit={onCommit} ariaLabel="Largo" />);
    fireEvent.click(screen.getByRole('button', { name: 'Largo' }));
    const input = screen.getByRole('textbox', { name: 'Largo' });
    fireEvent.change(input, { target: { value: '5,57+3' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith(8.57, '5,57+3');
  });

  it('en reposo marca el valor calculado y al editar enseña la operación', () => {
    render(<MedNum value={8.57} expr="5,57+3" onCommit={() => {}} ariaLabel="Largo" />);
    const btn = screen.getByRole('button', { name: 'Largo' });
    expect(btn).toHaveTextContent('ƒ8,57');
    expect(btn).toHaveAttribute('title', '5,57+3 = 8,57');
    fireEvent.click(btn);
    expect(screen.getByRole('textbox', { name: 'Largo' })).toHaveValue('5,57+3');
  });

  it('Enter con algo que no se puede calcular avisa y NO cierra ni confirma', () => {
    const onCommit = vi.fn();
    render(<MedNum value={2} onCommit={onCommit} ariaLabel="Largo" />);
    fireEvent.click(screen.getByRole('button', { name: 'Largo' }));
    const input = screen.getByRole('textbox', { name: 'Largo' });
    fireEvent.change(input, { target: { value: '5,57+' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Largo' })).toHaveAttribute('aria-invalid', 'true');
    // Salir del campo revierte sin confirmar (no se atrapa el foco).
    fireEvent.blur(screen.getByRole('textbox', { name: 'Largo' }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Largo' })).toHaveTextContent('2,00');
  });

  it('sin cambios no confirma (no redondea un valor con más de 2 decimales)', () => {
    const onCommit = vi.fn();
    render(<MedNum value={316.3978} onCommit={onCommit} ariaLabel="Largo" />);
    fireEvent.click(screen.getByRole('button', { name: 'Largo' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Largo' }), { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('vaciar la celda propaga "" (la dimensión no anula la línea)', () => {
    const onCommit = vi.fn();
    render(<MedNum value={2} onCommit={onCommit} ariaLabel="Largo" />);
    fireEvent.click(screen.getByRole('button', { name: 'Largo' }));
    const input = screen.getByRole('textbox', { name: 'Largo' });
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('');
  });
});

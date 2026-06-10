import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditableText } from './EditableText';

describe('EditableText', () => {
  it('muestra el valor', () => {
    render(<EditableText value="Excavación" onCommit={() => {}} ariaLabel="Desc" />);
    expect(screen.getByRole('textbox', { name: 'Desc' })).toHaveTextContent('Excavación');
  });

  it('muestra el placeholder cuando está vacío', () => {
    render(<EditableText value="" onCommit={() => {}} placeholder="Sin descripción" />);
    expect(screen.getByText('Sin descripción')).toBeInTheDocument();
  });

  it('confirma el nuevo texto con Enter', () => {
    const onCommit = vi.fn();
    render(<EditableText value="Hola" onCommit={onCommit} ariaLabel="Desc" />);
    fireEvent.click(screen.getByRole('textbox', { name: 'Desc' }));
    const ta = screen.getByRole('textbox', { name: 'Desc' });
    fireEvent.change(ta, { target: { value: 'Adiós' } });
    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('Adiós');
  });

  it('permite vaciar el campo (D2)', () => {
    const onCommit = vi.fn();
    render(<EditableText value="Hola" onCommit={onCommit} ariaLabel="Desc" />);
    fireEvent.click(screen.getByRole('textbox', { name: 'Desc' }));
    const ta = screen.getByRole('textbox', { name: 'Desc' });
    fireEvent.change(ta, { target: { value: '' } });
    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('');
  });

  it('no confirma si el texto no cambió', () => {
    const onCommit = vi.fn();
    render(<EditableText value="Hola" onCommit={onCommit} ariaLabel="Desc" />);
    fireEvent.click(screen.getByRole('textbox', { name: 'Desc' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Desc' }), { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('Esc cancela sin confirmar', () => {
    const onCommit = vi.fn();
    render(<EditableText value="Hola" onCommit={onCommit} ariaLabel="Desc" />);
    fireEvent.click(screen.getByRole('textbox', { name: 'Desc' }));
    const ta = screen.getByRole('textbox', { name: 'Desc' });
    fireEvent.change(ta, { target: { value: 'Cambio' } });
    fireEvent.keyDown(ta, { key: 'Escape' });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('Shift+Enter no confirma (salto de línea)', () => {
    const onCommit = vi.fn();
    render(<EditableText value="Hola" onCommit={onCommit} ariaLabel="Desc" />);
    fireEvent.click(screen.getByRole('textbox', { name: 'Desc' }));
    const ta = screen.getByRole('textbox', { name: 'Desc' });
    fireEvent.change(ta, { target: { value: 'Linea1' } });
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true });
    expect(onCommit).not.toHaveBeenCalled();
  });
});

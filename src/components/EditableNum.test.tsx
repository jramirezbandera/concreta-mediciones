import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditableNum } from './EditableNum';
import { armNextEdit, clearArmedEdit } from '../hooks/editGridNav';

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

  it('acepta el punto del teclado numérico como coma decimal', () => {
    const onCommit = vi.fn();
    render(<EditableNum value={10} onCommit={onCommit} ariaLabel="Cantidad" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cantidad' }));
    const input = screen.getByRole('textbox', { name: 'Cantidad' });
    fireEvent.change(input, { target: { value: '14.5' } }); // numpad: punto
    expect(input).toHaveValue('14,5'); // se muestra ya como coma
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith(14.5);
  });

  it('admite omitir el 0 con el punto del numpad (".2" → 0,2)', () => {
    const onCommit = vi.fn();
    render(<EditableNum value={10} onCommit={onCommit} ariaLabel="Cantidad" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cantidad' }));
    const input = screen.getByRole('textbox', { name: 'Cantidad' });
    fireEvent.change(input, { target: { value: '.2' } }); // numpad: punto, sin el 0
    expect(input).toHaveValue(',2'); // se muestra ya como coma
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith(0.2);
  });

  it('admite omitir el 0 con la coma (",2" → 0,2)', () => {
    const onCommit = vi.fn();
    render(<EditableNum value={10} onCommit={onCommit} ariaLabel="Cantidad" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cantidad' }));
    const input = screen.getByRole('textbox', { name: 'Cantidad' });
    fireEvent.change(input, { target: { value: ',2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith(0.2);
  });

  it('omitir el 0 en un negativo por la UI ("-.5" → -0,5)', () => {
    const onCommit = vi.fn();
    render(<EditableNum value={10} onCommit={onCommit} ariaLabel="Cantidad" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cantidad' }));
    const input = screen.getByRole('textbox', { name: 'Cantidad' });
    fireEvent.change(input, { target: { value: '-.5' } }); // numpad: punto
    expect(input).toHaveValue('-,5');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith(-0.5);
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

  it('Enter inválido NO descarta en silencio: mantiene el campo abierto y lo marca', () => {
    const onCommit = vi.fn();
    render(<EditableNum value={10} onCommit={onCommit} ariaLabel="Cantidad" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cantidad' }));
    const input = screen.getByRole('textbox', { name: 'Cantidad' });
    fireEvent.change(input, { target: { value: '12,a' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // sigue editando (no volvió al botón) y queda marcado como inválido
    expect(screen.getByRole('textbox', { name: 'Cantidad' })).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('tras corregir un valor rechazado, Enter confirma y limpia el aviso', () => {
    const onCommit = vi.fn();
    render(<EditableNum value={10} onCommit={onCommit} ariaLabel="Cantidad" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cantidad' }));
    const input = screen.getByRole('textbox', { name: 'Cantidad' });
    fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.keyDown(input, { key: 'Enter' }); // rechazado, sigue abierto
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(input, { target: { value: '8,5' } }); // corrige
    expect(input).not.toHaveAttribute('aria-invalid'); // el aviso desaparece al teclear
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith(8.5);
  });

  it('blur con valor inválido revierte sin commit (no atrapa el foco)', () => {
    const onCommit = vi.fn();
    render(<EditableNum value={10} onCommit={onCommit} ariaLabel="Cantidad" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cantidad' }));
    const input = screen.getByRole('textbox', { name: 'Cantidad' });
    fireEvent.change(input, { target: { value: 'nope' } });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cantidad' })).toHaveTextContent('10,00');
  });
});

// Apertura al foco ARMADO (navegación tipo hoja de cálculo, useMedGridTab): la
// celda vecina se abre sola SOLO cuando un Tab/Enter la armó. Sin armar (foco a
// secas, p. ej. flechas o tabulación fuera de un grid) NO abre.
describe('EditableNum — arm-open al recibir foco', () => {
  afterEach(() => clearArmedEdit());

  it('foco SIN armar NO abre la celda (evita aperturas espurias)', () => {
    render(<EditableNum value={10} onCommit={vi.fn()} ariaLabel="n" />);
    const btn = screen.getByRole('button', { name: 'n' });
    fireEvent.focus(btn);
    expect(screen.getByRole('button', { name: 'n' })).toBeInTheDocument(); // sigue en reposo
    expect(screen.queryByRole('textbox', { name: 'n' })).toBeNull();
  });

  it('foco ARMADO abre la celda en edición', () => {
    render(<EditableNum value={10} onCommit={vi.fn()} ariaLabel="n" />);
    const btn = screen.getByRole('button', { name: 'n' });
    armNextEdit(btn);
    fireEvent.focus(btn);
    expect(screen.getByRole('textbox', { name: 'n' })).toBeInTheDocument();
  });

  it('Escape devuelve el foco a la celda en reposo (no se pierde la posición de teclado)', () => {
    render(<EditableNum value={10} onCommit={vi.fn()} ariaLabel="n" />);
    fireEvent.click(screen.getByRole('button', { name: 'n' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'n' }), { key: 'Escape' });
    const back = screen.getByRole('button', { name: 'n' });
    expect(back).toHaveFocus();
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IvaSelect } from './IvaSelect';

describe('IvaSelect', () => {
  it('muestra el tipo actual', () => {
    render(<IvaSelect rate={0.1} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /IVA 10%/ })).toBeInTheDocument();
  });

  it('abre el listado al pulsar', () => {
    render(<IvaSelect rate={0.1} onChange={() => {}} />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /IVA 10%/ }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Reforma de vivienda/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Obra nueva/ })).toBeInTheDocument();
  });

  it('marca la opción seleccionada', () => {
    render(<IvaSelect rate={0.1} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /IVA 10%/ }));
    expect(screen.getByRole('option', { name: /Reforma de vivienda/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('emite el nuevo tipo al elegir y cierra', () => {
    const onChange = vi.fn();
    render(<IvaSelect rate={0.1} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /IVA 10%/ }));
    fireEvent.click(screen.getByRole('option', { name: /Obra nueva/ }));
    expect(onChange).toHaveBeenCalledWith(0.21);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('se cierra al hacer clic fuera', () => {
    render(<IvaSelect rate={0.1} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /IVA 10%/ }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

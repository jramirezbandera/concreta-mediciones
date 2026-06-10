import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InlineCreate } from './InlineCreate';

describe('InlineCreate', () => {
  it('confirma el valor recortado con Enter', () => {
    const onCommit = vi.fn();
    render(<InlineCreate onCommit={onCommit} onCancel={() => {}} placeholder="Capítulo…" />);
    const input = screen.getByPlaceholderText('Capítulo…');
    fireEvent.change(input, { target: { value: '  Demoliciones  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('Demoliciones');
  });

  it('Enter con vacío cancela en lugar de confirmar', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(<InlineCreate onCommit={onCommit} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it('Esc cancela', () => {
    const onCancel = vi.fn();
    render(<InlineCreate onCommit={() => {}} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('el botón de confirmar emite el valor', () => {
    const onCommit = vi.fn();
    render(<InlineCreate onCommit={onCommit} onCancel={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Cap 1' } });
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onCommit).toHaveBeenCalledWith('Cap 1');
  });
});

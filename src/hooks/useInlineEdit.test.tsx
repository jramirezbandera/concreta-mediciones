import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useInlineEdit } from './useInlineEdit';
import { armNextEdit, clearArmedEdit } from './editGridNav';

/** Celda mínima que ejerce el contrato del hook (display ↔ input). */
function Cell() {
  const ie = useInlineEdit<HTMLButtonElement>();
  if (ie.editing) {
    return (
      <input
        ref={ie.inputRef}
        aria-label="cell"
        value={ie.draft}
        onChange={(e) => ie.setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') ie.cancel();
          if (e.key === 'Enter') ie.finish();
        }}
      />
    );
  }
  return (
    <button
      ref={ie.displayRef}
      type="button"
      aria-label="cell"
      data-editcell=""
      onClick={() => ie.begin('x')}
      onFocus={ie.armOpenOnFocus(() => ie.begin('x'))}
    >
      display
    </button>
  );
}

afterEach(() => {
  clearArmedEdit();
  document.body.innerHTML = '';
});

describe('useInlineEdit', () => {
  it('begin abre la edición con el borrador inicial', () => {
    render(<Cell />);
    fireEvent.click(screen.getByRole('button', { name: 'cell' }));
    const input = screen.getByRole('textbox', { name: 'cell' });
    expect(input).toHaveValue('x');
    expect(input).toHaveFocus(); // el effect enfoca el input al entrar en edición
  });

  it('cancel (Esc) cierra y DEVUELVE el foco a la celda en reposo', () => {
    render(<Cell />);
    fireEvent.click(screen.getByRole('button', { name: 'cell' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'cell' }), { key: 'Escape' });
    const back = screen.getByRole('button', { name: 'cell' });
    expect(back).toHaveFocus();
  });

  it('finish cierra sin refoco (el commit lo hace el caller)', () => {
    render(<Cell />);
    fireEvent.click(screen.getByRole('button', { name: 'cell' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'cell' }), { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'cell' })).toBeInTheDocument();
  });

  it('armOpenOnFocus abre SOLO con el foco armado (Tab/Enter del grid)', () => {
    render(<Cell />);
    const btn = screen.getByRole('button', { name: 'cell' });
    fireEvent.focus(btn); // sin armar
    expect(screen.getByRole('button', { name: 'cell' })).toBeInTheDocument(); // sigue en reposo
    armNextEdit(btn);
    fireEvent.focus(btn); // armado
    expect(screen.getByRole('textbox', { name: 'cell' })).toBeInTheDocument();
  });
});

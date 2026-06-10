import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

function Fixture({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Título" subtitle="Sub" icon="building">
      <input aria-label="a" />
      <input aria-label="b" />
    </Modal>
  );
}

describe('Modal (T-7 focus-trap)', () => {
  it('no monta nada cuando open=false', () => {
    render(<Fixture open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('expone role=dialog con aria-modal y título asociado', () => {
    render(<Fixture open onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Título');
  });

  it('al abrir mueve el foco al primer control del panel (el cierre, en cabecera)', () => {
    render(<Fixture open onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
  });

  it('Esc cierra', () => {
    const onClose = vi.fn();
    render(<Fixture open onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clic en el overlay cierra; clic dentro del panel no', () => {
    const onClose = vi.fn();
    render(<Fixture open onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    // El overlay es el padre del dialog.
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Orden de tabulación en el panel: [Cerrar (cabecera), a, b].
  it('Tab desde el último control cicla al primero (trap)', () => {
    render(<Fixture open onClose={() => {}} />);
    screen.getByLabelText('b').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
  });

  it('Shift+Tab desde el primer control cicla al último (trap)', () => {
    render(<Fixture open onClose={() => {}} />);
    screen.getByRole('button', { name: 'Cerrar' }).focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByLabelText('b')).toHaveFocus();
  });

  it('restaura el foco al elemento previo al cerrar', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { rerender } = render(<Fixture open onClose={() => {}} />);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    rerender(<Fixture open={false} onClose={() => {}} />);
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});

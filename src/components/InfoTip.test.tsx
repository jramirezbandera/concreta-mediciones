import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InfoTip } from './InfoTip';

function tip() {
  render(
    <>
      <InfoTip term="PEM">Presupuesto de Ejecución Material.</InfoTip>
      <span>fuera</span>
    </>,
  );
  return screen.getByRole('button', { name: 'Qué es PEM' });
}

describe('InfoTip — la ⓘ también se abre al tocarla (táctil sin hover)', () => {
  it('el toque fija la burbuja y un segundo toque la suelta', () => {
    const btn = tip();
    expect(btn.className).not.toMatch(/open/);
    fireEvent.click(btn);
    expect(btn.className).toMatch(/open/);
    fireEvent.click(btn);
    expect(btn.className).not.toMatch(/open/);
  });

  it('un toque fuera o Esc la cierran', () => {
    const btn = tip();
    fireEvent.click(btn);
    fireEvent.pointerDown(screen.getByText('fuera'));
    expect(btn.className).not.toMatch(/open/);

    fireEvent.click(btn);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(btn.className).not.toMatch(/open/);
  });

  it('dentro de un formulario no lo envía (es ayuda, no una acción)', () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <InfoTip term="IVA">Impuesto sobre el PEC.</InfoTip>
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Qué es IVA' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('la explicación sigue enlazada para lectores de pantalla', () => {
    const btn = tip();
    expect(btn).toHaveAccessibleDescription('Presupuesto de Ejecución Material.');
  });
});

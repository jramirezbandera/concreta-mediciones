import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AjustaModal } from './Sidebar';

/* El modal "Ajustar a un PEM objetivo" tiene su propio input decimal (no pasa por
   EditableNum). Debe aceptar el punto del teclado numérico como coma decimal, igual
   que el resto de campos numéricos. `pemAt` se stubbea (K → PEM lineal) para no
   depender del motor de redondeo por partida. */
function renderModal() {
  const onApply = vi.fn();
  render(
    <AjustaModal
      open
      onClose={() => {}}
      baseCents={100_000} // PEM a K=1 = 1000 €
      currentPem={100_000}
      pemAt={(k) => Math.round(100_000 * k)}
      onApply={onApply}
      compact={false}
    />,
  );
  return { onApply, input: screen.getByRole('textbox', { name: 'PEM objetivo en euros' }) };
}

describe('AjustaModal · PEM objetivo', () => {
  it('el punto del teclado numérico se muestra como coma decimal', () => {
    const { input } = renderModal();
    fireEvent.change(input, { target: { value: '1234.5' } }); // numpad: punto
    expect(input).toHaveValue('1234,5');
  });

  it('con el objetivo tecleado con punto, Enter aplica un K coherente', () => {
    const { onApply, input } = renderModal();
    fireEvent.change(input, { target: { value: '1234.5' } }); // objetivo 1234,5 € (numpad)
    fireEvent.keyDown(input, { key: 'Enter' });
    // base 1000 € → objetivo 1234,5 € ⇒ K ≈ 1,2345
    expect(onApply).toHaveBeenCalledWith(expect.closeTo(1.2345, 4));
  });
});

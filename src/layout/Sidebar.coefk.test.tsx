import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toEur } from '../core/money';
import { selectPem, useObraStore } from '../store';
import { Sidebar } from './Sidebar';

beforeEach(() => {
  useObraStore.getState().reset();
});
afterEach(() => {
  document.body.innerHTML = '';
});

const pemEur = () => toEur(selectPem(useObraStore.getState()));

describe('Sidebar — coeficiente K (Fase B)', () => {
  it('muestra el K vigente (1,0000) en la tarjeta Resumen', () => {
    render(<Sidebar />);
    expect(screen.getByLabelText('Coeficiente K')).toHaveTextContent('1,0000');
  });

  it('editar el K inline reescala el PEM (×1,1 → +10 %)', () => {
    render(<Sidebar />);
    const base = pemEur(); // 26.291,91 €
    fireEvent.click(screen.getByLabelText('Coeficiente K')); // entra en edición
    fireEvent.change(screen.getByLabelText('Coeficiente K'), { target: { value: '1,1' } });
    fireEvent.keyDown(screen.getByLabelText('Coeficiente K'), { key: 'Enter' });

    expect(useObraStore.getState().rates.coefK).toBe(1.1);
    expect(pemEur()).toBeGreaterThan(base);
  });

  it('"Ajusta" calcula el K que cuadra el PEM con el objetivo tecleado', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole('button', { name: /Ajusta/ }));

    // El modal precarga el PEM actual; lo cambiamos a 30.000 € y aplicamos.
    const input = screen.getByLabelText('PEM objetivo en euros');
    fireEvent.change(input, { target: { value: '30000' } });
    fireEvent.click(screen.getByRole('button', { name: /Aplicar K/ }));

    const s = useObraStore.getState();
    expect(s.rates.coefK).toBe(1.141035); // 30.000 / 26.291,91, a 6 decimales
    // El PEM resultante cuadra con el objetivo dentro de la tolerancia (<1 €).
    expect(Math.abs(pemEur() - 30000)).toBeLessThan(1);
  });

  it('no aplica un objetivo no numérico (botón deshabilitado)', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole('button', { name: /Ajusta/ }));
    const input = screen.getByLabelText('PEM objetivo en euros');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(screen.getByRole('button', { name: /Aplicar K/ })).toBeDisabled();
    expect(useObraStore.getState().rates.coefK).toBe(1); // intacto
  });
});

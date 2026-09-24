import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useObraStore } from '../../store';
import { PresupuestoView } from './PresupuestoView';

beforeEach(() => {
  useObraStore.getState().reset();
});
afterEach(() => {
  document.body.innerHTML = '';
});

/** Desplegar una partida era solo un clic en un <div>/<tr>: sin botón, sin
 *  `aria-expanded` y sin camino de teclado. Ahora el chevron es un botón. */
describe.each([
  ['tabla (escritorio)', false],
  ['tarjetas (móvil)', true],
])('Desplegar partida accesible — %s', (_label, compact) => {
  it('el chevron es un botón con aria-expanded que abre y cierra el detalle', () => {
    render(<PresupuestoView compact={compact} />);
    const btn = screen.getAllByRole('button', { name: /^Desplegar partida / })[0]!;
    expect(btn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(btn);
    // En tarjetas el botón dice «Añadir línea»; en tabla, «… de medición».
    expect(screen.getAllByText(/Añadir línea/).length).toBeGreaterThan(0);
    const contraer = screen.getAllByRole('button', { name: /^Contraer partida / })[0]!;
    expect(contraer).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(contraer);
    expect(screen.queryByText(/Añadir línea/)).toBeNull();
  });
});

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

describe('PresupuestoView (F2.1 lectura + F2.2 detalle)', () => {
  it('muestra el capítulo activo (01) con sus partidas', () => {
    render(<PresupuestoView compact={false} />);
    expect(screen.getByRole('heading', { name: 'Movimiento de tierras' })).toBeInTheDocument();
    expect(screen.getByText('E02EM030')).toBeInTheDocument(); // código de p111
  });

  it('desplegar una partida abre el panel de detalle (medición)', () => {
    render(<PresupuestoView compact={false} />);
    expect(screen.queryByText('Añadir línea de medición')).toBeNull();
    // La celda Nº·Código no para la propagación → click despliega la fila.
    fireEvent.click(screen.getByText('E02EM030'));
    expect(screen.getByText('Añadir línea de medición')).toBeInTheDocument();
    // Las líneas de medición de p111 quedan visibles dentro del panel.
    expect(screen.getByText('Zanjas de saneamiento')).toBeInTheDocument();
  });

  it('el capítulo vacío (05) muestra el estado sin partidas', () => {
    useObraStore.getState().setActive('05'); // Cerramientos: 0 partidas en el seed
    render(<PresupuestoView compact={false} />);
    expect(screen.getByText('Capítulo sin partidas')).toBeInTheDocument();
  });

  it('la pestaña Justificación muestra el banco compartido y la señal de override', () => {
    render(<PresupuestoView compact={false} />);
    fireEvent.click(screen.getByText('E02EM030')); // despliega p111
    fireEvent.click(screen.getByText('Justificación del precio'));
    // conceptos del banco visibles (mo001 lo comparten ≥4 partidas → SharedChip).
    expect(screen.getByText('mo001')).toBeInTheDocument();
    // p111 es override en el seed (precio 18,42 ≠ descompuesto 9,27) → señal.
    expect(screen.getByText(/fijado a mano/)).toBeInTheDocument();
  });
});

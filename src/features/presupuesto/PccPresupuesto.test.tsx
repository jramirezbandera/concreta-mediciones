/* Plan de control de calidad en el presupuesto (plan §11): chip «PCC» en la fila
   y pestaña «Calidad» en el detalle, solo con plan. */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useObraStore } from '../../store';
import { useMedUiStore } from '../../store/medUiStore';
import { PresupuestoView } from './PresupuestoView';

const state = () => useObraStore.getState();

beforeEach(() => {
  state().reset();
  useMedUiStore.getState().setTab('medicion');
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('calidad en el presupuesto', () => {
  it('sin plan: ni chip ni pestaña', () => {
    render(<PresupuestoView compact={false} />);
    expect(screen.queryByText('PCC')).toBeNull();
    fireEvent.click(screen.getByText('E02EM030'));
    expect(screen.queryByRole('button', { name: 'Calidad' })).toBeNull();
  });

  it('con plan: chip en las partidas asignadas y el editor en la pestaña «Calidad»', async () => {
    state().iniciarPlanCalidad();
    const p111 = state().partidas['01']!.find((p) => p.id === 'p111')!;
    state().setControlPartida('01', 'p111', { estado: 'propuesta', origen: { tipo: 'manual', motivo: 'Asignada a mano' }, familia: 'excavacion' });
    render(<PresupuestoView compact={false} />);
    expect(screen.getAllByTitle('Plan de control de calidad: por revisar').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText(p111.code));
    fireEvent.click(screen.getByRole('button', { name: 'Calidad' }));
    expect(await screen.findByText(/A mano: Asignada a mano/)).toBeInTheDocument();
  });
});

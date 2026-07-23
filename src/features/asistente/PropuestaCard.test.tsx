import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropuestaCard } from './PropuestaCard';
import type { Proposal } from '../../ai';

const prop = (over: Partial<Proposal> = {}): Proposal => ({
  id: `prop-${Math.random()}`,
  op: { op: 'set_precio', ref: '1.1', valor: 20 },
  target: 'Partida 1.1 · Excavación',
  diffs: [{ campo: 'Precio', antes: '10,00 €', despues: '20,00 €' }],
  partidaId: 'p1',
  chapterId: 'c1',
  ...over,
});

describe('PropuestaCard', () => {
  it('encabeza con recuento y destino, y el botón lleva el número (D5)', () => {
    render(<PropuestaCard proposals={[prop()]} onApply={() => {}} onDiscard={() => {}} />);
    expect(screen.getByText('1 cambio propuesto')).toBeInTheDocument();
    expect(screen.getByText('Partida 1.1 · Excavación')).toBeInTheDocument();
    expect(screen.getByText('10,00 €')).toBeInTheDocument();
    expect(screen.getByText('20,00 €')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aplicar 1 cambio/ })).toBeInTheDocument();
  });

  it('Aplicar y Descartar disparan sus callbacks', async () => {
    const onApply = vi.fn();
    const onDiscard = vi.fn();
    const user = userEvent.setup();
    render(<PropuestaCard proposals={[prop()]} onApply={onApply} onDiscard={onDiscard} />);
    await user.click(screen.getByRole('button', { name: /Aplicar/ }));
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it('diff denso (>8): arranca plegado con «ver los N» y se despliega', async () => {
    const many = Array.from({ length: 10 }, (_, i) => prop({ id: `p${i}`, partidaId: `p${i}`, target: `Partida 1.${i}` }));
    const user = userEvent.setup();
    render(<PropuestaCard proposals={many} onApply={() => {}} onDiscard={() => {}} />);
    // Detalle plegado: no se ven las filas, pero el botón de aplicar SÍ (no se hunde).
    expect(screen.queryByText('Partida 1.0')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aplicar 10 cambios/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /ver los 10 cambios/ }));
    expect(screen.getByText('Partida 1.0')).toBeInTheDocument();
  });
});

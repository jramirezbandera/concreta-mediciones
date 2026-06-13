import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MobileSummaryBar } from './MobileSummaryBar';

describe('MobileSummaryBar', () => {
  it('mantiene visible PEM y Total (el dato que en móvil se perdía)', () => {
    render(<MobileSummaryBar pem={2629191} total={3441611} onOpen={() => {}} />);
    expect(screen.getByText('26.291,91 €')).toBeInTheDocument();
    expect(screen.getByText('34.416,11 €')).toBeInTheDocument();
  });

  it('al tocarla abre el drawer (donde está el K / Ajusta)', () => {
    const onOpen = vi.fn();
    render(<MobileSummaryBar pem={2629191} total={3441611} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /resumen del presupuesto/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

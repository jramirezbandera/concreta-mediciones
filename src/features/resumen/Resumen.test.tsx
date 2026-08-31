import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ResumenView } from './ResumenView';
import { useObraStore } from '../../store';

beforeEach(() => {
  useObraStore.getState().reset();
});

describe('ResumenView (F7.1) — hoja editable', () => {
  it('pinta el desglose y los totales del seed (mismos números que el motor)', () => {
    render(<ResumenView compact={false} />);
    // PEM seed = 26.291,91 € (aceptación F1) y la cadena por línea:
    expect(screen.getByText('26.291,91 €')).toBeInTheDocument(); // PEM
    expect(screen.getByText('3.417,95 €')).toBeInTheDocument(); // GG 13%
    expect(screen.getByText('1.577,51 €')).toBeInTheDocument(); // BI 6%
    expect(screen.getByText('31.287,37 €')).toBeInTheDocument(); // PEC
    expect(screen.getByText('3.128,74 €')).toBeInTheDocument(); // IVA 10%
    expect(screen.getByText('34.416,11 €')).toBeInTheDocument(); // licitación
    expect(screen.getByRole('heading', { name: /C\/ Mayor 14/ })).toBeInTheDocument();
  });

  it('editar GG% recalcula vía setRates (único hogar de edición de GG/BI)', () => {
    render(<ResumenView compact={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gastos generales' }));
    const input = screen.getByLabelText('Gastos generales');
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useObraStore.getState().rates.gg).toBe(0.1);
    expect(screen.getByText('2.629,19 €')).toBeInTheDocument(); // GG 10%
  });

  it('un GG con medio punto (13,5%) no se pierde por redondeo', () => {
    render(<ResumenView compact={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gastos generales' }));
    const input = screen.getByLabelText('Gastos generales');
    fireEvent.change(input, { target: { value: '13,5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useObraStore.getState().rates.gg).toBe(0.135);
  });

  it('la fila de costes indirectos se ve SIEMPRE (a 0 % es donde se ponen)', () => {
    render(<ResumenView compact={false} />);
    expect(screen.getByRole('button', { name: 'Costes indirectos' })).toBeInTheDocument();
    // A 0 % el PEM sigue siendo la Σ de capítulos y no sobra ninguna fila.
    expect(screen.queryByText('Costes directos (suma de capítulos)')).not.toBeInTheDocument();
  });

  it('editar el CI mueve el PEM y estrena la fila de costes directos', () => {
    render(<ResumenView compact={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Costes indirectos' }));
    const input = screen.getByLabelText('Costes indirectos');
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useObraStore.getState().rates.ci).toBe(0.03);
    // 26.291,91 (directos, Σ capítulos) + 788,76 (3%) = 27.080,67 de PEM.
    expect(screen.getByText('Costes directos (suma de capítulos)')).toBeInTheDocument();
    expect(screen.getByText('26.291,91 €')).toBeInTheDocument();
    expect(screen.getByText('788,76 €')).toBeInTheDocument();
    expect(screen.getByText('27.080,67 €')).toBeInTheDocument();
    // Y arrastra a GG/BI, que van sobre el PEM: 27.080,67 · 13 % = 3.520,49.
    expect(screen.getByText('3.520,49 €')).toBeInTheDocument();
  });

  it('ofrece el CI que declaran las partidas importadas, y solo lo aplica al pulsar', () => {
    useObraStore.setState((s) => {
      for (const p of s.partidas['01'] ?? []) p.ciPct = 3;
    });
    render(<ResumenView compact={false} />);
    expect(screen.getByText(/declaran un CI del/)).toBeInTheDocument();
    expect(useObraStore.getState().rates.ci).toBe(0); // aún no se ha tocado nada
    fireEvent.click(screen.getByRole('button', { name: /Aplicar 3,0%/ }));
    expect(useObraStore.getState().rates.ci).toBe(0.03);
    // Aplicado, el ofrecimiento desaparece (ya no hay nada que ofrecer).
    expect(screen.queryByText(/declaran un CI del/)).not.toBeInTheDocument();
  });

  it('la propuesta de CI se puede descartar sin tocar el presupuesto', () => {
    useObraStore.setState((s) => {
      for (const p of s.partidas['01'] ?? []) p.ciPct = 2;
    });
    render(<ResumenView compact={false} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Descartar la propuesta de costes indirectos' }),
    );
    expect(screen.queryByText(/declaran un CI del/)).not.toBeInTheDocument();
    expect(useObraStore.getState().rates.ci).toBe(0);
  });

  it('cada concepto editable lleva su ayuda (qué es y sobre qué se calcula)', () => {
    render(<ResumenView compact={false} />);
    expect(screen.getByRole('button', { name: 'Qué es Gastos generales' })).toHaveAttribute(
      'title',
      expect.stringContaining('EMPRESA'),
    );
    expect(screen.getByRole('button', { name: 'Qué es Costes indirectos' })).toHaveAttribute(
      'title',
      expect.stringContaining('OBRA'),
    );
    expect(screen.getByRole('button', { name: 'Qué es PEM' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Qué es PEC' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Qué es IVA' })).toBeInTheDocument();
  });

  it('las observaciones persisten en obra.notes (dominio, F6 las guarda)', () => {
    render(<ResumenView compact={false} />);
    fireEvent.change(screen.getByLabelText('Observaciones y notas'), {
      target: { value: 'Sin partida de seguridad y salud.' },
    });
    expect(useObraStore.getState().obra.notes).toBe('Sin partida de seguridad y salud.');
  });

  it('obra sin capítulos → estado vacío con CTA al presupuesto (no hoja a 0,00)', () => {
    useObraStore.setState((s) => {
      s.chapters = [];
      s.partidas = {};
    });
    render(<ResumenView compact={false} />);
    expect(screen.getByText('Aún no hay presupuesto que resumir')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ir al presupuesto/ }));
    expect(useObraStore.getState().view).toBe('presupuesto');
  });
});

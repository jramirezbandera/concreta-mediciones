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

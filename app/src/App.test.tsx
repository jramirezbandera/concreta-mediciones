import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  window.location.hash = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('App shell (F0)', () => {
  it('arranca en la vista Presupuesto', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Presupuesto' })).toBeInTheDocument();
  });

  it('las tabs cambian de vista', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }));
    expect(screen.getByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
    expect(screen.getByText('Fase F3 · Resumen')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Certificaciones' }));
    expect(screen.getByRole('heading', { name: 'Certificaciones' })).toBeInTheDocument();
  });

  it('el toggle de tema alterna data-theme', () => {
    render(<App />);
    // useTheme arranca en oscuro por defecto.
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    fireEvent.click(screen.getByRole('button', { name: 'Activar modo claro' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('concreta.theme')).toBe('light');

    fireEvent.click(screen.getByRole('button', { name: 'Activar modo oscuro' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('las acciones no implementadas muestran un aviso de fase posterior', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(screen.getByRole('status')).toHaveTextContent(/fase posterior/i);
  });
});

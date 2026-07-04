import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { ALL, useObraStore } from './store';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  window.location.hash = '';
  // El store es un singleton de módulo: aíslalo entre casos (vista/activo).
  useObraStore.getState().reset();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('App shell (F0)', () => {
  it('arranca en la vista Presupuesto con el primer capítulo cargado', () => {
    render(<App />);
    // Sin placeholder: la vista real muestra la cabecera del capítulo activo (01).
    // El título del capítulo es editable inline (role textbox, no heading).
    expect(screen.getByRole('textbox', { name: 'Título del capítulo' })).toHaveTextContent(
      'Movimiento de tierras',
    );
    expect(screen.getByRole('button', { name: /Toda la obra/ })).toBeInTheDocument();
  });

  it('las tabs cambian de vista', () => {
    render(<App />);
    // F7.1: la pestaña Resumen muestra la hoja real (deja de ser placeholder).
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }));
    expect(screen.getByText('Desglose por capítulos')).toBeInTheDocument();
    expect(screen.getByText('Presupuesto base de licitación')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Certificaciones' }));
    // F4.1: la pestaña Certificaciones muestra la vista real (no el placeholder).
    expect(screen.getByText('Ejecución global')).toBeInTheDocument();
  });

  it('en Certificaciones el árbol navega la cert (no devuelve al presupuesto)', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Certificaciones' }));
    // Entrar en la pestaña abre la cert COMPLETA, venga de donde venga el activo.
    expect(useObraStore.getState().active).toBe(ALL);
    expect(screen.getByText('E02EM030')).toBeInTheDocument(); // cap 01
    expect(screen.getByText('E04CM040')).toBeInTheDocument(); // cap 02
    // Seleccionar un capítulo en el árbol AÍSLA dentro del modo certificar.
    fireEvent.click(screen.getByRole('button', { name: /Cimentación/ }));
    expect(useObraStore.getState().view).toBe('certificaciones');
    expect(screen.getByText('E04CM040')).toBeInTheDocument(); // cap 02 aislado
    expect(screen.queryByText('E02EM030')).toBeNull(); // cap 01 fuera
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

  it('Exportar abre el chooser de listados (F7.1)', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    const modal = screen.getByRole('dialog', { name: 'Exportar' });
    expect(modal).toBeInTheDocument();
    expect(screen.getByText('Presupuesto y mediciones')).toBeInTheDocument();
  });
});

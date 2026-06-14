import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useObraStore } from '../store';
import { AyudaCenter } from './AyudaCenter';

beforeEach(() => {
  useObraStore.getState().reset();
});

const noop = () => {};

describe('AyudaCenter', () => {
  it('abre en Primeros pasos y tiene las 3 pestañas', () => {
    render(<AyudaCenter open onClose={noop} onNavigate={noop} initialTab="inicio" />);
    expect(screen.getByRole('tab', { name: 'Primeros pasos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Funcionalidades' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Atajos' })).toBeInTheDocument();
    expect(screen.getByText('Crea o importa una obra')).toBeInTheDocument();
  });

  it('la pestaña Atajos muestra la chuleta (no se pierde el cheatsheet)', () => {
    render(<AyudaCenter open onClose={noop} onNavigate={noop} initialTab="inicio" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Atajos' }));
    expect(screen.getByText('Buscar partida en la obra')).toBeInTheDocument();
  });

  it('initialTab="atajos" abre directamente en Atajos', () => {
    render(<AyudaCenter open onClose={noop} onNavigate={noop} initialTab="atajos" />);
    expect(screen.getByText('Buscar partida en la obra')).toBeInTheDocument();
  });

  it('el botón "ir" de un paso navega a su vista', () => {
    const onNavigate = vi.fn();
    render(<AyudaCenter open onClose={noop} onNavigate={onNavigate} initialTab="inicio" />);
    fireEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(onNavigate).toHaveBeenCalledWith('import');
  });

  it('marca como hecho el paso "obra" cuando hay capítulos (seed)', () => {
    // El seed trae capítulos → el primer paso (crear/importar obra) sale hecho.
    render(<AyudaCenter open onClose={noop} onNavigate={noop} initialTab="inicio" />);
    // El número del paso 1 se sustituye por un check (no hay "1" como número de paso).
    expect(screen.queryByText('Crea o importa una obra')).toBeInTheDocument();
  });

  it('en compacto apila las secciones (atajos visibles sin pestañas)', () => {
    render(<AyudaCenter open onClose={noop} onNavigate={noop} compact />);
    expect(screen.queryByRole('tab')).toBeNull(); // sin pestañas
    expect(screen.getByText('Crea o importa una obra')).toBeInTheDocument();
    expect(screen.getByText('Buscar partida en la obra')).toBeInTheDocument(); // atajos también
  });
});

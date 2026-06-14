import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useObraStore, useToastStore } from '../store';
import { BuscarPartidas } from '../features/presupuesto/BuscarPartidas';
import { useAppHotkeys } from './useAppHotkeys';

beforeEach(() => {
  useObraStore.getState().reset();
});

function Harness({ onHelp = () => {} }: { onHelp?: () => void }) {
  useAppHotkeys({ onHelp });
  return <BuscarPartidas />;
}

const partidas01 = () => useObraStore.getState().partidas['01']!;
const has = (id: string) => partidas01().some((p) => p.id === id);

describe('useAppHotkeys', () => {
  it('Ctrl+K enfoca el buscador', () => {
    render(<Harness />);
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(screen.getByLabelText('Buscar partida en la obra')).toHaveFocus();
  });

  it('? abre la ayuda cuando el foco no está en un campo', () => {
    const onHelp = vi.fn();
    render(<Harness onHelp={onHelp} />);
    fireEvent.keyDown(document.body, { key: '?' });
    expect(onHelp).toHaveBeenCalledTimes(1);
  });

  it('Supr borra la partida seleccionada y ofrece Deshacer (restaura)', () => {
    useObraStore.getState().togglePartida('p111'); // selecciona
    render(<Harness />);
    expect(has('p111')).toBe(true);
    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(has('p111')).toBe(false); // borrada

    const action = useToastStore.getState().action;
    expect(action?.label).toBe('Deshacer');
    action!.run();
    expect(has('p111')).toBe(true); // restaurada con su identidad
  });

  it('Supr NO borra con el foco en un campo de texto', () => {
    useObraStore.getState().togglePartida('p111');
    render(<Harness />);
    const input = screen.getByLabelText('Buscar partida en la obra');
    input.focus();
    fireEvent.keyDown(input, { key: 'Delete' });
    expect(has('p111')).toBe(true);
  });

  it('Esc deselecciona la partida abierta', () => {
    useObraStore.getState().togglePartida('p111');
    render(<Harness />);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(useObraStore.getState().openPartidaId).toBeNull();
  });
});

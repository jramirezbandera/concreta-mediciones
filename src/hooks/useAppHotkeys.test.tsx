import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useObraStore, useToastStore } from '../store';
import { __resetHistoryForTests, initHistory } from '../store/temporal';
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

  it('Esc que cancela una celda en edición NO deselecciona la partida', () => {
    // En el navegador, React 19 desmonta el input de la celda DENTRO del propio
    // evento, así que cuando el Esc llega a window el foco ya no está en él. Se
    // emula igual: el target es un campo, pero el foco no.
    useObraStore.getState().togglePartida('p111');
    render(<Harness />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(useObraStore.getState().openPartidaId).toBe('p111');
    input.remove();
  });
});

describe('useAppHotkeys — deshacer/rehacer (T6)', () => {
  const denominacion = () => useObraStore.getState().obra.denominacion;

  beforeEach(() => {
    __resetHistoryForTests();
    useObraStore.getState().reset();
    initHistory(useObraStore); // la obra sembrada es la línea base
  });
  afterEach(() => {
    __resetHistoryForTests();
  });

  it('Ctrl+Z deshace; Ctrl+Shift+Z y Ctrl+Y rehacen', () => {
    render(<Harness />);
    const before = denominacion();
    useObraStore.getState().setObraPath('denominacion', 'Editada');

    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    expect(denominacion()).toBe(before); // deshecho

    fireEvent.keyDown(document.body, { key: 'Z', ctrlKey: true, shiftKey: true });
    expect(denominacion()).toBe('Editada'); // rehecho (Ctrl+Shift+Z)

    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true });
    expect(denominacion()).toBe('Editada'); // rehecho (Ctrl+Y)
  });

  it('Ctrl+Z con el foco en un campo de texto NO deshace (undo nativo del input)', () => {
    render(<Harness />);
    useObraStore.getState().setObraPath('denominacion', 'Editada');
    const input = screen.getByLabelText('Buscar partida en la obra');
    input.focus();
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true });
    expect(denominacion()).toBe('Editada'); // intacto: el input gestiona su undo
  });
});

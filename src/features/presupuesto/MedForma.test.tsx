import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useObraStore } from '../../store';
import type { Partida } from '../../core/types';
import { DetailPanel } from './DetailPanel';

// p111 del seed: m³, dos líneas con las cuatro dimensiones escritas.
const partida = () => useObraStore.getState().partidas['01']!.find((x) => x.id === 'p111')!;

function Harness({ compact = false }: { compact?: boolean }) {
  const p = useObraStore((s) => s.partidas['01']!.find((x) => x.id === 'p111')!) as Partida;
  return <DetailPanel p={p} chapterId="01" compact={compact} />;
}

const headers = () =>
  screen.getAllByRole('columnheader').map((th) => th.textContent).filter(Boolean);

function elegir(nombre: string) {
  fireEvent.click(screen.getByRole('button', { name: /Forma de medir/ }));
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: new RegExp(nombre) }));
}

beforeEach(() => {
  useObraStore.getState().reset();
});

describe('forma de medir en la tabla de medición', () => {
  it('sin forma elegida manda la unidad (m³ → las cuatro columnas)', () => {
    render(<Harness />);
    expect(headers()).toEqual(['Comentario', 'Uds', 'Longitud', 'Anchura', 'Altura', 'Parcial']);
    expect(screen.getByRole('button', { name: 'Forma de medir: Volumen' })).toBeInTheDocument();
  });

  it('«Superficie directa» cambia la cabecera y escribe la superficie en `largo`', () => {
    useObraStore.getState().addMedLine('01', 'p111');
    const n = partida().med.length;
    // Vacía las líneas del seed para que no fuercen columnas extra.
    for (let i = n - 2; i >= 0; i--) useObraStore.getState().deleteMedLine('01', 'p111', i);
    render(<Harness />);
    elegir('Superficie directa');
    expect(partida().medForma).toBe('area');
    expect(headers()).toEqual(['Comentario', 'Uds', 'Superficie', 'Parcial']);

    fireEvent.click(screen.getByLabelText('Superficie'));
    const input = screen.getByLabelText('Superficie');
    fireEvent.change(input, { target: { value: '316.3978' } }); // pegado de CAD, punto decimal
    fireEvent.keyDown(input, { key: 'Enter' });
    const l = partida().med[0]!;
    expect(l.largo).toBe(316.3978);
    expect(l.ancho).toBe('');
    expect(l.alto).toBe('');
  });

  it('una columna con datos que la forma no usa sigue a la vista, marcada', () => {
    render(<Harness />);
    elegir('Superficie directa'); // las líneas del seed tienen ancho y alto
    expect(headers()).toEqual(['Comentario', 'Uds', 'Superficie', 'Anchura', 'Altura', 'Parcial']);
    expect(screen.getByRole('columnheader', { name: 'Altura' })).toHaveAttribute('title');
    expect(screen.getByRole('columnheader', { name: 'Superficie' })).not.toHaveAttribute('title');
  });

  it('«Según la unidad» vuelve a la forma de la ud', () => {
    render(<Harness />);
    elegir('Superficie directa');
    elegir('Según la unidad');
    expect(partida().medForma).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Forma de medir: Volumen' })).toBeInTheDocument();
  });

  it('en «Peso», escribir el perfil en el comentario rellena el kg/m', () => {
    useObraStore.getState().setMedForma('01', 'p111', 'peso');
    useObraStore.getState().addMedLine('01', 'p111');
    const n = partida().med.length;
    render(<Harness />);
    const comentario = screen.getAllByLabelText('Comentario de la línea')[n - 1]!;
    fireEvent.click(comentario);
    const input = screen.getAllByLabelText('Comentario de la línea')[n - 1]!;
    fireEvent.change(input, { target: { value: 'IPE300' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getAllByLabelText('kg/m')[n - 1]).toHaveTextContent('IPE 30042,20');
  });

  it('en compacto las tarjetas usan los mismos rótulos', () => {
    useObraStore.getState().setMedForma('01', 'p111', 'areaEsp');
    render(<Harness compact />);
    // Las líneas del seed tienen ancho → «Espesor» (casilla ancho) y la Altura fuera de forma.
    expect(screen.getAllByLabelText('Superficie')).toHaveLength(2);
    expect(screen.getAllByLabelText('Espesor')).toHaveLength(2);
    expect(screen.getAllByLabelText('Altura')).toHaveLength(2);
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Partida } from '../../core/types';
import { blankObraData, useObraStore } from '../../store';
import { AnejosView } from '../anejos/AnejosView';
import { useAnejoStore } from '../anejos/anejoStore';
import { SeguridadView } from './SeguridadView';

const state = () => useObraStore.getState();
const p = (id: string, title: string): Partida => ({
  id,
  pos: id,
  code: id,
  title,
  ud: 'm²',
  precio: 100,
  cantidad: 10,
  desc: '',
  med: [],
  items: [],
});

/** Reforma inventada: demolición, cubierta inclinada y un capítulo de seguridad y salud. */
function cargar() {
  const d = blankObraData('Reforma de prueba');
  Object.assign(d, {
    chapters: [
      { id: 'c1', code: '1', title: 'Demoliciones' },
      { id: 'c2', code: '2', title: 'Cubiertas' },
      { id: 'c3', code: '3', title: 'Seguridad y salud' },
    ],
    partidas: {
      c1: [p('DRS020', 'Demolición de pavimento cerámico.')],
      c2: [p('QTT200', 'Cubierta inclinada de teja cerámica.')],
      c3: [p('YCX010', 'Andamio tubular de fachada.')],
    },
  });
  state().loadObra(d);
}

const teclear = (input: HTMLElement, valor: string) => {
  fireEvent.change(input, { target: { value: valor } });
  fireEvent.keyDown(input, { key: 'Enter' });
};

beforeEach(() => {
  useAnejoStore.getState().setAnejo('residuos');
});

describe('vista Seguridad y salud', () => {
  it('es la tercera pestaña de Anejos', async () => {
    cargar();
    render(<AnejosView compact={false} onGoPresupuesto={() => undefined} />);
    fireEvent.click(await screen.findByRole('tab', { name: /Seguridad y salud/ }));
    expect(
      await screen.findByRole('button', { name: /Empezar el estudio/ }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(useAnejoStore.getState().anejo).toBe('seguridad');
  });

  it('empezar: fichas propuestas por las partidas; quitar una y teclear los datos', () => {
    cargar();
    render(<SeguridadView compact={false} onGoPresupuesto={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Empezar el estudio/ }));
    expect(state().seguridadSalud).toMatchObject({ version: 1, capituloSs: 'c3' });

    // La cubierta inclinada la pide su partida; el andamio está solo en el capítulo de seguridad y salud.
    const cubierta = screen.getByRole('checkbox', { name: /Cubierta inclinada .* en el estudio/ });
    expect(cubierta).toBeChecked();
    expect(
      screen.queryByRole('checkbox', {
        name: /Andamio tubular o modular de fachada en el estudio/,
      }),
    ).toBeNull();
    fireEvent.click(cubierta);
    expect(state().seguridadSalud?.seleccion).toEqual({ quitadas: ['F17'] });

    fireEvent.click(screen.getByRole('tab', { name: 'Datos' }));
    teclear(screen.getByLabelText('Plazo en días laborables'), '60');
    teclear(screen.getByLabelText('Máximo de trabajadores a la vez'), '4');
    expect(state().seguridadSalud?.manoDeObra).toEqual({ plazoDias: 60, maxTrabajadores: 4 });
    // Sin decir si hay túneles o galerías, el supuesto d) queda sin datos.
    expect(screen.queryByText('Básico')).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: /Túneles, galerías/ }), {
      target: { value: 'no' },
    });
    expect(state().seguridadSalud?.subterraneas).toBe(false);
    expect(screen.getByText('Básico')).toBeInTheDocument();
  });
});

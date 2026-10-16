import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Partida } from '../../core/types';
import { blankObraData, useObraStore } from '../../store';
import { ResiduosView } from './ResiduosView';

const state = () => useObraStore.getState();
const partida = (id: string, code: string, title: string, ud: string, cantidad: number): Partida => ({
  id,
  pos: id,
  code,
  title,
  ud,
  precio: 10,
  cantidad,
  desc: '',
  med: [],
  items: [],
});

beforeEach(() => {
  const d = blankObraData('Reforma de prueba');
  d.obra.provincia = 'Málaga';
  d.chapters = [
    { id: 'd', code: '1', title: 'Demoliciones' },
    { id: 'g', code: '2', title: 'Gestión de residuos' },
  ];
  d.partidas = {
    d: [
      partida('p1', '01ADS00001', 'DEMOLICIÓN DE TABIQUE DE L/ HUECO SENCILLO, C. MANUAL, T. VERT.', 'm2', 38.5),
      partida('p2', 'X2', 'Desmontaje de falso techo de escayola', 'm²', 15),
    ],
    g: [partida('g1', 'G1', 'Retirada de residuos mixtos a planta de valorización', 'm³', 10)],
  };
  state().loadObra(d);
});

describe('vista Residuos', () => {
  it('sin estudio: estado vacío con «Empezar el estudio»', () => {
    render(<ResiduosView compact={false} onGoPresupuesto={() => undefined} />);
    expect(screen.getByText('Estudio de gestión de residuos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Empezar el estudio/ }));
    expect(state().estudioRcd).toBeDefined();
    expect(state().partidas.d![0]!.rcd!.estado).toBe('propuesta');
  });

  it('confirmar las propuestas mete sus toneladas en la estimación', () => {
    state().iniciarEstudioRcd();
    render(<ResiduosView compact={false} onGoPresupuesto={() => undefined} />);
    // por revisar: el tabique y la escayola
    fireEvent.click(screen.getByRole('button', { name: /Confirmar las 2 propuestas/ }));
    expect(state().partidas.d![0]!.rcd!.estado).toBe('confirmada');
    fireEvent.click(screen.getByRole('tab', { name: 'Estimación' }));
    const tabla = screen.getAllByRole('table')[0]!;
    expect(within(tabla).getByText('Ladrillos')).toBeInTheDocument();
    expect(within(tabla).getAllByText('2,310').length).toBeGreaterThan(0); // 38,5 m² × 0,06 t/m²
  });

  it('la escayola sin densidad sale en «Antes de entregar» con su partida', () => {
    state().iniciarEstudioRcd();
    state().confirmarResiduos([{ chapterId: 'd', partidaId: 'p2' }]);
    render(<ResiduosView compact={false} onGoPresupuesto={() => undefined} />);
    fireEvent.click(screen.getByRole('tab', { name: /Antes de entregar/ }));
    expect(screen.getByText(/Partida X2 .*falta espesor y densidad/)).toBeInTheDocument();
  });

  it('el editor cambia el espesor con Enter y la cuenta se rehace', () => {
    state().iniciarEstudioRcd();
    render(<ResiduosView compact={false} onGoPresupuesto={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /falso techo de escayola/ }));
    const espesor = screen.getByLabelText('Espesor');
    fireEvent.change(espesor, { target: { value: '0,02' } });
    fireEvent.keyDown(espesor, { key: 'Enter' });
    const c = state().partidas.d![1]!.rcd!.componentes[0]!;
    expect(c.conversion).toEqual({ modo: 'espesor', espesor: 0.02 });
    const densidad = screen.getByLabelText('Densidad del material en obra');
    fireEvent.change(densidad, { target: { value: '0,9' } });
    fireEvent.keyDown(densidad, { key: 'Enter' });
    expect(screen.getByText('15 m² × 0,02 m × 0,9 t/m³ = 0,27 t')).toBeInTheDocument();
  });

  it('el capítulo de gestión se enlaza solo por su título y es el 7.º', () => {
    state().iniciarEstudioRcd();
    render(<ResiduosView compact={false} onGoPresupuesto={() => undefined} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Estimación' }));
    expect(screen.getByRole('combobox', { name: /Capítulo de gestión/ })).toHaveValue('g');
    expect(screen.getByText('Retirada de residuos mixtos a planta de valorización')).toBeInTheDocument();
  });

  it('obra nueva: los ratios de ECO-eficiencia aparecen en «Datos»', () => {
    state().iniciarEstudioRcd();
    state().setEstudioRcd({ tipos: ['nueva'] });
    render(<ResiduosView compact={false} onGoPresupuesto={() => undefined} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Datos' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Método' }), { target: { value: 'eco-detallado' } });
    expect(state().estudioRcd!.ratios).toMatchObject({ metodo: 'ecoeficiencia', nivel: 'detallado' });
    const s = screen.getByLabelText('Superficie construida');
    fireEvent.change(s, { target: { value: '180' } });
    fireEvent.keyDown(s, { key: 'Enter' });
    expect(state().estudioRcd!.ratios!.superficieConstruida).toBe(180);
  });
});

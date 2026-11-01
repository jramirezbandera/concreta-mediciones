import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bc3ToObra } from '../../core/bc3import';
import { obraToBc3 } from '../../core/bc3export';
import { filasDeObra, type Oferta } from '../../core/ofertas';
import type { Partida } from '../../core/types';
import { blankObraData, useObraStore } from '../../store';
import { __resetHistoryForTests, initHistory } from '../../store/temporal';
import { ofertaDesdeFilas } from './importarOferta';
import { OfertasView } from './OfertasView';

const state = () => useObraStore.getState();
const partida = (id: string, code: string, title: string, cantidad: number, precio: number): Partida => ({
  id,
  pos: id,
  code,
  title,
  ud: 'm²',
  precio,
  cantidad,
  desc: '',
  med: [],
  items: [],
});
const oferta = (id: string, empresa: string, precios: Record<string, number>): Oferta => ({
  id,
  empresa,
  fecha: '2026-11-01T10:00:00.000Z',
  fichero: `${empresa}.bc3`,
  precios,
  cantidades: {},
  sinCasar: [],
});

beforeEach(() => {
  __resetHistoryForTests();
  const d = blankObraData('Reforma');
  d.chapters = [{ id: 'a', code: '1', title: 'Albañilería' }];
  d.partidas = { a: [partida('p1', 'ALB01', 'Tabique', 100, 20), partida('p2', 'ALB02', 'Enfoscado', 50, 10)] };
  state().loadObra(d);
  initHistory(useObraStore);
});
afterEach(() => __resetHistoryForTests());

const vista = () => render(<OfertasView compact={false} onGoPresupuesto={vi.fn()} />);

describe('OfertasView', () => {
  it('sin ofertas explica cómo pedirlas y ofrece añadir una', () => {
    vista();
    expect(screen.getByText('Comparativo de ofertas')).toBeInTheDocument();
    expect(screen.getByText(/Mediciones sin precios/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Añadir oferta/ })).toBeInTheDocument();
  });

  it('sin presupuesto lleva al presupuesto', () => {
    state().loadObra(blankObraData('Vacía'));
    vista();
    expect(screen.getByText('Aún no hay presupuesto que comparar')).toBeInTheDocument();
  });

  it('compara cada oferta con el presupuesto y marca la más baja', () => {
    state().addOferta(oferta('o1', 'Pérez', { p1: 22, p2: 9 }));
    state().addOferta(oferta('o2', 'García', { p1: 18 }));
    vista();
    expect(screen.getAllByText('Pérez').length).toBeGreaterThan(0);
    // Totales de las tarjetas: 2.650 € y 1.800 € (García, incompleta).
    expect(screen.getByText('2.650,00 €')).toBeInTheDocument();
    expect(screen.getByText(/Incompleta/)).toBeInTheDocument();
    expect(screen.getByText('sin precio')).toBeInTheDocument();
    const fila = screen.getByText('Tabique').closest('tr')!;
    expect(within(fila).getByText('+10,0 %')).toBeInTheDocument();
    expect(within(fila).getByText('−10,0 %')).toBeInTheDocument();
  });

  it('renombrar y quitar una oferta (con Deshacer)', () => {
    state().addOferta(oferta('o1', 'Pérez', { p1: 22, p2: 9 }));
    vista();
    fireEvent.change(screen.getByLabelText('Nombre de la constructora'), { target: { value: 'Pérez S.L.' } });
    expect(state().ofertas![0]!.empresa).toBe('Pérez S.L.');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar la oferta de Pérez S.L.' }));
    expect(state().ofertas).toBeUndefined();
  });
});

describe('ofertaDesdeFilas', () => {
  it('el .bc3 sin precios devuelto con precios casa entero con la obra', () => {
    const s = state();
    const vuelta = bc3ToObra(obraToBc3(s, { sinPrecios: true })).data;
    for (const ps of Object.values(vuelta.partidas)) for (const p of ps) p.precio = p.code === 'ALB01' ? 21 : 11;
    const { oferta: o, casamiento } = ofertaDesdeFilas(filasDeObra(vuelta), 'Construcciones_Pérez.bc3', s);
    expect(o.empresa).toBe('Construcciones Pérez');
    expect(o.precios).toEqual({ p1: 21, p2: 11 });
    expect(casamiento.sinCasar).toEqual([]);
  });
});

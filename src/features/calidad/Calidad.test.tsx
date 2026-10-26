import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PartidasMap } from '../../core/types';
import { obraA, RATES } from '../../test/fixtures/pcc/obras';
import { blankObraData, useObraStore } from '../../store';
import { AnejosView } from '../anejos/AnejosView';
import { useAnejoStore } from '../anejos/anejoStore';
import { CalidadView } from './CalidadView';

const state = () => useObraStore.getState();

/** La obra A del plan sin nada asignado: como llega de un .bc3. */
function cargarObraA() {
  const o = obraA();
  const partidas: PartidasMap = Object.fromEntries(
    Object.entries(o.partidas).map(([ch, ps]) => [ch, (ps ?? []).map(({ pcc: _pcc, ...p }) => p)]),
  );
  const d = blankObraData('Unifamiliar A');
  Object.assign(d, { chapters: o.chapters, partidas, obra: o.obra, rates: RATES });
  state().loadObra(d);
  return o;
}

const teclear = (input: HTMLElement, valor: string) => {
  fireEvent.change(input, { target: { value: valor } });
  fireEvent.keyDown(input, { key: 'Enter' });
};

beforeEach(() => {
  useAnejoStore.getState().setAnejo('residuos');
});

describe('vista Anejos', () => {
  it('residuos y calidad, cada uno en su pestaña', async () => {
    cargarObraA();
    render(<AnejosView compact={false} onGoPresupuesto={() => undefined} />);
    expect(await screen.findByText('Estudio de gestión de residuos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Control de calidad/ }));
    expect(await screen.findByRole('button', { name: /Empezar el plan de control/ })).toBeInTheDocument();
    expect(useAnejoStore.getState().anejo).toBe('calidad');
  });
});

describe('vista Calidad', () => {
  it('la obra A se asigna entera en pantalla (hito de E3)', () => {
    const o = cargarObraA();
    render(<CalidadView compact={false} onGoPresupuesto={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Empezar el plan de control/ }));
    expect(state().planCalidad).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Confirmar las \d+/ }));
    const todas = Object.values(state().partidas).flat();
    expect(todas.every((p) => p.pcc && p.pcc.estado !== 'propuesta')).toBe(true);

    // los datos de la obra, tecleados una vez
    fireEvent.click(screen.getByRole('tab', { name: 'Datos' }));
    teclear(screen.getByLabelText('Superficie construida'), '300');
    teclear(screen.getByLabelText('Plantas'), '2');
    expect(state().planCalidad).toMatchObject({ superficieConstruida: 300, plantas: 2 });

    // lo demás, como en la obra A del plan
    state().setPlanCalidad(o.plan);
    fireEvent.click(screen.getByRole('tab', { name: 'Estructura' }));
    const total = screen.getByText('Total').closest('tr')!;
    expect(within(total).getByText('15')).toBeInTheDocument(); // amasadas
    expect(screen.getByText('amasadas a controlar').previousSibling).toHaveTextContent('15');
  });

  it('el dato de un grupo se teclea en su fila y la cuenta se rehace', () => {
    cargarObraA();
    state().iniciarPlanCalidad();
    state().confirmarControles(Object.entries(state().partidas).flatMap(([chapterId, ps]) => (ps ?? []).map((p) => ({ chapterId, partidaId: p.id }))));
    render(<CalidadView compact={false} onGoPresupuesto={() => undefined} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Estructura' }));
    teclear(screen.getByLabelText('Semanas de cim_superficial|HA-25/B/20/XC2'), '2');
    expect(state().planCalidad!.grupos!['cim_superficial|HA-25/B/20/XC2']).toEqual({ semanas: 2 });
  });

  it('el editor cambia el tipo de elemento y pasa la partida a «a mano»', () => {
    cargarObraA();
    state().iniciarPlanCalidad();
    render(<CalidadView compact={false} onGoPresupuesto={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /HA-25\/B\/20\/XC1 en pilares/ }));
    fireEvent.change(screen.getByRole('combobox', { name: /Tipo de elemento/ }), { target: { value: 'flexion' } });
    const p = state().partidas.est!.find((x) => x.code === '05HHP00010')!;
    expect(p.pcc).toMatchObject({ estado: 'propuesta', origen: { tipo: 'manual' }, hormigon: { fila: 'flexion' } });
  });

  it('valoración con la fuente de cada precio; un precio pendiente se teclea', () => {
    const o = cargarObraA();
    state().iniciarPlanCalidad();
    state().confirmarControles(Object.entries(state().partidas).flatMap(([chapterId, ps]) => (ps ?? []).map((p) => ({ chapterId, partidaId: p.id }))));
    state().setPlanCalidad(o.plan);
    render(<CalidadView compact={false} onGoPresupuesto={() => undefined} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Valoración' }));
    expect(screen.getAllByText(/^Hoja de la Junta/).length).toBeGreaterThan(0);
    const pendientes = screen.queryAllByText('Pendiente');
    if (pendientes.length) {
      const fila = pendientes[0]!.closest('tr')!;
      teclear(within(fila).getByRole('textbox'), '25');
      expect(Object.values(state().planCalidad!.preciosManuales!)).toContain(25);
    }
    expect(screen.getByText(/del PEM sin el capítulo de control/)).toBeInTheDocument();
  });

  it('un ensayo de nivel 2 se marca con su casilla (D8)', () => {
    const o = cargarObraA();
    state().iniciarPlanCalidad();
    state().confirmarControles(Object.entries(state().partidas).flatMap(([chapterId, ps]) => (ps ?? []).map((p) => ({ chapterId, partidaId: p.id }))));
    state().setPlanCalidad(o.plan);
    render(<CalidadView compact={false} onGoPresupuesto={() => undefined} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Plan' }));
    const casilla = screen.getAllByRole('checkbox', { name: /^Incluir / }).find((x) => !(x as HTMLInputElement).checked && !(x as HTMLInputElement).disabled)!;
    fireEvent.click(casilla);
    expect(Object.values(state().planCalidad!.marcados!)).toContain(true);
  });

  it('«Antes de entregar» lleva a la partida que falta revisar', () => {
    cargarObraA();
    state().iniciarPlanCalidad();
    render(<CalidadView compact={false} onGoPresupuesto={() => undefined} />);
    fireEvent.click(screen.getByRole('tab', { name: /Antes de entregar/ }));
    const pend = screen.getByText(/con el control propuesto sin revisar/).closest('div')!;
    fireEvent.click(within(pend).getByRole('button', { name: 'Ir' }));
    expect(screen.getByRole('tab', { name: 'Partidas' })).toHaveAttribute('aria-selected', 'true');
  });
});

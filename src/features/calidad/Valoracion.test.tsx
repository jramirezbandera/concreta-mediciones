import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefSource } from '../../core/refdata';
import type { PartidasMap } from '../../core/types';
import { useSessionStore } from '../../persist';
import { blankObraData, useObraStore } from '../../store';
import { obraA, RATES } from '../../test/fixtures/pcc/obras';
import { CalidadView } from './CalidadView';

/* «Tomar precios de un banco» (A1) y la obra en solo lectura: los casos que la revisión añadió
   al mapa de cobertura (docs/plan-control-calidad.md, «Mapa de cobertura», T13). */

const BCCA: RefSource = {
  id: 'bcca',
  kind: 'base',
  name: 'BCCA 2023',
  org: 'Junta de Andalucía',
  chapters: [{ id: '18', code: '18', title: 'Control de calidad' }],
  partidas: { '18': [{ id: 'r1', pos: '1', code: '18HHL00010', title: 'Compresión', ud: 'ud', precio: 61.5, items: [], desc: 'Ensayo de compresión' }] },
};
vi.mock('../referencia/obraSource', () => ({ loadObraRefSource: vi.fn(async () => BCCA) }));

const state = () => useObraStore.getState();

function cargarObraA() {
  const o = obraA();
  const d = blankObraData('Unifamiliar A');
  Object.assign(d, { chapters: o.chapters, partidas: o.partidas as PartidasMap, obra: o.obra, rates: RATES, planCalidad: o.plan });
  state().loadObra(d);
}

beforeEach(() => {
  useSessionStore.setState({
    obras: [{ id: 'bcca', name: 'BCCA 2023', savedAt: '2026-10-26T00:00:00Z', schemaVersion: 8, kind: 'reference' }],
    activeId: 'obra-activa',
  });
});
afterEach(() => useSessionStore.getState().setReadonly(false));

describe('«Tomar precios de un banco» (A1)', () => {
  it('enseña «pasaría de A a B» sin aplicar nada; «Aplicar» copia los precios al plan', async () => {
    cargarObraA();
    render(<CalidadView compact={false} onGoPresupuesto={() => undefined} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Valoración' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Tomar precios de un banco/ })));
    const previa = await screen.findByRole('status');
    // compresión: 15 amasadas de 59,28 € (hoja) a 61,50 € (banco) → +33,30 €
    expect(previa).toHaveTextContent(/Con «BCCA 2023» el total pasaría de .+ a .+: 1 precio del banco/);
    expect(previa).toHaveTextContent(/sin código en el banco siguen con su fuente/);
    expect(state().planCalidad!.precios).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: /Aplicar/ }));
    expect(state().planCalidad!.precios!['j03-008']).toMatchObject({ precio: 61.5, banco: 'BCCA 2023', codigo: '18HHL00010' });
    expect(screen.getByText(/BCCA 2023 · 18HHL00010/)).toBeInTheDocument();
  });

  it('«Cancelar» no aplica nada', async () => {
    cargarObraA();
    render(<CalidadView compact={false} onGoPresupuesto={() => undefined} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Valoración' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Tomar precios de un banco/ })));
    await screen.findByRole('status');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(state().planCalidad!.precios).toBeUndefined();
  });
});

describe('obra guardada por una versión más nueva de la app', () => {
  it('en solo lectura, «Empezar el plan» no toca la obra', () => {
    const d = blankObraData('Unifamiliar A');
    Object.assign(d, { chapters: obraA().chapters, partidas: obraA().partidas, obra: obraA().obra, rates: RATES });
    state().loadObra(d);
    useSessionStore.getState().setReadonly(true, 'mas-nueva');
    render(<CalidadView compact={false} onGoPresupuesto={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Empezar el plan de control/ }));
    expect(state().planCalidad).toBeUndefined();
  });
});

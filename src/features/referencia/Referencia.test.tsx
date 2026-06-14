import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// La app ya no precarga bases (REF_SOURCES vacío); para ejercitar el panel,
// reinyectamos las bases demo como fuentes estáticas en este spec.
vi.mock('../../core/refdata', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/refdata')>();
  return { ...actual, REF_SOURCES: actual.DEMO_REF_SOURCES };
});

import { useObraStore } from '../../store';
import { ReferenciaPanel } from './ReferenciaPanel';

beforeEach(() => {
  useObraStore.getState().reset();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('ReferenciaPanel (F5.1)', () => {
  it('muestra la fuente activa y su árbol de partidas', () => {
    render(<ReferenciaPanel />);
    expect(screen.getByText('Base de Precios de la Construcción 2025')).toBeInTheDocument();
    // capítulo A abierto por defecto → su primera partida visible
    expect(screen.getByText('ADE010')).toBeInTheDocument();
  });

  it('el buscador filtra por código/título', () => {
    render(<ReferenciaPanel />);
    fireEvent.change(screen.getByLabelText('Buscar partida o código'), { target: { value: 'colector' } });
    expect(screen.getByText('ASA010')).toBeInTheDocument();
    expect(screen.queryByText('ADE010')).toBeNull();
  });

  it('copiar una partida con "←" la añade al presupuesto activo con chip BASE', () => {
    render(<ReferenciaPanel />);
    const n0 = useObraStore.getState().partidas['01']!.length;
    fireEvent.click(screen.getByLabelText('Copiar ADE010 a mi presupuesto'));
    const list = useObraStore.getState().partidas['01']!;
    expect(list).toHaveLength(n0 + 1);
    expect(list.at(-1)!.code).toBe('ADE010');
    expect(list.at(-1)!.fromBase).toBe(true);
  });

  it('el toggle "contradictorio" hace que la copia se marque P.C.', () => {
    render(<ReferenciaPanel />);
    fireEvent.click(screen.getByText('Copiar como precio contradictorio'));
    fireEvent.click(screen.getByLabelText('Copiar ADE010 a mi presupuesto'));
    expect(useObraStore.getState().partidas['01']!.at(-1)!.contradictorio).toBe(true);
  });

  it('seleccionar varias y "Copiar a" las vuelca al capítulo activo', () => {
    render(<ReferenciaPanel />);
    const n0 = useObraStore.getState().partidas['01']!.length;
    fireEvent.click(screen.getByLabelText('Seleccionar ADE010'));
    fireEvent.click(screen.getByLabelText('Seleccionar ADR010'));
    // aparece la barra de selección con el botón "Copiar a {label}"
    fireEvent.click(screen.getByText('Copiar a'));
    expect(useObraStore.getState().partidas['01']!).toHaveLength(n0 + 2);
  });

  it('cambiar de fuente actualiza el árbol', () => {
    render(<ReferenciaPanel />);
    fireEvent.click(screen.getByText('Base de Precios de la Construcción 2025'));
    fireEvent.click(screen.getByText('Reforma local C/ Goya 28'));
    // partida de la nueva fuente visible (cap "Demoliciones" abierto por defecto)
    expect(screen.getByText('DPT020')).toBeInTheDocument();
    expect(screen.queryByText('ADE010')).toBeNull();
  });

  it('copiar capítulo entero vuelca todas sus partidas', () => {
    render(<ReferenciaPanel />);
    const n0 = useObraStore.getState().partidas['01']!.length;
    fireEvent.click(screen.getByLabelText('Copiar capítulo A entero'));
    // capítulo A de la base BDT = 3 partidas (ADE010, ADR010, ASA010)
    expect(useObraStore.getState().partidas['01']!).toHaveLength(n0 + 3);
  });

  it('arrastrar una partida publica el payload y soltar lo limpia (F5.2)', () => {
    render(<ReferenciaPanel />);
    const dt = { effectAllowed: '', setData: () => {} };
    fireEvent.dragStart(screen.getByText('ADE010'), { dataTransfer: dt });
    const drag = useObraStore.getState().refDrag;
    expect(drag).not.toBeNull();
    expect(drag!.items[0]!.partida.code).toBe('ADE010');
    expect(drag!.contra).toBe(false);
    fireEvent.dragEnd(screen.getByText('ADE010'));
    expect(useObraStore.getState().refDrag).toBeNull();
  });

  it('el toggle contradictorio se congela en el payload de arrastre (F5.2)', () => {
    render(<ReferenciaPanel />);
    fireEvent.click(screen.getByText('Copiar como precio contradictorio'));
    fireEvent.dragStart(screen.getByText('ADE010'), { dataTransfer: { effectAllowed: '', setData: () => {} } });
    expect(useObraStore.getState().refDrag!.contra).toBe(true);
  });
});

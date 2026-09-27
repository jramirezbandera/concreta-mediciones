/* «Planos (ejemplo)» del sandbox (§10): desde `npm run dev` → `/#sandbox` →
   «Abrir el ejemplo de planos», medir el tabique da `largo = 5`, `expr` «5», un
   `origen` completo y un paso de Deshacer. El ejemplo es este test. */
import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { origenLegible } from '../../core/planoDatos';
import { __resetPlanosForTests } from '../../persist/planos';
import { useObraStore } from '../../store';
import { usePlanoUiStore } from '../../store/planoUiStore';
import { __historyState, __resetHistoryForTests, initHistory, undo } from '../../store/temporal';
import { Sandbox } from '../sandbox/Sandbox';
import { EJEMPLO } from './ejemplo';
import { __setMotorPdfForTests } from './motor';
import { crearAdapterFake } from './pdfAdapter.fake';
import { PlanosPanel } from './PlanosPanel';

const st = () => useObraStore.getState();
const tabique = () => Object.values(st().partidas).flat().find((p) => p.id === EJEMPLO.tabique)!;

beforeEach(async () => {
  await __resetPlanosForTests();
  usePlanoUiStore.getState().reset();
  __setMotorPdfForTests(crearAdapterFake());
  vi.spyOn(console, 'error').mockImplementation(() => undefined); // jsdom: sin canvas
});
afterEach(() => {
  __setMotorPdfForTests(null);
  __resetHistoryForTests();
  vi.restoreAllMocks();
});

describe('Planos (ejemplo)', () => {
  it('desde el sandbox: abre el plano ya calibrado y medir el tabique da 5 m con su origen', async () => {
    const onBack = vi.fn();
    const sandbox = render(<Sandbox onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /Abrir el ejemplo de planos/ }));
    await waitFor(() => expect(onBack).toHaveBeenCalled());
    sandbox.unmount();
    expect(st().obra.denominacion).toBe('Planos (ejemplo)');
    expect(st().lateral).toBe('planos');
    __resetHistoryForTests();
    initHistory(useObraStore);

    const { container } = render(<PlanosPanel estrecha={false} onCerrar={() => undefined} />);
    const lienzo = await screen.findByRole('application');
    await waitFor(() => expect(screen.queryByText('Pintando…')).toBeNull());
    const visor = container.querySelector<HTMLElement>('[data-planos-viewer]')!;
    const v = JSON.parse(lienzo.dataset.vista!) as { s: number; tx: number; ty: number };
    const clic = ([x, y]: [number, number]) =>
      fireEvent.click(lienzo, { clientX: v.tx + v.s * x, clientY: v.ty + v.s * (841.89 - y), detail: 1, button: 0 });

    fireEvent.keyDown(visor, { key: 'l' });
    clic(EJEMPLO.tabiqueDe);
    clic(EJEMPLO.tabiqueA);
    fireEvent.keyDown(visor, { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Comentario de la línea' }), { key: 'Enter' });

    const l = tabique().med[0]!;
    expect(l.largo).toBe(5);
    expect(l.expr).toEqual({ largo: '5' });
    expect(origenLegible(l.origen)).toBe(true);
    expect(l.origen).toMatchObject({ planoId: EJEMPLO.planoId, pagina: 1, herramienta: 'longitud', n: 50 });
    expect(__historyState().past).toBe(1);
    act(() => undo());
    expect(tabique().med).toHaveLength(0);
  });
});

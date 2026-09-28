/* Marcador de origen de las líneas medidas en un plano (§5.6): sus tres
   estados, que no es una celda (ni Tab ni el TSV lo ven), «Ver en plano» y que
   con el visor apagado la tabla no cambia. */
import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lineasATsv } from '../../core/medTsv';
import type { Partida, PlanoMeta } from '../../core/types';
import { __resetPlanosForTests, registrarBytesEnMemoria } from '../../persist/planos';
import { fromSerializable, useObraStore, type ObraData } from '../../store';
import { useMedUiStore } from '../../store/medUiStore';
import { usePlanoUiStore } from '../../store/planoUiStore';
import a0 from '../../test/fixtures/planos/obra-v6-a0.json';
import { __setPlanosActivosForTests } from '../planos/flag';
import { DetailPanel } from './DetailPanel';

const A0 = a0 as unknown as ObraData;
const st = () => useObraStore.getState();
const partida = (id: string) => Object.values(st().partidas).flat().find((p) => p.id === id)! as Partida;
const panel = (id: string) => render(<DetailPanel p={partida(id)} chapterId="c01" />);

beforeEach(async () => {
  await __resetPlanosForTests();
  usePlanoUiStore.getState().reset();
  useMedUiStore.getState().reset();
  __setPlanosActivosForTests(true);
  st().loadObra(fromSerializable(structuredClone(A0)));
  registrarBytesEnMemoria(A0.planos[0]!.huella, new ArrayBuffer(8)); // el PDF está en este navegador
});
afterEach(() => {
  __setPlanosActivosForTests(false);
  document.body.innerHTML = '';
});

describe('marcador de origen', () => {
  it('normal: el número de la línea, fuera del grid (ni Tab ni el TSV lo ven)', async () => {
    const { container } = panel('p-solado');
    const m = await screen.findByRole('button', { name: /^Línea 1: medida en el plano/ });
    expect(m).toHaveTextContent('1');
    expect(m).toHaveAttribute('tabindex', '-1');
    expect(m.closest('[data-editfield]')).toBeNull();
    // la columna del marcador no desplaza los campos: el comentario sigue siendo la col 0
    expect(container.querySelector('[data-col="0"]')?.textContent).toContain('Salón');
    expect(lineasATsv(partida('p-solado').med)).not.toMatch(/pl-p1|f-salon/);
  });

  it('retocada a mano: «✎»', async () => {
    useObraStore.setState((s) => {
      s.partidas.c01!.find((p) => p.id === 'p-solado')!.med[0]!.largo = 21;
    });
    panel('p-solado');
    const m = await screen.findByRole('button', { name: /^Línea 1: retocada a mano/ });
    expect(m).toHaveTextContent('✎');
  });

  it('[A1] retocada: «Aceptar valores actuales» y «Desvincular del plano»', async () => {
    useObraStore.setState((s) => {
      s.partidas.c01!.find((p) => p.id === 'p-solado')!.med[0]!.largo = 21;
    });
    const r = panel('p-solado');
    fireEvent.click(await screen.findByRole('button', { name: /^Línea 1: retocada a mano/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar valores actuales' }));
    const l = () => partida('p-solado').med[0]!;
    expect(l().origen).toMatchObject({ aceptada: true, valores: { largo: 20 } });
    expect(l().largo).toBe(21);
    r.unmount();
    panel('p-solado');
    fireEvent.click(await screen.findByRole('button', { name: /^Línea 1: valores aceptados/ }));
    expect(screen.getByText(/Valores aceptados: los recálculos no la tocan/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aceptar valores actuales' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Desvincular del plano' }));
    expect(l().origen).toBeUndefined();
    expect(l().largo).toBe(21); // los números se quedan
  });

  it('una línea sin retocar no ofrece aceptar ni desvincular', async () => {
    panel('p-solado');
    fireEvent.click(await screen.findByRole('button', { name: /^Línea 1: medida en el plano/ }));
    expect(screen.queryByRole('button', { name: 'Aceptar valores actuales' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Desvincular del plano' })).toBeNull();
  });

  it('atenuado: plano quitado, no disponible en este navegador o procedencia ilegible', async () => {
    st().removePlano({ planoId: 'pl-p1', expect: { docToken: st().docToken } });
    const r1 = panel('p-solado');
    expect(await screen.findAllByRole('button', { name: /plano quitado/ })).toHaveLength(2); // Salón y hueco
    r1.unmount();

    st().attachPlano({ meta: structuredClone(A0.planos[0]!) as PlanoMeta, expect: { docToken: st().docToken } });
    await __resetPlanosForTests(); // sin los bytes
    usePlanoUiStore.getState().reset();
    const r2 = panel('p-solado');
    const noDisp = await screen.findAllByRole('button', { name: /plano no disponible/ });
    fireEvent.click(noDisp[0]!);
    expect(screen.getByText(/Vuelve a adjuntar el PDF «Planta primera\.pdf» \(2,4 MB\)/)).toBeInTheDocument();
    r2.unmount();

    useObraStore.setState((s) => {
      (s.partidas.c01!.find((p) => p.id === 'p-solado')!.med[0] as unknown as { origen: unknown }).origen = { raro: true };
    });
    panel('p-solado');
    expect(await screen.findByRole('button', { name: /procedencia ilegible/ })).toBeInTheDocument();
  });

  it('«Ver en plano» abre el visor en la página de la forma y la destaca', async () => {
    panel('p-solado');
    fireEvent.click(await screen.findByRole('button', { name: /^Línea 1:/ }));
    const pop = screen.getByText('Ver en plano').closest('div')!.parentElement!;
    expect(within(pop).getByText(/Página 1 · 1:50 · Superficie/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver en plano' }));
    expect(st().lateral).toBe('planos');
    await waitFor(() =>
      expect(usePlanoUiStore.getState().destacar).toMatchObject({ planoId: 'pl-p1', pagina: 1, formaId: 'f-salon', lineId: 'l-salon' }),
    );
  });

  it('con el interruptor apagado, la tabla no enseña el marcador', () => {
    __setPlanosActivosForTests(false);
    const { container } = panel('p-solado');
    expect(screen.queryByRole('button', { name: /^Línea 1:/ })).toBeNull();
    expect(container.querySelector('th[aria-label="Plano"]')).toBeNull();
  });

  it('una partida sin líneas medidas en un plano no pinta la columna', () => {
    useObraStore.setState((s) => {
      for (const p of s.partidas.c01!) for (const l of p.med) delete l.origen;
    });
    const { container } = panel('p-solado');
    expect(container.querySelector('th[aria-label="Plano"]')).toBeNull();
  });
});

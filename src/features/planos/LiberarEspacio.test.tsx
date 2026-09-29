/* «Liberar espacio» desde la lista de planos (§9.4, A1). */
import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { clear } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setCanalForTests } from '../../persist/liberar';
import { __resetPlanosForTests, guardarPlano, tienePlano } from '../../persist/planos';
import { blankObraData, useObraStore, useToastStore } from '../../store';
import { usePlanoUiStore } from '../../store/planoUiStore';
import { __resetHistoryForTests } from '../../store/temporal';
import { PlanosPanel } from './PlanosPanel';

const DIA = 86_400_000;
const MB = 1024 * 1024;
const hViejo = 'b'.repeat(64);
const hNuevo = 'c'.repeat(64);

beforeEach(async () => {
  await clear();
  await __resetPlanosForTests();
  __resetHistoryForTests();
  __setCanalForTests(() => null); // sin otras pestañas
  usePlanoUiStore.getState().reset();
  useToastStore.getState().clear();
  useObraStore.getState().loadObra(blankObraData('Obra'));
});
afterEach(() => {
  vi.useRealTimers();
  __setCanalForTests(null);
});

describe('Liberar espacio', () => {
  it('lista los PDF que no usa ninguna obra (no los de menos de 24 h) y los borra tras confirmar', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-20T10:00:00.000Z'));
    await guardarPlano(hViejo, new Uint8Array(2 * MB).buffer, 'application/pdf', 'viejo.pdf');
    vi.setSystemTime(new Date('2026-09-20T10:00:00.000Z').getTime() + 3 * DIA);
    await guardarPlano(hNuevo, new Uint8Array(10).buffer, 'application/pdf', 'nuevo.pdf');

    render(<PlanosPanel estrecha={false} onCerrar={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Liberar espacio/ }));
    const d = await screen.findByRole('dialog');
    const fila = await within(d).findByRole('checkbox', { name: /viejo\.pdf · 2,0 MB · último uso 20\/9\/2026/ });
    expect(fila).toBeChecked();
    expect(within(d).getByText('Un PDF adjuntado en las últimas 24 h no se ofrece.')).toBeInTheDocument();
    expect(within(d).queryByText(/nuevo\.pdf/)).toBeNull();

    fireEvent.click(within(d).getByRole('button', { name: 'Liberar 2,0 MB' }));
    await waitFor(() => expect(useToastStore.getState().msg).toBe('Liberados 2,0 MB (1 PDF)'));
    expect(await tienePlano(hViejo)).toBe(false);
    expect(await tienePlano(hNuevo)).toBe(true);
  });

  it('sin nada que liberar, lo dice', async () => {
    render(<PlanosPanel estrecha={false} onCerrar={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Liberar espacio/ }));
    expect(await screen.findByText('Ningún PDF sin usar: no hay nada que liberar.')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Liberar' })).toBeDisabled();
  });
});

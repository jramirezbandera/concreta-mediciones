import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePersistStore, useSessionStore, type ObraMeta } from '../../persist';
import { CopiaRecordatorio } from './CopiaRecordatorio';

const DIA = 86_400_000;
const meta = (ultimaCopia?: string): ObraMeta => ({
  id: 'o1',
  name: 'Obra',
  savedAt: new Date().toISOString(),
  schemaVersion: 5,
  ...(ultimaCopia ? { ultimaCopia } : {}),
});
// Medio día más: el componente lee el reloj al montar, un poco antes que esto.
const haceDias = (n: number) => new Date(Date.now() - (n + 0.5) * DIA).toISOString();

beforeEach(() => {
  usePersistStore.setState({ durability: 'persisted' });
  useSessionStore.setState({ obras: [meta()], activeId: 'o1' });
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useSessionStore.setState({ obras: [], activeId: null });
});

describe('CopiaRecordatorio (Etapa 0)', () => {
  it('sin copia: botón con el texto en la etiqueta y punto de aviso; al pulsarlo descarga', () => {
    render(<CopiaRecordatorio variant="bar" />);
    const btn = screen.getByRole('button', { name: /Aún no has hecho ninguna copia/ });
    fireEvent.click(btn);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('obras protegidas y copia de hace 6 días: no aparece; de hace 8, sí', () => {
    useSessionStore.setState({ obras: [meta(haceDias(6))] });
    const { rerender } = render(<CopiaRecordatorio variant="bar" />);
    expect(screen.queryByRole('button')).toBeNull();
    act(() => useSessionStore.setState({ obras: [meta(haceDias(8))] }));
    rerender(<CopiaRecordatorio variant="bar" />);
    expect(
      screen.getByRole('button', { name: /Última copia descargada: hace 8 días/ }),
    ).toBeInTheDocument();
  });

  it('si el navegador puede borrarlas, aparece aunque la copia sea reciente', () => {
    usePersistStore.setState({ durability: 'best-effort' });
    useSessionStore.setState({ obras: [meta(haceDias(1))] });
    render(<CopiaRecordatorio variant="menu" />);
    expect(screen.getByRole('menuitem', { name: /Descargar copia/ })).toHaveTextContent(
      'Última copia descargada: ayer',
    );
  });

  it('la demo sin guardar (sin obra en el registro) no enseña nada', () => {
    useSessionStore.setState({ obras: [], activeId: null });
    usePersistStore.setState({ durability: 'best-effort' });
    render(<CopiaRecordatorio variant="bar" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

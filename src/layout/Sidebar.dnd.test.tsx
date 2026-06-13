import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { REF_SOURCES, type RefCopyItem, type RefPartida } from '../core/refdata';
import { useObraStore } from '../store';
import { Sidebar } from './Sidebar';

beforeEach(() => {
  useObraStore.getState().reset();
});
afterEach(() => {
  document.body.innerHTML = '';
});

const bdt = REF_SOURCES.find((s) => s.id === 'base-bdt')!;
const ade = bdt.partidas.A!.find((p) => p.code === 'ADE010')!;
const item = (): RefCopyItem => ({ sourceName: bdt.name, partida: ade });

describe('Sidebar — drop de partidas de Referencia (F5.2)', () => {
  it('soltar sobre un capítulo lo copia a ese capítulo y limpia el arrastre', () => {
    // Hay que fijar el arrastre ANTES de render: los handlers de drop sólo se
    // montan mientras `refDrag` está activo.
    useObraStore.getState().setRefDrag({ items: [item()], contra: false });
    render(<Sidebar />);
    const n0 = useObraStore.getState().partidas['02']?.length ?? 0; // "Cimentación"
    fireEvent.drop(screen.getByRole('button', { name: /Cimentación/ }));
    const s = useObraStore.getState();
    expect(s.partidas['02']).toHaveLength(n0 + 1);
    expect(s.partidas['02']!.at(-1)!.code).toBe('ADE010');
    expect(s.refDrag).toBeNull();
  });

  it('soltar una partida con recurso en colisión abre el preflight (no copia directa)', () => {
    // Recurso 'mo001' ya existe en el banco semilla a 17,52; aquí entra a 20 → colisión.
    const colliding: RefCopyItem = {
      sourceName: 'Otra obra',
      partida: {
        id: 'rc', pos: '9.9', code: 'NEW', title: 'T', ud: 'm', precio: 99,
        items: [{ code: 'mo001', type: 'MO', cantidad: 1, desc: 'R', ud: 'h', precio: 20 }],
      } as RefPartida,
    };
    useObraStore.getState().setRefDrag({ items: [colliding], contra: false });
    render(<Sidebar />);
    const n0 = useObraStore.getState().partidas['02']?.length ?? 0;
    fireEvent.drop(screen.getByRole('button', { name: /Cimentación/ }));
    const s = useObraStore.getState();
    expect(s.pendingCopy).not.toBeNull(); // abre el diálogo de colisión
    expect(s.partidas['02']?.length ?? 0).toBe(n0); // no copia aún
    expect(s.refDrag).toBeNull();
  });

  it('sin arrastre activo, soltar no hace nada (handlers no montados)', () => {
    render(<Sidebar />);
    const n0 = useObraStore.getState().partidas['02']?.length ?? 0;
    fireEvent.drop(screen.getByRole('button', { name: /Cimentación/ }));
    expect(useObraStore.getState().partidas['02']?.length ?? 0).toBe(n0);
  });
});

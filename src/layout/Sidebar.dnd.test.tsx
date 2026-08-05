import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// Bases demo: fixture para el drag&drop desde Referencia (REF_SOURCES vacío en app).
import { DEMO_REF_SOURCES as REF_SOURCES, type RefCopyItem, type RefPartida } from '../core/refdata';
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

/* --- Reordenar el árbol arrastrando (feedback de obra 2026-08) -------------
   jsdom no implementa `DragEvent` (perdería `clientY`, que decide la mitad de
   la fila): se disparan `MouseEvent` con `dataTransfer` postizo. Como
   `getBoundingClientRect` devuelve ceros, `clientY` < 0 = mitad de ARRIBA. */
function dragEvent(el: Element, type: string, clientY = 0): void {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientY });
  Object.defineProperty(ev, 'dataTransfer', {
    value: { setData: () => {}, getData: () => '', effectAllowed: '', dropEffect: '' },
  });
  fireEvent(el, ev);
}

describe('Sidebar — reordenar capítulos y subcapítulos arrastrando', () => {
  const chapters = () => useObraStore.getState().chapters;
  const codeOf = (id: string) => chapters().find((c) => c.id === id)!.code;

  it('soltar un capítulo sobre la mitad de arriba de otro lo coloca delante y renumera', () => {
    render(<Sidebar />);
    const saneamiento = screen.getByRole('button', { name: /Saneamiento/ }); // capítulo 3
    const tierras = screen.getByRole('button', { name: /Movimiento de tierras/ }); // capítulo 1
    dragEvent(saneamiento, 'dragstart');
    dragEvent(tierras, 'dragover', -5);
    dragEvent(tierras, 'drop', -5);
    expect(chapters().map((c) => c.id).slice(0, 3)).toEqual(['03', '01', '02']);
    expect(codeOf('03')).toBe('1');
    expect(codeOf('01')).toBe('2');
    // La renumeración baja hasta las partidas del capítulo desplazado.
    expect(useObraStore.getState().partidas['01']![0]!.pos).toBe('2.1.1');
  });

  it('un subcapítulo se reordena entre sus hermanos', () => {
    useObraStore.getState().toggleExpanded('01', true); // despliega el árbol de 01
    render(<Sidebar />);
    const transporte = screen.getByRole('button', { name: /Transporte a vertedero/ }); // 1.3
    const excavaciones = screen.getByRole('button', { name: /Excavaciones/ }); // 1.1
    dragEvent(transporte, 'dragstart');
    dragEvent(excavaciones, 'dragover', -5);
    dragEvent(excavaciones, 'drop', -5);
    const c1 = chapters().find((c) => c.id === '01')!;
    expect(c1.children!.map((sc) => sc.id)).toEqual(['01.03', '01.01', '01.02']);
    expect(c1.children!.map((sc) => sc.code)).toEqual(['1.1', '1.2', '1.3']);
    expect(useObraStore.getState().partidas['01']![0]!.pos).toBe('1.2.1'); // p111, ahora en 1.2
  });

  it('no reordena entre niveles distintos: soltar un sub sobre un capítulo es no-op', () => {
    useObraStore.getState().toggleExpanded('01', true);
    render(<Sidebar />);
    const excavaciones = screen.getByRole('button', { name: /Excavaciones/ });
    const cimentacion = screen.getByRole('button', { name: /Cimentación/ });
    dragEvent(excavaciones, 'dragstart');
    dragEvent(cimentacion, 'dragover', -5);
    dragEvent(cimentacion, 'drop', -5);
    expect(chapters().map((c) => c.id).slice(0, 2)).toEqual(['01', '02']);
    expect(chapters().find((c) => c.id === '01')!.children!.map((sc) => sc.id)).toEqual([
      '01.01',
      '01.02',
      '01.03',
    ]);
  });
});

describe('Sidebar — Subir/Bajar de los menús ⋮ (vía táctil y de teclado)', () => {
  it('el menú del capítulo sube y baja, y se deshabilita en los bordes', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getAllByLabelText('Acciones del capítulo')[1]!); // capítulo 2
    fireEvent.click(screen.getByText('Subir'));
    expect(useObraStore.getState().chapters.map((c) => c.id).slice(0, 2)).toEqual(['02', '01']);
    fireEvent.click(screen.getAllByLabelText('Acciones del capítulo')[0]!); // ya es el primero
    expect(screen.getByText('Subir').closest('button')).toBeDisabled();
  });

  it('el menú del subcapítulo también reordena entre hermanos', () => {
    useObraStore.getState().toggleExpanded('01', true);
    render(<Sidebar />);
    fireEvent.click(screen.getAllByLabelText('Acciones del subcapítulo')[0]!); // 1.1
    fireEvent.click(screen.getByText('Bajar'));
    const c1 = useObraStore.getState().chapters.find((c) => c.id === '01')!;
    expect(c1.children!.map((sc) => sc.id)).toEqual(['01.02', '01.01', '01.03']);
  });
});

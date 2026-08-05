/* Reordenar partidas dentro del capítulo (feedback de obra 2026-08).
   ---------------------------------------------------------------------------
   Dos vías, una sola acción de store detrás: arrastrar la fila (ratón) y
   «Subir/Bajar» del menú ⋮ (táctil y teclado). En jsdom `getBoundingClientRect`
   devuelve ceros, así que el punto medio de la fila es 0: `clientY` negativo
   cae en la mitad de ARRIBA (soltar delante) y positivo en la de ABAJO. */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { selectChapterTotals, selectPem, useObraStore } from '../../store';
import { PartidasTable } from './PartidasTable';

const CH = '01';
const state = () => useObraStore.getState();
const ids = () => state().partidas[CH]!.map((p) => p.id);
const posOf = (id: string) => state().partidas[CH]!.find((p) => p.id === id)!.pos;

/** `dataTransfer` mínimo: jsdom no lo trae en los eventos de arrastre. */
function dt(): unknown {
  return { setData: vi.fn(), getData: vi.fn(), effectAllowed: '', dropEffect: '' };
}

/**
 * Dispara un evento de arrastre CON coordenadas: jsdom no implementa
 * `DragEvent`, así que `fireEvent.dragOver(el, {clientY})` acaba en un `Event`
 * pelado que pierde `clientY` (y la mitad de la fila decide dónde se inserta).
 * Con un `MouseEvent` sí viaja.
 */
function dragEvent(el: Element, type: string, clientY = 0): void {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientY });
  Object.defineProperty(ev, 'dataTransfer', { value: dt() });
  fireEvent(el, ev);
}

function Harness() {
  const chapter = useObraStore((s) => s.chapters.find((c) => c.id === CH)!);
  const partidas = useObraStore((s) => s.partidas[CH] ?? []);
  const chapterTotal = useObraStore((s) => selectChapterTotals(s)[CH] ?? 0);
  return <PartidasTable chapter={chapter} partidas={partidas} chapterTotal={chapterTotal} />;
}

/** Fila de una partida por su id de DOM (`partida-<id>`). */
const row = (id: string) => document.getElementById(`partida-${id}`)!;

beforeEach(() => {
  useObraStore.getState().reset();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('arrastrar para reordenar partidas', () => {
  it('soltar en la mitad de ARRIBA coloca la partida delante y renumera', () => {
    render(<Harness />);
    dragEvent(row('p113'), 'dragstart');
    dragEvent(row('p111'), 'dragover', -5);
    dragEvent(row('p111'), 'drop', -5);
    expect(ids().slice(0, 3)).toEqual(['p113', 'p111', 'p112']);
    expect(posOf('p113')).toBe('1.1.1');
    expect(posOf('p111')).toBe('1.1.2');
  });

  it('soltar en la mitad de ABAJO la coloca detrás de esa fila', () => {
    render(<Harness />);
    dragEvent(row('p111'), 'dragstart');
    dragEvent(row('p112'), 'dragover', 5);
    dragEvent(row('p112'), 'drop', 5);
    expect(ids().slice(0, 3)).toEqual(['p112', 'p111', 'p113']);
  });

  it('arrastrar a OTRO grupo del capítulo cambia de subcapítulo (y renumera los dos)', () => {
    render(<Harness />);
    const pem0 = selectPem(state());
    dragEvent(row('p111'), 'dragstart');
    dragEvent(row('p121'), 'dragover', -5); // grupo 01.02
    dragEvent(row('p121'), 'drop', -5);
    const p111 = state().partidas[CH]!.find((p) => p.id === 'p111')!;
    expect(p111.sub).toBe('01.02');
    expect(p111.pos).toBe('1.2.1');
    expect(posOf('p112')).toBe('1.1.1'); // el grupo de origen renumera
    expect(selectPem(state())).toBe(pem0); // mover no toca el dinero
  });

  it('soltar sobre la propia fila no hace nada', () => {
    render(<Harness />);
    const antes = ids();
    dragEvent(row('p111'), 'dragstart');
    dragEvent(row('p111'), 'dragover', 5);
    dragEvent(row('p111'), 'drop', 5);
    expect(ids()).toEqual(antes);
  });

  it('sin arrastre en curso, soltar sobre una fila no reordena', () => {
    render(<Harness />);
    const antes = ids();
    dragEvent(row('p111'), 'dragover', -5);
    dragEvent(row('p111'), 'drop', -5);
    expect(ids()).toEqual(antes);
  });
});

describe('menú ⋮ — Subir / Bajar (vía táctil y de teclado)', () => {
  const openMenu = (id: string) =>
    fireEvent.click(within(row(id)).getByTitle('Más acciones'));

  it('Bajar mueve la partida una posición dentro de su grupo', () => {
    render(<Harness />);
    openMenu('p111');
    fireEvent.click(screen.getByTitle('Bajar la partida una posición'));
    expect(ids().slice(0, 3)).toEqual(['p112', 'p111', 'p113']);
  });

  it('Subir queda deshabilitado en la primera del grupo (y Bajar en la última)', () => {
    render(<Harness />);
    openMenu('p111');
    expect(screen.getByTitle('Subir la partida una posición')).toBeDisabled();
    expect(screen.getByTitle('Bajar la partida una posición')).toBeEnabled();
    openMenu('p111'); // cierra
    openMenu('p113'); // última de 01.01
    expect(screen.getByTitle('Bajar la partida una posición')).toBeDisabled();
  });
});

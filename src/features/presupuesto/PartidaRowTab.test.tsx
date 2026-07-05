/* Regresión: en la fila de partida, Tab entre Cantidad y Precio debe DEJAR la
   celda vecina EN EDICIÓN (no solo enfocada) — como el grid de medición. Antes
   el Tab movía el foco al botón de Precio pero había que hacer click para editar. */
import { fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearArmedEdit } from '../../hooks/editGridNav';
import { selectChapterTotals, useObraStore } from '../../store';
import { PartidasTable } from './PartidasTable';

const CH = '01';

/** Espejo del uso real: el contenedor se suscribe al store y pasa al `PartidasTable`. */
function Harness() {
  const chapter = useObraStore((s) => s.chapters.find((c) => c.id === CH)!);
  const partidas = useObraStore((s) => s.partidas[CH] ?? []);
  const chapterTotal = useObraStore((s) => selectChapterTotals(s)[CH] ?? 0);
  return <PartidasTable chapter={chapter} partidas={partidas} chapterTotal={chapterTotal} />;
}

beforeEach(() => {
  useObraStore.getState().reset();
  // Partida nueva → med vacía → cantidad editable (sinMedicion).
  useObraStore.getState().addPartida(CH, null);
});
afterEach(() => clearArmedEdit());

/** Fila de la última partida añadida (la de cantidad editable). */
function nuevaFila() {
  const nueva = useObraStore.getState().partidas[CH]!.at(-1)!;
  return document.getElementById(`partida-${nueva.id}`)!;
}

describe('PartidaRow — Tab abre la celda vecina en edición', () => {
  it('Tab en Cantidad pasa a Precio y lo deja EN EDICIÓN con foco', () => {
    render(<Harness />);
    const row = nuevaFila();
    fireEvent.click(within(row).getByLabelText('Cantidad de la partida (sin medición)')); // abre cantidad
    fireEvent.keyDown(within(row).getByLabelText('Cantidad de la partida (sin medición)'), { key: 'Tab' });
    const precio = within(row).getByLabelText('Precio unitario');
    expect(precio.tagName).toBe('INPUT'); // editable, no en reposo (el bug original)
    expect(precio).toHaveFocus();
  });

  it('Shift+Tab en Precio vuelve a Cantidad y la deja EN EDICIÓN', () => {
    render(<Harness />);
    const row = nuevaFila();
    fireEvent.click(within(row).getByLabelText('Precio unitario')); // abre precio
    fireEvent.keyDown(within(row).getByLabelText('Precio unitario'), { key: 'Tab', shiftKey: true });
    const cantidad = within(row).getByLabelText('Cantidad de la partida (sin medición)');
    expect(cantidad.tagName).toBe('INPUT');
    expect(cantidad).toHaveFocus();
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  armNextEdit,
  cellBelow,
  clearArmedEdit,
  colOf,
  consumeArmNextEdit,
  isLastRow,
  neighborEditCell,
} from './editGridNav';

/** Grid 2×2: filas r0/r1, columnas 0/1; el botón es el `[data-editcell]`. */
function buildGrid(): void {
  document.body.innerHTML = `
    <div data-editgrid>
      <div data-editrow>
        <span data-editfield data-col="0"><button data-editcell id="r0c0">·</button></span>
        <span data-editfield data-col="1"><button data-editcell id="r0c1">·</button></span>
      </div>
      <div data-editrow>
        <span data-editfield data-col="0"><button data-editcell id="r1c0">·</button></span>
        <span data-editfield data-col="1"><button data-editcell id="r1c1">·</button></span>
      </div>
    </div>`;
}
const cell = (id: string) => document.getElementById(id)!;

beforeEach(buildGrid);
afterEach(() => {
  document.body.innerHTML = '';
  clearArmedEdit();
});

describe('neighborEditCell (Tab)', () => {
  it('avanza al campo siguiente en orden DOM, saltando de fila al final', () => {
    expect(neighborEditCell(cell('r0c0'), 1)?.id).toBe('r0c1');
    expect(neighborEditCell(cell('r0c1'), 1)?.id).toBe('r1c0'); // fin de fila → fila siguiente
  });
  it('retrocede y devuelve null en los bordes', () => {
    expect(neighborEditCell(cell('r0c1'), -1)?.id).toBe('r0c0');
    expect(neighborEditCell(cell('r0c0'), -1)).toBeNull();
    expect(neighborEditCell(cell('r1c1'), 1)).toBeNull();
  });
});

describe('cellBelow (Enter)', () => {
  it('baja en la MISMA columna', () => {
    expect(cellBelow(cell('r0c1'), 1)?.id).toBe('r1c1');
    expect(cellBelow(cell('r0c0'), 1)?.id).toBe('r1c0');
  });
  it('null en los bordes verticales', () => {
    expect(cellBelow(cell('r1c0'), 1)).toBeNull();
    expect(cellBelow(cell('r0c0'), -1)).toBeNull();
  });
});

describe('colOf / isLastRow', () => {
  it('lee la columna del campo', () => {
    expect(colOf(cell('r0c1'))).toBe(1);
    expect(colOf(cell('r1c0'))).toBe(0);
  });
  it('detecta la última fila', () => {
    expect(isLastRow(cell('r1c0'))).toBe(true);
    expect(isLastRow(cell('r0c0'))).toBe(false);
  });
});

describe('armNextEdit / consumeArmNextEdit', () => {
  it('solo el nodo armado consume, y una sola vez', () => {
    const target = cell('r0c1');
    armNextEdit(target);
    expect(consumeArmNextEdit(cell('r0c0'))).toBe(false); // nodo equivocado
    armNextEdit(target);
    expect(consumeArmNextEdit(target)).toBe(true); // el correcto
    expect(consumeArmNextEdit(target)).toBe(false); // ya consumido
  });
  it('clearArmedEdit anula el armado', () => {
    const target = cell('r1c1');
    armNextEdit(target);
    clearArmedEdit();
    expect(consumeArmNextEdit(target)).toBe(false);
  });
});

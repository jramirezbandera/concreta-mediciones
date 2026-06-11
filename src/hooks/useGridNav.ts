import { useCallback, type KeyboardEvent } from 'react';

const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/**
 * Navegación con FLECHAS entre celdas editables (a11y §6, F8.2). Se cuelga del
 * contenedor de una tabla/grid (`onKeyDown`): cuando el foco está en una celda
 * en reposo (el display de `EditableText`/`EditableNum`, marcados con
 * `data-editcell`) las flechas mueven el foco a la celda vecina — izquierda/
 * derecha dentro de la fila (`<tr>` o `[data-editrow]`), arriba/abajo a la
 * misma columna de la fila vecina. Dentro del input/textarea de EDICIÓN no
 * intercepta nada: ahí las flechas mueven el caret, y Enter/Esc ya confirman
 * o cancelan. Tab sigue funcionando de serie (todas las celdas son focables).
 */
export function useGridNav(): (e: KeyboardEvent<HTMLElement>) => void {
  return useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (!ARROWS.includes(e.key)) return;
    const t = e.target as HTMLElement;
    if (t.dataset?.editcell == null) return;
    const root = e.currentTarget;
    const cells = Array.from(root.querySelectorAll<HTMLElement>('[data-editcell]'));
    const rowOf = (el: HTMLElement) => el.closest('tr, [data-editrow]');
    const row = rowOf(t);
    const rowCells = cells.filter((c) => rowOf(c) === row);
    const col = rowCells.indexOf(t);
    let target: HTMLElement | undefined;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      target = rowCells[col + (e.key === 'ArrowLeft' ? -1 : 1)];
    } else {
      const rows = Array.from(new Set(cells.map((c) => rowOf(c))));
      const next = rows[rows.indexOf(row) + (e.key === 'ArrowUp' ? -1 : 1)];
      if (next) {
        const nextCells = cells.filter((c) => rowOf(c) === next);
        target = nextCells[Math.min(col, nextCells.length - 1)];
      }
    }
    if (target) {
      e.preventDefault();
      target.focus();
    }
  }, []);
}

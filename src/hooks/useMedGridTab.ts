import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';
import { armNextEdit, cellBelow, colOf, neighborEditCell } from './editGridNav';

/**
 * Navegación tipo hoja de cálculo para el grid de medición, colgada del
 * CONTENEDOR (`[data-editgrid]`). Intercepta Tab/Enter cuando el foco está en el
 * input de edición de una celda:
 *  - Tab / Shift+Tab → celda vecina (orden de campos) y la abre.
 *  - Enter / Shift+Enter → misma columna, fila siguiente/anterior, y la abre.
 *  - En el borde HACIA DELANTE (último campo con Tab, última fila con Enter) →
 *    crea una línea nueva y enfoca su primer/mismo campo (entrada rápida).
 * Las flechas las sigue gestionando `useGridNav` (celdas en reposo); aquí solo
 * actuamos sobre el input. `lineCount` dispara el autofocus a la fila nueva.
 */
export function useMedGridTab(addLine: () => void, lineCount: number) {
  const ref = useRef<HTMLDivElement>(null);
  const pendingCol = useRef<number | null>(null);

  // Tras crecer el nº de líneas por un borde, enfoca+abre la celda de la fila nueva.
  useEffect(() => {
    const col = pendingCol.current;
    if (col == null) return;
    pendingCol.current = null;
    const grid = ref.current;
    if (!grid) return;
    const rows = Array.from(grid.querySelectorAll<HTMLElement>('[data-editrow]'));
    const lastRow = rows[rows.length - 1];
    if (!lastRow) return;
    const cell =
      lastRow.querySelector<HTMLElement>(`[data-editfield][data-col="${col}"] [data-editcell]`) ??
      lastRow.querySelector<HTMLElement>('[data-editfield] [data-editcell]');
    if (cell) {
      armNextEdit(cell);
      cell.focus();
    }
  }, [lineCount]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'Tab' && e.key !== 'Enter') return;
      const t = e.target as HTMLElement;
      if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA') return; // celda en reposo
      if (!t.closest('[data-editgrid]')) return;

      // Ctrl/⌘+Enter — añadir línea explícita (el input ya confirma su valor).
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        pendingCol.current = colOf(t) ?? 0;
        addLine();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return; // otros modificadores: nada

      if (e.key === 'Tab') {
        const target = neighborEditCell(t, e.shiftKey ? -1 : 1);
        if (target) {
          e.preventDefault();
          armNextEdit(target);
          target.focus();
        } else if (!e.shiftKey) {
          e.preventDefault();
          pendingCol.current = 0; // primer campo de la fila nueva
          addLine();
        }
        // Shift+Tab en el borde inicial: Tab nativo (sale del grid).
      } else {
        // Enter: el input ya confirma en su propio onKeyDown; aquí solo movemos.
        const below = cellBelow(t, e.shiftKey ? -1 : 1);
        if (below) {
          e.preventDefault();
          armNextEdit(below);
          below.focus();
        } else if (!e.shiftKey) {
          e.preventDefault();
          pendingCol.current = colOf(t) ?? 0; // misma columna en la fila nueva
          addLine();
        }
      }
    },
    [addLine],
  );

  return { ref, onKeyDown };
}

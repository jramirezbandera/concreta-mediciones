import { useCallback, useEffect, useRef, type FocusEvent, type KeyboardEvent } from 'react';
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
 *
 * `addLine` es OPCIONAL: un grid sin «crear fila al final» (p. ej. la tabla de
 * certificación) lo omite. Sin `addLine`, el borde delantero de Tab/Enter deja
 * pasar el evento nativo (no atrapa el foco) y Ctrl/⌘+Enter es no-op.
 *
 * La fila creada por el borde es PROVISIONAL: al terminar la última línea es
 * fácil dar un Enter de más. Si el foco sale de ella (o el grid se desmonta al
 * cerrar la partida) se avisa a `discardLine` con su id, que la quita si sigue
 * en blanco. El caller cuelga `onBlur` del contenedor. Ctrl/⌘+Enter es un alta
 * explícita: esa no es provisional.
 */
export function useMedGridTab(
  addLine?: () => void,
  lineCount = 0,
  discardLine?: (lineId: string) => void,
) {
  const ref = useRef<HTMLDivElement>(null);
  const pendingCol = useRef<number | null>(null);
  const pendingTentative = useRef(false);
  /** Id de la fila provisional (creada por el borde) mientras el foco siga en ella. */
  const tentative = useRef<string | null>(null);
  const discardRef = useRef(discardLine);
  useEffect(() => {
    discardRef.current = discardLine;
  });

  // Tras crecer el nº de líneas por un borde, enfoca+abre la celda de la fila nueva.
  useEffect(() => {
    const col = pendingCol.current;
    if (col == null) return;
    pendingCol.current = null;
    const wasTentative = pendingTentative.current;
    pendingTentative.current = false;
    const grid = ref.current;
    if (!grid) return;
    const rows = Array.from(grid.querySelectorAll<HTMLElement>('[data-editrow]'));
    const lastRow = rows[rows.length - 1];
    if (!lastRow) return;
    if (wasTentative) tentative.current = lastRow.dataset.lineid ?? null;
    const cell =
      lastRow.querySelector<HTMLElement>(`[data-editfield][data-col="${col}"] [data-editcell]`) ??
      lastRow.querySelector<HTMLElement>('[data-editfield] [data-editcell]');
    if (cell) {
      armNextEdit(cell);
      cell.focus();
    }
  }, [lineCount]);

  // Cerrar la partida desmonta el grid sin que llegue ningún blur.
  useEffect(
    () => () => {
      const id = tentative.current;
      tentative.current = null;
      if (id) discardRef.current?.(id);
    },
    [],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'Tab' && e.key !== 'Enter') return;
      const t = e.target as HTMLElement;
      if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA') return; // celda en reposo
      if (!t.closest('[data-editgrid]')) return;

      // Ctrl/⌘+Enter — añadir línea explícita (el input ya confirma su valor).
      // Sin `addLine` (grid sin alta al final): no-op, deja el evento nativo.
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        if (!addLine) return;
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
        } else if (!e.shiftKey && addLine) {
          e.preventDefault();
          pendingCol.current = 0; // primer campo de la fila nueva
          pendingTentative.current = true;
          addLine();
        }
        // Borde delantero sin `addLine`, o Shift+Tab en el borde inicial: Tab nativo (sale del grid).
      } else {
        // Enter: el input ya confirma en su propio onKeyDown; aquí solo movemos.
        const below = cellBelow(t, e.shiftKey ? -1 : 1);
        if (below) {
          e.preventDefault();
          armNextEdit(below);
          below.focus();
        } else if (!e.shiftKey && addLine) {
          e.preventDefault();
          pendingCol.current = colOf(t) ?? 0; // misma columna en la fila nueva
          pendingTentative.current = true;
          addLine();
        }
        // Borde inferior sin `addLine`: no-op (Enter nativo, sin efecto en un div).
      }
    },
    [addLine],
  );

  // El foco sale de la fila provisional. Diferido: al cerrar una celda el input
  // se desmonta y el foco vuelve a la celda en reposo; se mira dónde acaba.
  const onBlur = useCallback((e: FocusEvent<HTMLElement>) => {
    const id = tentative.current;
    if (!id) return;
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-editrow]');
    if (row?.dataset.lineid !== id) return;
    setTimeout(() => {
      if (tentative.current !== id) return;
      const now = document.activeElement?.closest<HTMLElement>('[data-editrow]');
      if (now?.dataset.lineid === id) return;
      tentative.current = null;
      discardRef.current?.(id);
    }, 0);
  }, []);

  return { ref, onKeyDown, onBlur };
}

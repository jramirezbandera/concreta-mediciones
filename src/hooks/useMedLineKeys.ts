import { useCallback, useRef, type KeyboardEvent } from 'react';
import { extendSelection, moveLinesBy, toggleLine, actionLines, locatePartida } from '../store/medLineOps';
import { isTextField } from './hotkeyGuards';

/** Columna (`data-col`) de la celda que contiene `el`; `'del'` si es el botón
 *  de borrar de la línea. */
export function colOfCell(el: HTMLElement): number | 'del' {
  if (el.closest('[data-del]')) return 'del';
  const n = Number(el.closest<HTMLElement>('[data-editfield]')?.dataset.col);
  return Number.isFinite(n) ? n : 0;
}

/** Línea (`data-lineid`) que contiene `el`. */
function lineOf(el: HTMLElement): string | null {
  return el.closest<HTMLElement>('[data-lineid]')?.dataset.lineid ?? null;
}

/**
 * Teclas LOCALES de las líneas de medición, colgadas en fase de CAPTURA del
 * contenedor `[data-medgrid]` (tabla o tarjetas), para ganar a los manejadores
 * de las celdas (`MedComment` abre con Espacio; el botón de `MedNum` se
 * activa con Espacio al soltar) y al `useGridNav` exterior:
 *  - Alt+↑/↓     → sube/baja la selección (o la línea con el foco); el foco la sigue.
 *  - Shift+Espacio → alterna la selección de la fila (sin abrir el editor).
 *  - Shift+↑/↓   → amplía la selección desde el ancla y mueve el foco.
 * Cada evento se consume UNA vez (`stopPropagation`). Dentro del input de
 * edición no se intercepta nada: ahí mandan el caret y el navegador.
 */
export function useMedLineKeys(partidaId: string): {
  onKeyDownCapture: (e: KeyboardEvent<HTMLElement>) => void;
  onKeyUpCapture: (e: KeyboardEvent<HTMLElement>) => void;
} {
  // El Espacio de Shift+Espacio también se traga al SOLTAR: un botón se activa
  // en keyup, aunque para entonces ya se haya soltado Shift.
  const swallowSpaceUp = useRef(false);

  const onKeyDownCapture = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      const t = e.target as HTMLElement;
      if (isTextField(t) || e.ctrlKey || e.metaKey) return;
      const lineId = lineOf(t);
      if (!lineId) return;
      const up = e.key === 'ArrowUp';
      const down = e.key === 'ArrowDown';

      if (e.altKey && !e.shiftKey && (up || down)) {
        e.preventDefault();
        e.stopPropagation();
        const p = locatePartida(partidaId)?.partida;
        if (!p) return;
        moveLinesBy(partidaId, actionLines(p, lineId), up ? -1 : 1, { lineId, col: colOfCell(t) });
        return;
      }
      if (e.altKey || !e.shiftKey) return;

      if (e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        swallowSpaceUp.current = true;
        if (!e.repeat) toggleLine(partidaId, lineId);
        return;
      }
      if (up || down) {
        e.preventDefault();
        e.stopPropagation();
        const grid = e.currentTarget;
        const rows = Array.from(grid.querySelectorAll<HTMLElement>('[data-lineid]'));
        const i = rows.findIndex((r) => r.dataset.lineid === lineId);
        const next = rows[i + (up ? -1 : 1)];
        const nextId = next?.dataset.lineid;
        if (!next || !nextId) return;
        extendSelection(partidaId, lineId, nextId);
        const col = colOfCell(t);
        const cell =
          col === 'del'
            ? next.querySelector<HTMLElement>('[data-del]')
            : (next.querySelector<HTMLElement>(`[data-editfield][data-col="${col}"] [data-editcell]`) ??
              next.querySelector<HTMLElement>('[data-editcell]'));
        cell?.focus();
      }
    },
    [partidaId],
  );

  const onKeyUpCapture = useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== ' ' || !swallowSpaceUp.current) return;
    swallowSpaceUp.current = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return { onKeyDownCapture, onKeyUpCapture };
}

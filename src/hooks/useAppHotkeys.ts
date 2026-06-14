import { useEffect } from 'react';
import { ALL, useObraStore } from '../store';
import {
  hasBlockingOverlay,
  hasNativeSelection,
  hasTransientOverlay,
  inEditGrid,
  isInteractiveTarget,
  isTextEditingTarget,
} from './hotkeyGuards';
import { chapterIdOfPartida, deletePartidaWithUndo } from './usePartidaDelete';

/**
 * Atajos globales de la app (montar UNA vez en App):
 *  - Ctrl/⌘+K → foco al buscador de partidas.
 *  - ?        → abre la chuleta de atajos.
 *  - Supr     → elimina la partida seleccionada (con toast «Deshacer»). Red de
 *               seguridad: ignora si el foco está en un campo, en un botón, en
 *               una celda de medición, si hay selección de texto, modal, o la
 *               vista no es el presupuesto.
 *  - Esc      → cierra en pila: panel Referencia → deselecciona la partida.
 * Se apoya en las guardas compartidas de `hotkeyGuards`.
 */
export function useAppHotkeys({ onHelp }: { onHelp: () => void }): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ctrl/⌘+K — foco al buscador (funciona también desde dentro de un campo).
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        if (hasBlockingOverlay()) return;
        e.preventDefault();
        useObraStore.getState().focusSearch();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return; // resto: sin modificadores

      // ? — chuleta de atajos.
      if (e.key === '?') {
        if (isTextEditingTarget() || hasBlockingOverlay()) return;
        e.preventDefault();
        onHelp();
        return;
      }

      // Supr — borrar la partida seleccionada (con red de seguridad).
      if (e.key === 'Delete') {
        if (e.repeat) return;
        if (isTextEditingTarget() || hasBlockingOverlay() || hasNativeSelection()) return;
        if (isInteractiveTarget(e) || inEditGrid()) return; // foco en botón/celda → no borrar
        const s = useObraStore.getState();
        if (s.view !== 'presupuesto' || !s.openPartidaId || s.active === ALL) return;
        const chId = chapterIdOfPartida(s.openPartidaId);
        if (!chId) return;
        e.preventDefault();
        deletePartidaWithUndo(chId, s.openPartidaId);
        return;
      }

      // Esc — pila de cierre. Los campos/dropdowns/modales gestionan su propio
      // Esc; aquí solo actuamos si no hay UI transitoria ni edición en curso.
      if (e.key === 'Escape') {
        if (isTextEditingTarget() || hasTransientOverlay()) return;
        const s = useObraStore.getState();
        if (s.refOpen) {
          s.setRefOpen(false);
          e.preventDefault();
          return;
        }
        if (s.openPartidaId) {
          s.togglePartida(s.openPartidaId);
          e.preventDefault();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onHelp]);
}

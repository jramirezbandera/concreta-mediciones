import { useEffect } from 'react';
import { ALL, useObraStore } from '../store';
import { redo, undo } from '../store/temporal';
import {
  hasBlockingOverlay,
  hasNativeSelection,
  hasTransientOverlay,
  inEditGrid,
  isInteractiveTarget,
  isTextEditingTarget,
  isTextField,
} from './hotkeyGuards';
import { chapterIdOfPartida, deletePartidaWithUndo } from './usePartidaDelete';

/**
 * Atajos globales de la app (montar UNA vez en App):
 *  - Ctrl/⌘+K → foco al buscador de partidas.
 *  - Ctrl/⌘+Z → deshacer; Ctrl+Shift+Z / Ctrl+Y → rehacer (historial de dominio).
 *               Dentro de un campo de texto NO se intercepta: ahí manda el undo
 *               NATIVO del input (expectativa del navegador).
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
      // Ctrl/⌘+J — abre/cierra el asistente de IA (F-A2). Combinación libre (K, Z,
      // Y, ?, Supr, Esc ya están tomadas). No bajo un modal.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'j') {
        if (hasBlockingOverlay()) return;
        e.preventDefault();
        useObraStore.getState().setAsistenteOpen();
        return;
      }
      // Ctrl/⌘+Z / Ctrl+Shift+Z / Ctrl+Y — deshacer/rehacer del dominio. ANTES
      // del early-return de modificadores (si no, nunca se ejecutarían).
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')
      ) {
        // En un campo de texto, el undo nativo del input; bajo un modal, nada
        // (deshacer dominio con el modal abierto desconcertaría).
        if (isTextEditingTarget() || hasBlockingOverlay()) return;
        e.preventDefault();
        if (e.key.toLowerCase() === 'y' || e.shiftKey) redo();
        else undo();
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
        // El Esc que CANCELA una celda en edición desmonta su input antes de
        // llegar aquí (React confirma el render dentro del propio evento): el foco
        // ya no está en un campo, pero el Esc era suyo. Por eso también el target.
        if (isTextEditingTarget() || isTextField(e.target) || hasTransientOverlay()) return;
        const s = useObraStore.getState();
        if (s.refMaximized) {
          s.setRefMax(false); // 1.º Esc restaura el tamaño; el 2.º cierra el panel
          e.preventDefault();
          return;
        }
        if (s.refOpen) {
          s.setRefOpen(false);
          e.preventDefault();
          return;
        }
        // Asistente abierto: Esc lo cierra (cuando el foco NO está en su composer;
        // ahí lo gestiona el propio panel, y isTextEditingTarget ya nos sacó antes).
        if (s.asistenteOpen) {
          s.setAsistenteOpen(false);
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

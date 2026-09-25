/* ===========================================================================
   hooks/useMedClipboard — enrutador GLOBAL del portapapeles de líneas de
   medición. Montar UNA vez (en App), independiente de la pestaña del panel.

   Contexto de medición = foco dentro de `[data-medgrid]` (tabla o tarjetas de
   la medición) O selección de líneas activa en la partida abierta (en Safari y
   Firefox de macOS un click deja el foco en el body, así que el foco no basta).

   Escucha en `document` (fase de burbuja): corre DESPUÉS de los manejadores de
   React (celdas, teclas locales del grid) y ANTES de los de `window`
   (`useClipboardHotkeys` de partidas, `useAppHotkeys`).

     keydown ─┬─ Ctrl/⌘+C ── contexto ──► copyLines(selección | línea con foco)
              ├─ Ctrl/⌘+D ── contexto ──► duplicateLines(…)  (+preventDefault)
              ├─ Ctrl/⌘+V ── hay líneas y partida abierta ──► pista a 500 ms
              └─ Esc ─────── selección ──► la vacía (+preventDefault: useAppHotkeys
                                           no cierra la partida)
     paste ───── líneas en el portapapeles interno, foco fuera de un campo:
                   partida = la del grid con el foco o la abierta
                   ─► pasteLines(partida, ancla, pestaña → Medición)
                   sin partida abierta ─► «Abre una partida para pegar las líneas»

   Pegar va SOLO por el evento `paste` real (sin carreras de temporizador): si a
   los 500 ms del Ctrl+V no llegó ninguno (Safari con el foco en el body), sale
   una pista hacia el botón «Pegar N líneas». La pista nunca cambia datos.
   Dentro de un campo de texto, copiar y pegar son los del navegador.
   =========================================================================== */
import { useEffect } from 'react';
import { useClipboardStore } from '../store/clipboardStore';
import {
  actionLines,
  copyLines,
  duplicateLines,
  locatePartida,
  pasteAnchor,
  pasteLines,
} from '../store/medLineOps';
import { useMedUiStore } from '../store/medUiStore';
import { useObraStore } from '../store/obraStore';
import { useToastStore } from '../store/toastStore';
import {
  hasBlockingOverlay,
  hasNativeSelection,
  hasTransientOverlay,
  isTextEditingTarget,
  isTextField,
} from './hotkeyGuards';

/** Contexto de una acción sobre líneas: la partida y la línea con el foco. */
export interface MedContext {
  partidaId: string;
  focusLineId: string | null;
}

/** Grid de medición que contiene el foco (su `data-medgrid` = id de partida). */
function focusedMedGrid(): HTMLElement | null {
  const el = document.activeElement as HTMLElement | null;
  return el?.closest<HTMLElement>('[data-medgrid]') ?? null;
}

/** ¿El foco está dentro de un grid de medición? */
export function inMedGrid(): boolean {
  return !!focusedMedGrid();
}

/** Línea (`data-lineid`) que contiene el foco dentro de un grid de medición. */
export function focusedLineId(): string | null {
  if (!focusedMedGrid()) return null;
  const el = document.activeElement as HTMLElement | null;
  return el?.closest<HTMLElement>('[data-lineid]')?.dataset.lineid ?? null;
}

/**
 * Contexto de medición activo, o `null`. Con el foco en un grid manda ese
 * grid; si no, la selección de la partida abierta.
 */
export function medContext(): MedContext | null {
  const grid = focusedMedGrid();
  if (grid?.dataset.medgrid) return { partidaId: grid.dataset.medgrid, focusLineId: focusedLineId() };
  const open = useObraStore.getState().openPartidaId;
  const ui = useMedUiStore.getState();
  if (open && ui.partidaId === open && ui.selected.length > 0) return { partidaId: open, focusLineId: null };
  return null;
}

/** Retardo de la pista de Ctrl+V sin evento `paste`. */
export const PASTE_HINT_MS = 500;

export function useMedClipboard(): void {
  useEffect(() => {
    let hint: ReturnType<typeof setTimeout> | null = null;
    const clearHint = () => {
      if (hint) clearTimeout(hint);
      hint = null;
    };

    function onEsc(e: KeyboardEvent) {
      // Campos, desplegables y modales gestionan su propio Esc.
      if (isTextEditingTarget() || isTextField(e.target) || hasTransientOverlay()) return;
      const ctx = medContext();
      const ui = useMedUiStore.getState();
      if (!ctx || ui.partidaId !== ctx.partidaId || !ui.selected.length) return;
      ui.clearSelection();
      e.preventDefault(); // useAppHotkeys no cierra la partida con este Esc
    }

    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        onEsc(e);
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k !== 'c' && k !== 'd' && k !== 'v') return;
      if (isTextEditingTarget() || hasBlockingOverlay()) return; // nativo del navegador
      if (useObraStore.getState().view !== 'presupuesto') return;

      if (k === 'v') {
        const clip = useClipboardStore.getState().medLines;
        const open = useObraStore.getState().openPartidaId;
        if (!clip || !(medContext() || open)) return;
        clearHint();
        const n = clip.lines.length;
        hint = setTimeout(() => {
          hint = null;
          useToastStore
            .getState()
            .show(
              `Pulsa «Pegar ${n === 1 ? 'línea' : `${n} líneas`}» para pegar lo copiado en Concreta`,
              undefined,
              { tone: 'warn' },
            );
        }, PASTE_HINT_MS);
        return; // sin preventDefault: tiene que llegar el evento `paste`
      }

      const ctx = medContext();
      const p = ctx && locatePartida(ctx.partidaId)?.partida;
      if (!ctx || !p) return;
      if (k === 'c') {
        if (hasNativeSelection()) return; // no pisar una selección de texto real
        const ids = actionLines(p, ctx.focusLineId);
        if (ids.length) copyLines(ctx.partidaId, ids);
        return;
      }
      // Ctrl/⌘+D: duplicar (y que el navegador no abra «añadir marcador»).
      e.preventDefault();
      const ids = actionLines(p, ctx.focusLineId);
      if (ids.length) duplicateLines(ctx.partidaId, ids);
    }

    function onPaste(e: ClipboardEvent) {
      clearHint();
      if (e.defaultPrevented) return;
      if (isTextField(e.target) || isTextEditingTarget() || hasBlockingOverlay()) return;
      const obra = useObraStore.getState();
      if (obra.view !== 'presupuesto') return;
      if (!useClipboardStore.getState().medLines) return; // nada nuestro que pegar
      e.preventDefault();
      const ctx = medContext();
      const partidaId = ctx?.partidaId ?? obra.openPartidaId;
      if (!partidaId) {
        useToastStore.getState().show('Abre una partida para pegar las líneas', undefined, { tone: 'warn' });
        return;
      }
      const p = locatePartida(partidaId)?.partida;
      pasteLines(partidaId, p ? pasteAnchor(p, ctx?.focusLineId ?? null) : null, { switchTab: true });
    }

    document.addEventListener('keydown', onKey);
    document.addEventListener('paste', onPaste);
    return () => {
      clearHint();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('paste', onPaste);
    };
  }, []);
}

/* ===========================================================================
   hooks/useMedClipboard — enrutador GLOBAL del portapapeles de líneas de
   medición. Montar UNA vez (en App), independiente de la pestaña del panel.

   Contexto de medición = foco dentro de `[data-medgrid]` (tabla o tarjetas de
   la medición) O selección de líneas activa en la partida abierta (en Safari y
   Firefox de macOS un click deja el foco en el body, así que el foco no basta).

   Escucha en `document` (fase de burbuja): corre DESPUÉS de los manejadores de
   React (celdas, teclas locales del grid) y ANTES de los de `window`
   (`useClipboardHotkeys` de partidas, `useAppHotkeys`).

     keydown ─┬─ Ctrl/⌘+C/X ── contexto ──► copyLines(selección | foco, cut)
              │                              + TSV pendiente para el sistema
              ├─ Ctrl/⌘+D ─── contexto ──► duplicateLines(…)  (+preventDefault)
              ├─ Ctrl/⌘+V ─── partida abierta y líneas ──► pista a 500 ms
              └─ Esc ──────── selección ──► la vacía; si no, cortado ──► lo cancela
                                (+preventDefault: useAppHotkeys no cierra la partida)
     copy/cut ── TSV pendiente ──► text/plain + MEDLINES_MIME (id) en el evento
                 (síncrono, funciona en http); si no llega, writeText; si nada
                 confirma, sysOk=false y aviso
     paste ───── foco fuera de un campo de texto:
                   resolverPegado(text/plain, MEDLINES_MIME) → interno (con o
                   sin autoridad para mover), ya movido, o TSV ajeno
                   partida = la del grid con el foco o la abierta (→ Medición)
                   texto ajeno SIN tabuladores ni saltos solo con el foco en el
                   grid (un texto suelto no se convierte en línea por accidente)

   Pegar va SOLO por el evento `paste` real (sin carreras de temporizador): si a
   los 500 ms del Ctrl+V no llegó ninguno (Safari con el foco en el body), sale
   una pista hacia el botón «Pegar N líneas». La pista nunca cambia datos.
   Dentro de un campo de texto, copiar y pegar son los del navegador.
   =========================================================================== */
import { useEffect } from 'react';
import { MEDLINES_MIME, useClipboardStore } from '../store/clipboardStore';
import {
  actionLines,
  aplicarResolucion,
  cancelCut,
  copyLines,
  cutPending,
  duplicateLines,
  flushSystemCopy,
  locatePartida,
  pasteAnchor,
  resolverPegado,
  systemCopyResult,
  takeStagedCopy,
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
      if (useObraStore.getState().view !== 'presupuesto') return;
      const ctx = medContext();
      const ui = useMedUiStore.getState();
      if (ctx && ui.partidaId === ctx.partidaId && ui.selected.length) {
        ui.clearSelection();
        e.preventDefault(); // useAppHotkeys no cierra la partida con este Esc
        return;
      }
      if (cutPending() && cancelCut()) e.preventDefault();
    }

    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        onEsc(e);
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k !== 'c' && k !== 'x' && k !== 'd' && k !== 'v') return;
      if (isTextEditingTarget() || hasBlockingOverlay()) return; // nativo del navegador
      if (useObraStore.getState().view !== 'presupuesto') return;

      if (k === 'v') {
        const clip = useClipboardStore.getState().medLines;
        const open = useObraStore.getState().openPartidaId;
        if (!clip || !(medContext() || open)) return;
        clearHint();
        const n = clip.lines.length;
        const accion = cutPending(clip) ? `Mover ${n === 1 ? 'línea' : `${n} líneas`} aquí` : `Pegar ${n === 1 ? 'línea' : `${n} líneas`}`;
        hint = setTimeout(() => {
          hint = null;
          useToastStore
            .getState()
            .show(`Pulsa «${accion}» para pegar lo copiado en Concreta`, undefined, { tone: 'warn' });
        }, PASTE_HINT_MS);
        return; // sin preventDefault: tiene que llegar el evento `paste`
      }

      const ctx = medContext();
      const p = ctx && locatePartida(ctx.partidaId)?.partida;
      if (!ctx || !p) return;
      if (k === 'c' || k === 'x') {
        if (hasNativeSelection()) return; // no pisar una selección de texto real
        const ids = actionLines(p, ctx.focusLineId);
        // Sin preventDefault: el navegador dispara `copy`/`cut`, que escribe el
        // TSV en el sistema; si no llegara, el respaldo corre justo después.
        if (ids.length && copyLines(ctx.partidaId, ids, { cut: k === 'x' })) setTimeout(flushSystemCopy, 0);
        return;
      }
      // Ctrl/⌘+D: duplicar (y que el navegador no abra «añadir marcador»).
      e.preventDefault();
      const ids = actionLines(p, ctx.focusLineId);
      if (ids.length) duplicateLines(ctx.partidaId, ids);
    }

    /** `copy`/`cut` del documento: si hay un TSV de líneas pendiente, va aquí. */
    function onCopy(e: ClipboardEvent) {
      if (!e.clipboardData || isTextField(e.target)) return;
      const st = takeStagedCopy();
      if (!st) return;
      e.clipboardData.setData('text/plain', st.tsv);
      e.clipboardData.setData(MEDLINES_MIME, st.id);
      e.preventDefault(); // sin esto el navegador ignora setData
      systemCopyResult(st.id, true);
    }

    function onPaste(e: ClipboardEvent) {
      clearHint();
      if (e.defaultPrevented) return;
      if (isTextField(e.target) || isTextEditingTarget() || hasBlockingOverlay()) return;
      const obra = useObraStore.getState();
      if (obra.view !== 'presupuesto') return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      const mimeId = e.clipboardData?.getData(MEDLINES_MIME) || null;
      const r = resolverPegado(text, mimeId);
      if (r.kind === 'none') return;
      const ctx = medContext();
      // Texto ajeno suelto (sin tabuladores ni saltos) solo con el foco en la
      // medición: pegar una palabra con el foco en la página no crea líneas.
      if (r.kind === 'foreign' && !ctx && !/[\t\r\n]/.test(text)) return;
      const partidaId = ctx?.partidaId ?? obra.openPartidaId;
      if (!partidaId) {
        if (r.kind === 'internal')
          useToastStore.getState().show('Abre una partida para pegar las líneas', undefined, { tone: 'warn' });
        return;
      }
      e.preventDefault();
      const p = locatePartida(partidaId)?.partida;
      aplicarResolucion(r, partidaId, p ? pasteAnchor(p, ctx?.focusLineId ?? null) : null, text, {
        switchTab: true,
      });
    }

    document.addEventListener('keydown', onKey);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('paste', onPaste);
    return () => {
      clearHint();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('paste', onPaste);
    };
  }, []);
}

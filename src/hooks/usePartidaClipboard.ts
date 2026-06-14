/* ===========================================================================
   usePartidaClipboard — orquesta copiar/pegar de partidas SIN acoplar las dos
   stores: `clipboardStore` (el portapapeles, fuera de obraStore para sobrevivir
   el cambio de obra) solo guarda; este hook lee la partida + el banco de
   `obraStore`, construye el snapshot hidratado y, al pegar, llama a la tubería
   existente `requestCopyRefPartidas` (merge de recursos, ids nuevos, colisiones)
   con procedencia 'clip' (partida limpia, sin chip BASE).

   - copy(p): copia ESA partida (el menú ⋮ actúa sobre su propia fila).
   - paste(target): pega en un destino EXPLÍCITO {chId, subId} (congelado en el
     momento de pegar — el botón "Pegar aquí" vive en cada subcapítulo, así que
     el destino es inequívoco y no depende del foco activo).
   =========================================================================== */
import { useEffect } from 'react';
import { useClipboardStore } from '../store/clipboardStore';
import { ALL, copyTargetOf, useObraStore } from '../store';
import { partidaToRefCopyItem } from '../core/refdata';
import type { Partida, PartidasMap } from '../core/types';

export interface PartidaClipboard {
  /** ¿Hay algo copiado? (reactivo: muestra/oculta los botones "Pegar aquí"). */
  hasClip: boolean;
  /** Copia una partida concreta al portapapeles (snapshot hidratado). */
  copy: (p: Partida) => void;
  /** Pega lo copiado en un capítulo/subcapítulo EXPLÍCITO. */
  paste: (target: { chId: string; subId: string | null }) => void;
}

export function usePartidaClipboard(): PartidaClipboard {
  const hasClip = useClipboardStore((s) => !!s.items?.length);

  const copy = (p: Partida) => {
    const { recursos, obra } = useObraStore.getState();
    const name = obra.denominacion || 'Obra';
    useClipboardStore.getState().setClip([partidaToRefCopyItem(p, recursos, name)], name);
  };

  const paste = (target: { chId: string; subId: string | null }) => {
    const clip = useClipboardStore.getState().items;
    if (!clip?.length) return;
    useObraStore.getState().requestCopyRefPartidas(clip, target, false, 'clip');
  };

  return { hasClip, copy, paste };
}

/** Busca una partida por id en TODOS los buckets del mapa (la clave es el capítulo). */
function findPartidaById(partidas: PartidasMap, id: string): Partida | undefined {
  for (const list of Object.values(partidas)) {
    const hit = list.find((p) => p.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/** ¿El foco está en un control donde Ctrl+C/V es del navegador, no nuestro? */
function inEditableField(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * Atajos Ctrl/Cmd+C (copiar la partida seleccionada) y Ctrl/Cmd+V (pegar en el
 * capítulo/sub activo). Montar UNA vez (en App). Guardas robustas para no
 * secuestrar el portapapeles del navegador: ignora si el foco está en un campo
 * editable, si hay un modal abierto, si la vista no es el presupuesto, si Ctrl+C
 * coincide con una selección de texto nativa, o si Ctrl+V no tiene un destino
 * claro (vista "todos los capítulos" → no-op, sin caer en chapters[0]).
 */
export function useClipboardHotkeys(): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k !== 'c' && k !== 'v') return;
      if (inEditableField()) return;
      if (document.querySelector('[role="dialog"]')) return; // modal abierto
      const s = useObraStore.getState();
      if (s.view !== 'presupuesto') return;

      if (k === 'c') {
        // No pisar una selección de texto real del usuario.
        const sel = window.getSelection?.();
        if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return;
        if (!s.openPartidaId) return;
        const p = findPartidaById(s.partidas, s.openPartidaId);
        if (!p) return;
        const name = s.obra.denominacion || 'Obra';
        useClipboardStore.getState().setClip([partidaToRefCopyItem(p, s.recursos, name)], name);
        e.preventDefault();
      } else {
        if (s.active === ALL) return; // sin capítulo enfocado: no adivinar destino
        const clip = useClipboardStore.getState().items;
        if (!clip?.length) return;
        const t = copyTargetOf(s.chapters, s.active);
        if (!t.chId) return;
        useObraStore
          .getState()
          .requestCopyRefPartidas(clip, { chId: t.chId, subId: t.subId }, false, 'clip');
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

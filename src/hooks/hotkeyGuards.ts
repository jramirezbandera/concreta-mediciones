/* ===========================================================================
   hotkeyGuards — guardas compartidas por los atajos globales (`useAppHotkeys`,
   `useClipboardHotkeys`) para no secuestrar el teclado del navegador ni disparar
   acciones destructivas en el contexto equivocado. Centralizadas aquí para que
   las dos capas de hotkeys no diverjan.
   =========================================================================== */

/** ¿El foco está en edición de texto (input/textarea/select/contentEditable)? */
export function isTextEditingTarget(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** ¿Hay un modal/diálogo bloqueante abierto? */
export function hasBlockingOverlay(): boolean {
  return !!document.querySelector('[role="dialog"]');
}

/** ¿Hay UI transitoria abierta (modal/dropdown/menú) que debería cerrarse antes? */
export function hasTransientOverlay(): boolean {
  return !!document.querySelector('[role="dialog"], [role="listbox"], [role="menu"]');
}

/** ¿Hay una selección de texto real (no colapsada)? */
export function hasNativeSelection(): boolean {
  const sel = window.getSelection?.();
  return !!sel && !sel.isCollapsed && sel.toString().trim().length > 0;
}

/**
 * ¿El evento toca un elemento interactivo (botón/enlace/campo/celda editable)?
 * Guarda de seguridad para atajos destructivos (Supr): pulsarlo con el foco en
 * un botón o una celda de medición NO debe borrar la partida.
 */
export function isInteractiveTarget(e: KeyboardEvent): boolean {
  const path = (e.composedPath?.() ?? []) as EventTarget[];
  return path.some((n) => {
    if (!(n instanceof HTMLElement)) return false;
    const tag = n.tagName;
    return (
      tag === 'BUTTON' ||
      tag === 'A' ||
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      n.getAttribute('role') === 'button' ||
      n.dataset.editcell != null ||
      n.closest('[data-editgrid]') != null
    );
  });
}

/** ¿El foco está dentro de un grid de medición (`[data-editgrid]`)? */
export function inEditGrid(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el?.closest('[data-editgrid]');
}

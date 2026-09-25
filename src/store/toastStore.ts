/* ===========================================================================
   toastStore — avisos transitorios genéricos, con acción opcional (p.ej.
   «Deshacer»). Aquí solo vive el último mensaje + un tick para reaparecer
   aunque se repita el mismo texto: hay UN solo hueco de aviso en pantalla (el
   de copiar partida también pasa por aquí, vía `ClipboardToast`). Lo pinta
   `<Toast/>` y se autodescarta. Lo dispara cualquier acción con
   `useToastStore.getState().show('…')`, o con una acción:
   `show('Eliminada', { label: 'Deshacer', run: () => … })`.
   =========================================================================== */
import { create } from 'zustand';

/** Acción opcional del toast (botón a la derecha del mensaje). */
export interface ToastAction {
  label: string;
  run: () => void;
}

/** Tono del aviso: éxito/info (acento), advertencia (ámbar) o error (rojo). */
export type ToastTone = 'ok' | 'warn' | 'error';

export interface ToastOptions {
  tone?: ToastTone;
  /**
   * Revisión del dominio (`getDomainRevision()`) a la que está atado el aviso:
   * en cuanto la obra cambia (otra edición, un undo), el historial lo descarta,
   * así nunca queda a la vista un «Deshacer» que desharía otra cosa.
   */
  rev?: number;
}

interface ToastState {
  msg: string | null;
  action: ToastAction | null;
  tone: ToastTone;
  rev: number | null;
  /** Incrementa en cada `show` → reactiva el toast aunque el texto no cambie. */
  tick: number;
  show: (msg: string, action?: ToastAction, opts?: ToastOptions) => void;
  /** Descarta el toast Y su acción. Lo llama `loadObra` (D-08): un «Deshacer»
   *  capturado sobre la obra anterior no debe poder ejecutarse contra la nueva. */
  clear: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  msg: null,
  action: null,
  tone: 'ok',
  rev: null,
  tick: 0,
  show: (msg, action, opts) =>
    set((s) => ({
      msg,
      action: action ?? null,
      tone: opts?.tone ?? 'ok',
      rev: opts?.rev ?? null,
      tick: s.tick + 1,
    })),
  clear: () => set({ msg: null, action: null, rev: null }),
}));

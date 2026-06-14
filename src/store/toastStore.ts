/* ===========================================================================
   toastStore — avisos transitorios genéricos (éxito/info), con acción opcional
   (p.ej. «Deshacer»). Separado del `clipboardStore` (que tiene su propio chip
   persistente): aquí solo vive el último mensaje + un tick para reaparecer
   aunque se repita el mismo texto. Lo pinta `<Toast/>` y se autodescarta. Lo
   dispara cualquier acción con `useToastStore.getState().show('…')`, o con una
   acción: `show('Eliminada', { label: 'Deshacer', run: () => … })`.
   =========================================================================== */
import { create } from 'zustand';

/** Acción opcional del toast (botón a la derecha del mensaje). */
export interface ToastAction {
  label: string;
  run: () => void;
}

interface ToastState {
  msg: string | null;
  action: ToastAction | null;
  /** Incrementa en cada `show` → reactiva el toast aunque el texto no cambie. */
  tick: number;
  show: (msg: string, action?: ToastAction) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  msg: null,
  action: null,
  tick: 0,
  show: (msg, action) => set((s) => ({ msg, action: action ?? null, tick: s.tick + 1 })),
}));

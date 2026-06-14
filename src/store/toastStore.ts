/* ===========================================================================
   toastStore — avisos transitorios genéricos (éxito/info). Separado del
   `clipboardStore` (que tiene su propio chip persistente): aquí solo vive el
   último mensaje + un tick para reaparecer aunque se repita el mismo texto. Lo
   pinta `<Toast/>` y se autodescarta. Lo dispara cualquier acción con
   `useToastStore.getState().show('…')` (p.ej. añadir una obra de referencia).
   =========================================================================== */
import { create } from 'zustand';

interface ToastState {
  msg: string | null;
  /** Incrementa en cada `show` → reactiva el toast aunque el texto no cambie. */
  tick: number;
  show: (msg: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  msg: null,
  tick: 0,
  show: (msg) => set((s) => ({ msg, tick: s.tick + 1 })),
}));

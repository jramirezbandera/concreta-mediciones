/* ===========================================================================
   clipboardStore — portapapeles de partidas (copiar/pegar intra-obra y entre
   obras). VIVE FUERA de `obraStore` A PROPÓSITO: `loadObra` (al conmutar de obra)
   resetea TODO el estado de UI del obraStore, así que un portapapeles guardado
   dentro de él se perdería justo al cambiar a la obra destino — que es cuando
   más lo necesitas. Aquí, en su propia store en memoria, sobrevive el switch (se
   pierde al recargar la página; aceptado: el flujo copiar→cambiar de obra→pegar
   es de una sola sesión).

   El payload es `RefCopyItem[]` ya HIDRATADO (precio/ud/desc capturados en el
   momento de copiar), la misma forma que consume `requestCopyRefPartidas` → el
   pegado reusa TODA la tubería de copia existente (merge de recursos sin pisar
   homónimos, ids nuevos, resolución de colisiones).
   =========================================================================== */
import { create } from 'zustand';
import type { RefCopyItem } from '../core/refdata';

interface ClipboardState {
  /** Partidas copiadas (snapshot hidratado), o `null` si está vacío. */
  items: RefCopyItem[] | null;
  /** Nombre de la obra de origen (para el feedback / indicador). */
  sourceObraName: string;
  /** Se incrementa en CADA copia (aunque se recopie lo mismo) → dispara el aviso transitorio. */
  copyTick: number;
  /** Guarda una copia en el portapapeles. */
  setClip: (items: RefCopyItem[], sourceObraName: string) => void;
  /** Vacía el portapapeles. */
  clear: () => void;
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  items: null,
  sourceObraName: '',
  copyTick: 0,
  setClip: (items, sourceObraName) =>
    set((s) => ({ items, sourceObraName, copyTick: s.copyTick + 1 })),
  clear: () => set({ items: null, sourceObraName: '' }),
}));

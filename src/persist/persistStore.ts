/* ===========================================================================
   persistStore — estado de UI de la persistencia (F6.1): indicador de guardado
   y bandera de recuperación. Separado del store de dominio (no se persiste).
   =========================================================================== */
import { create } from 'zustand';

/** Estado del autosave para el indicador. `error` = IndexedDB falló. */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface PersistState {
  status: SaveStatus;
  /** Blob crudo cuando el almacenado es corrupto/versión desconocida (recuperación). */
  recovery: unknown | null;
  setStatus: (s: SaveStatus) => void;
  setRecovery: (raw: unknown | null) => void;
}

export const usePersistStore = create<PersistState>((set) => ({
  status: 'idle',
  recovery: null,
  setStatus: (status) => set({ status }),
  setRecovery: (recovery) => set({ recovery }),
}));

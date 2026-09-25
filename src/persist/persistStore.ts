/* ===========================================================================
   persistStore — estado de UI de la persistencia (F6.1): indicador de guardado
   y bandera de recuperación. Separado del store de dominio (no se persiste).
   =========================================================================== */
import { create } from 'zustand';
import type { Durability } from './durability';

/** Estado del autosave para el indicador. `error` = IndexedDB falló. */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface PersistState {
  status: SaveStatus;
  /** Blob crudo cuando el almacenado es corrupto/versión desconocida (recuperación). */
  recovery: unknown | null;
  /** Clave del blob en recuperación (multi-obra: exportar/descartar la obra concreta). */
  recoveryKey: string | null;
  /** ¿El navegador puede borrar las obras por su cuenta? Ver `durability`. */
  durability: Durability;
  setStatus: (s: SaveStatus) => void;
  setRecovery: (raw: unknown | null, key?: string | null) => void;
  setDurability: (d: Durability) => void;
}

export const usePersistStore = create<PersistState>((set) => ({
  status: 'idle',
  recovery: null,
  recoveryKey: null,
  durability: 'unknown',
  setStatus: (status) => set({ status }),
  setRecovery: (recovery, recoveryKey = null) => set({ recovery, recoveryKey }),
  setDurability: (durability) => set({ durability }),
}));

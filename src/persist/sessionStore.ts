/* ===========================================================================
   sessionStore — estado REACTIVO de la sesión multi-obra (T-10, PR2): la lista
   de obras (metadatos), la obra activa y si hay un cambio de obra en curso.
   Separado del store de dominio (`useObraStore`, que tiene UNA obra viva) y de la
   capa de persistencia: aquí solo vive lo que el selector de obra del top bar
   necesita pintar. `sync` es quien lo escribe (al hidratar, guardar, conmutar,
   crear o borrar); la UI solo lo lee.
   =========================================================================== */
import { create } from 'zustand';
import type { ObraMeta } from './registry';

interface SessionState {
  /** Metadatos de todas las obras guardadas (para el dropdown). */
  obras: ObraMeta[];
  /** Id de la obra viva (la que se está editando/autoguardando). */
  activeId: string | null;
  /** Cambio de obra en curso (deshabilita el selector mientras carga). */
  switching: boolean;
  setObras: (obras: ObraMeta[]) => void;
  setActiveId: (activeId: string | null) => void;
  setSwitching: (switching: boolean) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  obras: [],
  activeId: null,
  switching: false,
  setObras: (obras) => set({ obras }),
  setActiveId: (activeId) => set({ activeId }),
  setSwitching: (switching) => set({ switching }),
}));

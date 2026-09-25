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
  /** Esta pestaña es SOLO-LECTURA: el autosave NO escribe. Por qué, en
   *  `readonlyMotivo`. */
  readonly: boolean;
  /** `otra-pestana`: la obra la tiene otra pestaña (T-19). `sin-recargar`: al
   *  heredarla no se pudo releer de disco. `mas-nueva`: la guardó una versión
   *  posterior de Concreta. `null` mientras no es solo lectura. */
  readonlyMotivo: ReadonlyMotivo | null;
  setObras: (obras: ObraMeta[]) => void;
  /** Inserta/actualiza UNA obra sin tocar las demás. Lo usa la importación como
   *  referencia: añade la obra nueva al selector sin pisar la meta de la activa
   *  (un `setObras` con lista entera leída aparte podría regresarla). */
  upsertObra: (meta: ObraMeta) => void;
  setActiveId: (activeId: string | null) => void;
  setSwitching: (switching: boolean) => void;
  setReadonly: (readonly: boolean, motivo?: ReadonlyMotivo) => void;
}

export type ReadonlyMotivo = 'otra-pestana' | 'sin-recargar' | 'mas-nueva';

export const useSessionStore = create<SessionState>((set) => ({
  obras: [],
  activeId: null,
  switching: false,
  readonly: false,
  readonlyMotivo: null,
  setObras: (obras) => set({ obras }),
  upsertObra: (meta) =>
    set((s) => ({
      obras: s.obras.some((o) => o.id === meta.id)
        ? s.obras.map((o) => (o.id === meta.id ? meta : o))
        : [...s.obras, meta],
    })),
  setActiveId: (activeId) => set({ activeId }),
  setSwitching: (switching) => set({ switching }),
  setReadonly: (readonly, motivo = 'otra-pestana') =>
    set({ readonly, readonlyMotivo: readonly ? motivo : null }),
}));

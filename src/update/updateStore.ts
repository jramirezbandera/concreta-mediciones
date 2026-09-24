/* ===========================================================================
   updateStore — aviso de «versión nueva disponible». El vigilante
   (`startUpdateWatcher`) anota aquí el build publicado cuando no coincide con
   el que corre; `<UpdatePrompt/>` lo pinta. «Más tarde» lo pospone una hora
   para ESE build: uno más nuevo, o un chunk que ya no carga, lo reabre antes.
   =========================================================================== */
import { create } from 'zustand';

/** Cuánto calla «Más tarde» el aviso del mismo build. */
export const SNOOZE_MS = 60 * 60_000;

interface Snooze {
  build: string;
  at: number;
}

interface UpdateState {
  /** Build publicado distinto del que corre (null = al día o sin datos). */
  latest: string | null;
  /** Un import dinámico falló y hay build nuevo: el deploy purgó los chunks de
   *  esta sesión y parte de la app ya no carga. Reabre el aviso aunque se
   *  hubiera pospuesto (cada fallo nuevo lo vuelve a marcar). */
  broken: boolean;
  snoozed: Snooze | null;
  /** Lo llama el vigilante en cada comprobación que encuentra un build distinto. */
  found: (build: string, broken?: boolean) => void;
  /** «Más tarde». */
  dismiss: () => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  latest: null,
  broken: false,
  snoozed: null,
  found: (build, broken = false) =>
    set((s) => {
      // El aplazamiento solo vale para el MISMO build y mientras no caduque.
      const keep = s.snoozed?.build === build && Date.now() - s.snoozed.at < SNOOZE_MS;
      return { latest: build, broken: s.broken || broken, snoozed: keep ? s.snoozed : null };
    }),
  dismiss: () =>
    set((s) => ({ broken: false, snoozed: s.latest ? { build: s.latest, at: Date.now() } : null })),
}));

/** ¿Se muestra el aviso? */
export const selectUpdateVisible = (s: UpdateState): boolean =>
  s.latest !== null && (s.broken || s.snoozed === null);

import { create } from 'zustand';

export type Anejo = 'residuos' | 'calidad';

/** Qué anejo está abierto: sobrevive al ir y volver de otra vista (no se guarda con la obra). */
export const useAnejoStore = create<{ anejo: Anejo; setAnejo: (a: Anejo) => void }>((set) => ({
  anejo: 'residuos',
  setAnejo: (anejo) => set({ anejo }),
}));

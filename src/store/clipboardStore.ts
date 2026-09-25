/* ===========================================================================
   clipboardStore — portapapeles de partidas Y de líneas de medición
   (copiar/pegar intra-obra y entre obras). VIVE FUERA de `obraStore` A
   PROPÓSITO: `loadObra` (al conmutar de obra) resetea TODO el estado de UI del
   obraStore, así que un portapapeles guardado dentro de él se perdería justo al
   cambiar a la obra destino — que es cuando más lo necesitas. Aquí, en su propia
   store en memoria, sobrevive el switch (se pierde al recargar la página;
   aceptado: el flujo copiar→cambiar de obra→pegar es de una sola sesión).

   Partidas: `RefCopyItem[]` ya HIDRATADO (precio/ud/desc capturados en el
   momento de copiar), la misma forma que consume `requestCopyRefPartidas` → el
   pegado reusa TODA la tubería de copia existente (merge de recursos sin pisar
   homónimos, ids nuevos, resolución de colisiones).

   Líneas: instantánea inmutable (copias profundas) + su procedencia (partida,
   forma de medir y ud, para avisar si el destino se mide de otra forma).

   «La última copia manda»: copiar partidas vacía las líneas y viceversa, así
   Ctrl+V nunca es ambiguo.
   =========================================================================== */
import { create } from 'zustand';
import type { RefCopyItem } from '../core/refdata';
import type { MedForma, MedLine } from '../core/types';

/** Procedencia de unas líneas copiadas. */
export interface MedClipSource {
  chapterId: string;
  partidaId: string;
  code: string;
  title: string;
  /** Forma de medir EFECTIVA de la partida de origen al copiar. */
  forma: MedForma;
  ud: string;
  obraName: string;
}

/** Líneas de medición copiadas. */
export interface MedClip {
  /** Copias profundas (conservan el id de origen solo como referencia: pegar
   *  siempre da ids nuevos). */
  lines: MedLine[];
  source: MedClipSource;
}

interface ClipboardState {
  /** Partidas copiadas (snapshot hidratado), o `null` si está vacío. */
  items: RefCopyItem[] | null;
  /** Nombre de la obra de origen (para el feedback / indicador). */
  sourceObraName: string;
  /** Líneas de medición copiadas, o `null`. Excluyente con `items`. */
  medLines: MedClip | null;
  /** Se incrementa en CADA copia (aunque se recopie lo mismo) → dispara el aviso transitorio. */
  copyTick: number;
  /** Guarda una copia de partidas en el portapapeles (y vacía las líneas). */
  setClip: (items: RefCopyItem[], sourceObraName: string) => void;
  /** Guarda una copia de líneas de medición (y vacía las partidas). */
  setMedClip: (clip: MedClip) => void;
  /** Vacía el portapapeles. */
  clear: () => void;
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  items: null,
  sourceObraName: '',
  medLines: null,
  copyTick: 0,
  setClip: (items, sourceObraName) =>
    set((s) => ({ items, sourceObraName, medLines: null, copyTick: s.copyTick + 1 })),
  setMedClip: (clip) =>
    set((s) => ({
      medLines: clip,
      items: null,
      sourceObraName: clip.source.obraName,
      copyTick: s.copyTick + 1,
    })),
  clear: () => set({ items: null, sourceObraName: '', medLines: null }),
}));

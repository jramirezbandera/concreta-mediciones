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
   forma de medir y ud, para avisar si el destino se mide de otra forma), el
   TSV que se escribió en el portapapeles del sistema y un id propio (viaja
   con un tipo MIME propio: es lo que autoriza a MOVER un cortado).

   «La última copia manda»: copiar partidas vacía las líneas y viceversa, así
   Ctrl+V nunca es ambiguo.
   =========================================================================== */
import { create } from 'zustand';
import type { RefCopyItem } from '../core/refdata';
import type { MedForma, MedLine } from '../core/types';

/** Tipo MIME propio con el id de la copia o del corte. */
export const MEDLINES_MIME = 'application/x-concreta-medlines';

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
  /** Identidad del documento abierto al copiar (`obraStore.docToken`): un
   *  cortado solo se MUEVE dentro de la misma obra. */
  docToken: string;
}

/** Líneas de medición copiadas o cortadas. */
export interface MedClip {
  /** Id de ESTA copia (viaja en `MEDLINES_MIME`). */
  id: string;
  /** Copias profundas (conservan el id de origen: para un cortado, son las
   *  líneas que se moverán; pegar como copia siempre da ids nuevos). */
  lines: MedLine[];
  source: MedClipSource;
  /** TSV exacto escrito en el portapapeles del sistema. */
  tsv: string;
  /** Cortar: al pegar en la misma obra, las líneas se mueven. */
  cut: boolean;
  /** ¿Llegó el TSV al portapapeles del sistema? `null` = aún no se sabe.
   *  `false`: el siguiente pegado usa lo interno aunque el sistema tenga otro texto. */
  sysOk: boolean | null;
}

interface ClipboardState {
  /** Partidas copiadas (snapshot hidratado), o `null` si está vacío. */
  items: RefCopyItem[] | null;
  /** Nombre de la obra de origen (para el feedback / indicador). */
  sourceObraName: string;
  /** Líneas de medición copiadas, o `null`. Excluyente con `items`. */
  medLines: MedClip | null;
  /** Último cortado ya pegado (movido): su id bloquea volver a pegarlo por el
   *  MIME propio; con solo el texto, se pregunta. Se vacía con otra copia. */
  consumed: { id: string; tsv: string } | null;
  /** Se incrementa en CADA copia (aunque se recopie lo mismo) → dispara el aviso transitorio. */
  copyTick: number;
  /** Guarda una copia de partidas en el portapapeles (y vacía las líneas). */
  setClip: (items: RefCopyItem[], sourceObraName: string) => void;
  /** Guarda una copia o un corte de líneas (y vacía las partidas). */
  setMedClip: (clip: MedClip) => void;
  /** Un cortado ya movido: fuera del portapapeles, su id pasa a `consumed`. */
  consumeMedClip: () => void;
  /** Un cortado pasa a copia normal (se pegó en otra obra, o como copia). */
  uncutMedClip: () => void;
  /** Resultado de escribir en el portapapeles del sistema (solo si sigue siendo esa copia). */
  setSysOk: (id: string, ok: boolean) => void;
  /** Vacía el portapapeles. */
  clear: () => void;
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  items: null,
  sourceObraName: '',
  medLines: null,
  consumed: null,
  copyTick: 0,
  setClip: (items, sourceObraName) =>
    set((s) => ({ items, sourceObraName, medLines: null, consumed: null, copyTick: s.copyTick + 1 })),
  setMedClip: (clip) =>
    set((s) => ({
      medLines: clip,
      items: null,
      consumed: null,
      sourceObraName: clip.source.obraName,
      copyTick: s.copyTick + 1,
    })),
  consumeMedClip: () =>
    set((s) => (s.medLines ? { medLines: null, consumed: { id: s.medLines.id, tsv: s.medLines.tsv } } : s)),
  uncutMedClip: () => set((s) => (s.medLines?.cut ? { medLines: { ...s.medLines, cut: false } } : s)),
  setSysOk: (id, ok) =>
    set((s) => (s.medLines?.id === id && s.medLines.sysOk !== ok ? { medLines: { ...s.medLines, sysOk: ok } } : s)),
  clear: () => set({ items: null, sourceObraName: '', medLines: null, consumed: null }),
}));

/* ===========================================================================
   store/medUiStore — estado EFÍMERO de la medición de la partida abierta:
   pestaña del panel, selección de líneas, línea con el foco, petición de foco
   pendiente, diálogo de revisión y anuncio para lectores de pantalla.

   Vive FUERA de `obraStore` (no es dominio: ni historial ni autosave) y FUERA
   de `DetailPanel`: la tabla (escritorio) y las tarjetas (<780) montan árboles
   distintos, así que un `useState` se perdía al cruzar el punto de corte. Y los
   atajos globales (`useMedClipboard`) lo consultan sin depender del foco (en
   Safari/Firefox de macOS un click en un botón deja el foco en el body).

   · Se reinicia al cambiar la partida abierta (`openPartidaId`), también al
     cargar o resetear una obra (que la ponen a null).
   · Se poda contra las líneas actuales tras cada cambio del dominio (borrar,
     deshacer): nunca quedan seleccionados ids que ya no existen.
   =========================================================================== */
import { create } from 'zustand';
import type { PegadoPreparado } from '../core/medPaste';
import { useObraStore } from './obraStore';

export type DetailTab = 'medicion' | 'descripcion' | 'justif';

/** Foco que el panel aplica tras el próximo render (las filas se mueven o se
 *  crean, así que el foco no puede fijarse en el mismo evento). */
export type FocusRequest =
  /** Celda `col` (`'del'` = su botón de borrar) de la PRIMERA de `lineIds`
   *  que exista; si ninguna, la primera fila; si no hay filas, «Añadir línea». */
  | { partidaId: string; kind: 'lines'; lineIds: string[]; col: number | 'del'; scroll?: boolean }
  | { partidaId: string; kind: 'add' };

/** Diálogo único de revisión pendiente (`MedPasteReview`). */
export type MedReview =
  /** Pegar o mover con algo que confirmar (formas, certificadas, faltantes). */
  | { kind: 'paste'; prep: PegadoPreparado; nota?: string }
  /**
   * Elegir qué hacer cuando el pegado no trae la identidad del corte (solo
   * coincide el texto) o el texto es de un corte ya movido.
   */
  | {
      kind: 'choose';
      reason: 'cut-text' | 'consumed-text';
      partidaId: string;
      afterId: string | null;
      /** Texto pegado (para «Pegar una copia» de un corte ya movido). */
      text: string;
      /** Código de la partida del corte. */
      srcCode: string;
      n: number;
    }
  | {
      kind: 'delete';
      chapterId: string;
      partidaId: string;
      /** Todas las que se van a borrar (orden de lista). */
      lineIds: string[];
      /** Las certificadas de entre ellas, y en qué certificaciones (nº). */
      certLineIds: string[];
      certNums: number[];
      /** Mostrar aviso con Deshacer tras borrar (barra), o no (la X). */
      toast: boolean;
      /** Columna a la que va el foco tras borrar (`'del'` = la X de la fila). */
      col: number | 'del';
    };

interface MedUiState {
  /** Partida a la que pertenecen selección, ancla y foco. */
  partidaId: string | null;
  tab: DetailTab;
  /** Ids seleccionados (sin orden: las acciones los ordenan por la lista). */
  selected: string[];
  /** Fila desde la que se amplía un rango (Shift+click, Shift+↑/↓). */
  anchorId: string | null;
  /** Línea con el foco, o la última que lo tuvo mientras el foco siguió dentro
   *  de la medición (el botón «Pegar» la usa aunque se active con teclado). */
  lastFocusedLineId: string | null;
  pendingFocus: FocusRequest | null;
  review: MedReview | null;
  /** Franja de error de un pegado rechazado (TSV ilegible), bajo la medición.
   *  Se va con ✕ o con un pegado que salga bien. */
  pasteError: { partidaId: string; text: string } | null;
  /** Texto para `aria-live` (reordenar no muestra aviso visual). `n` fuerza el
   *  re-anuncio aunque el texto se repita. */
  announce: { text: string; n: number };

  setTab: (tab: DetailTab) => void;
  /** Sustituye la selección (vacía = quita la selección). Sin `anchorId`, el
   *  ancla pasa a la primera de `ids`. */
  select: (partidaId: string, ids: string[], anchorId?: string | null) => void;
  clearSelection: () => void;
  setLastFocused: (partidaId: string, lineId: string | null) => void;
  requestFocus: (req: FocusRequest) => void;
  consumeFocus: () => void;
  openReview: (review: MedReview) => void;
  closeReview: () => void;
  setPasteError: (err: { partidaId: string; text: string } | null) => void;
  say: (text: string) => void;
  reset: () => void;
}

const INITIAL = {
  partidaId: null,
  tab: 'medicion' as DetailTab,
  selected: [] as string[],
  anchorId: null,
  lastFocusedLineId: null,
  pendingFocus: null,
  review: null,
  pasteError: null,
};

export const useMedUiStore = create<MedUiState>((set) => ({
  ...INITIAL,
  announce: { text: '', n: 0 },

  setTab: (tab) => set({ tab }),
  select: (partidaId, ids, anchorId) =>
    set({ partidaId, selected: ids, anchorId: anchorId === undefined ? (ids[0] ?? null) : anchorId }),
  clearSelection: () => set((s) => (s.selected.length || s.anchorId ? { selected: [], anchorId: null } : s)),
  setLastFocused: (partidaId, lineId) =>
    set((s) =>
      s.lastFocusedLineId === lineId && s.partidaId === partidaId
        ? s
        : // Cambiar de partida por el foco descarta la selección de la anterior.
          s.partidaId === partidaId
          ? { lastFocusedLineId: lineId }
          : { partidaId, lastFocusedLineId: lineId, selected: [], anchorId: null },
    ),
  requestFocus: (req) => set({ pendingFocus: req }),
  consumeFocus: () => set({ pendingFocus: null }),
  openReview: (review) => set({ review }),
  closeReview: () => set({ review: null }),
  setPasteError: (pasteError) => set({ pasteError }),
  say: (text) => set((s) => ({ announce: { text, n: s.announce.n + 1 } })),
  reset: () => set({ ...INITIAL }),
}));

/** ¿Hay selección de líneas en ESTA partida? */
export function selectionOf(partidaId: string): string[] {
  const s = useMedUiStore.getState();
  return s.partidaId === partidaId ? s.selected : [];
}

/* ---- ciclo de vida atado a la obra ------------------------------------------
   Suscripciones de módulo: se activan en cuanto algo importa este store (el
   panel de detalle). Idempotentes por construcción (una por carga del módulo). */

// Cambiar la partida abierta (o cargar/resetear una obra) reinicia TODO.
useObraStore.subscribe(
  (s) => s.openPartidaId,
  () => useMedUiStore.getState().reset(),
);

// Poda tras cada cambio de las partidas (borrar, deshacer, mover de capítulo).
useObraStore.subscribe(
  (s) => s.partidas,
  (partidas) => {
    const ui = useMedUiStore.getState();
    if (!ui.partidaId || (!ui.selected.length && !ui.anchorId && !ui.lastFocusedLineId)) return;
    let med: { id: string }[] | undefined;
    for (const list of Object.values(partidas)) {
      med = list.find((p) => p.id === ui.partidaId)?.med;
      if (med) break;
    }
    const alive = new Set((med ?? []).map((l) => l.id));
    const selected = ui.selected.filter((id) => alive.has(id));
    const anchorId = ui.anchorId && alive.has(ui.anchorId) ? ui.anchorId : null;
    const lastFocusedLineId =
      ui.lastFocusedLineId && alive.has(ui.lastFocusedLineId) ? ui.lastFocusedLineId : null;
    if (
      selected.length === ui.selected.length &&
      anchorId === ui.anchorId &&
      lastFocusedLineId === ui.lastFocusedLineId
    )
      return;
    useMedUiStore.setState({ selected, anchorId, lastFocusedLineId });
  },
);

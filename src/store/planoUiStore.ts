/* ===========================================================================
   store/planoUiStore — estado de interfaz del visor de planos (no es dominio:
   no se guarda ni entra en Deshacer). Especificación · Etapa A, §3.3 y §5.

   · Qué se ve: plano y página abiertos, pantalla completa, ancho del panel.
   · Cómo se mide: Restar, dimensiones fijas POR PARTIDA (la Altura de Pintura
     no aparece al abrir Alicatado), la decisión de Superficie en L×A y el
     punto de inserción de las líneas nuevas.
   · Lo que el marcador de origen necesita sin cargar el visor: si los bytes de
     cada huella están en este navegador, y las peticiones «Ver en plano» y
     «Volver a medir».
   Se vacía al cambiar de obra (`docToken`) y se reconcilia con `planos` tras
   Deshacer (`reconciliar`).
   =========================================================================== */
import { create } from 'zustand';
import { planoLegible } from '../core/planoDatos';
import type { MedDim, PlanoMeta } from '../core/types';

export interface Destacar {
  planoId: string;
  pagina: number;
  formaId: string;
  lineId: string;
  nonce: number;
}

export interface PlanoUiState {
  /** Obra a la que pertenece este estado. */
  docToken: string | null;
  /** Plano abierto; `null` = la lista de planos. */
  planoId: string | null;
  pagina: number;
  /** Ancho del panel en split (px); `null` = el 55 % del área principal. */
  ancho: number | null;
  pantallaCompleta: boolean;
  restar: boolean;
  /** Texto tecleado en cada dimensión fija, por partida. */
  fijas: Record<string, Partial<Record<MedDim, string>>>;
  /** La h de «(tramos)×h», por partida. */
  factor: Record<string, string>;
  /** Superficie en una partida L×A con líneas (§3.2): true = pasar a Superficie
   *  directa, false = usar Rectángulo; ausente = aún no se ha preguntado. */
  supDirecta: Record<string, boolean>;
  /** Partidas usadas hace poco en cada plano (las 5 últimas). */
  recientes: Record<string, string[]>;
  /** Punto de inserción (§5.3): detrás de qué línea entran las medidas. */
  insercion: { partidaId: string; afterId: string | null } | null;
  /** ¿Están los bytes de cada huella en este navegador? (ausente = sin mirar). */
  disponibles: Record<string, boolean>;
  destacar: Destacar | null;
  /** «Volver a medir» pedido desde el marcador de una línea. */
  remedir: { lineId: string; nonce: number } | null;

  abrirPlano: (planoId: string | null, pagina?: number) => void;
  setPagina: (pagina: number) => void;
  setAncho: (px: number | null) => void;
  setPantallaCompleta: (v: boolean) => void;
  setRestar: (v: boolean) => void;
  setFija: (partidaId: string, slot: MedDim, texto: string) => void;
  setFactor: (partidaId: string, texto: string) => void;
  setSupDirecta: (partidaId: string, v: boolean) => void;
  usarPartida: (planoId: string, partidaId: string) => void;
  setInsercion: (i: { partidaId: string; afterId: string | null } | null) => void;
  setDisponible: (huella: string, v: boolean) => void;
  pedirDestacar: (d: Omit<Destacar, 'nonce'>) => void;
  pedirRemedir: (lineId: string) => void;
  limpiarRemedir: () => void;
  /** Tras Deshacer o cambiar de obra: el plano que se ve sigue existiendo. */
  reconciliar: (planos: readonly unknown[], docToken: string) => void;
  reset: () => void;
}

const INICIAL = {
  docToken: null,
  planoId: null,
  pagina: 1,
  ancho: null,
  pantallaCompleta: false,
  restar: false,
  fijas: {},
  factor: {},
  supDirecta: {},
  recientes: {},
  insercion: null,
  disponibles: {},
  destacar: null,
  remedir: null,
} satisfies Partial<PlanoUiState>;

let nonce = 0;

export const usePlanoUiStore = create<PlanoUiState>((set, get) => ({
  ...INICIAL,
  abrirPlano: (planoId, pagina = 1) => set({ planoId, pagina: Math.max(1, pagina) }),
  setPagina: (pagina) => set({ pagina: Math.max(1, pagina) }),
  setAncho: (ancho) => set({ ancho }),
  setPantallaCompleta: (pantallaCompleta) => set({ pantallaCompleta }),
  setRestar: (restar) => set({ restar }),
  setFija: (partidaId, slot, texto) =>
    set((s) => ({ fijas: { ...s.fijas, [partidaId]: { ...s.fijas[partidaId], [slot]: texto } } })),
  setFactor: (partidaId, texto) => set((s) => ({ factor: { ...s.factor, [partidaId]: texto } })),
  setSupDirecta: (partidaId, v) => set((s) => ({ supDirecta: { ...s.supDirecta, [partidaId]: v } })),
  usarPartida: (planoId, partidaId) =>
    set((s) => {
      const antes = s.recientes[planoId] ?? [];
      if (antes[0] === partidaId) return s;
      return { recientes: { ...s.recientes, [planoId]: [partidaId, ...antes.filter((x) => x !== partidaId)].slice(0, 5) } };
    }),
  setInsercion: (insercion) => set({ insercion }),
  setDisponible: (huella, v) =>
    set((s) => (s.disponibles[huella] === v ? s : { disponibles: { ...s.disponibles, [huella]: v } })),
  pedirDestacar: (d) => set({ destacar: { ...d, nonce: ++nonce }, planoId: d.planoId, pagina: d.pagina }),
  pedirRemedir: (lineId) => set({ remedir: { lineId, nonce: ++nonce } }),
  limpiarRemedir: () => set({ remedir: null }),
  reconciliar: (planos, docToken) => {
    const s = get();
    if (s.docToken === null) set({ docToken }); // la primera vez solo se adopta
    else if (s.docToken !== docToken) {
      // Otra obra: nada del visor anterior vale (salvo el ancho y la disponibilidad).
      set({ ...INICIAL, ancho: s.ancho, disponibles: s.disponibles, docToken });
      return;
    }
    if (!s.planoId) return;
    const p = planos.find((x): x is PlanoMeta => planoLegible(x) && x.id === s.planoId);
    if (!p || p.quitado) set({ planoId: null, pagina: 1 });
    else if (s.pagina > p.paginas) set({ pagina: 1 });
  },
  reset: () => set({ ...INICIAL }),
}));

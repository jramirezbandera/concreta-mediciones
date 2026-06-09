/* ===========================================================================
   store/obraStore — estado global de la obra (Zustand + Immer).
   ---------------------------------------------------------------------------
   Reúne el estado de DOMINIO (capítulos, partidas, banco, certs, tasas, obra),
   sembrado desde `core/seed`, con el estado de UI (vista activa, capítulo
   seleccionado, capítulos desplegados, certificación en curso). Las tasas son
   estado del store, NUNCA globals mutados (§8 del plan; era un hack del
   prototipo `window.IVA_RATE`).

   Alcance F1: estado sembrado + acciones básicas (setView/setActive/setRates/
   onCertEdit). El CRUD completo (mover/borrar/añadir partidas, editar medición
   y recursos, sincronizar `precio` con el descompuesto) es de F2; el store queda
   preparado pero esas acciones no se implementan aquí.
   =========================================================================== */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Banco, Cert, Chapter, Obra, PartidasMap, Rates } from '../core/types';
import { buildRecursos } from '../core/banco';
import { estaCertToOrigen, prevDataOf } from '../core/certificacion';
import { round2 } from '../core/money';
import { CHAPTERS, DEFAULT_OBRA, DEFAULT_RATES, PARTIDAS, makeCertsInit } from '../core/seed';
import type { View } from '../layout/types';

/** Selección especial del sidebar: "Toda la obra". */
export const ALL = '__ALL__';

/** Modo de edición de una certificación: importe a origen vs. de esta cert. */
export type CertMode = 'origen' | 'esta';

/** Estado de dominio de la obra (lo que persistiría en F6). */
export interface ObraData {
  chapters: Chapter[];
  partidas: PartidasMap;
  recursos: Banco;
  certs: Cert[];
  rates: Rates;
  obra: Obra;
}

export interface ObraState extends ObraData {
  /* ---- estado de UI ---- */
  /** Vista activa (tabs). */
  view: View;
  /** Capítulo/subcapítulo seleccionado, o `__ALL__` para toda la obra. */
  active: string;
  /** Capítulos desplegados en el sidebar (id → abierto). */
  expanded: Record<string, boolean>;
  /** Índice de la certificación en curso dentro de `certs`. */
  curCert: number;

  /* ---- acciones (F1) ---- */
  setView: (v: View) => void;
  setActive: (id: string) => void;
  /** Edita una o varias tasas (iva/gg/bi/coefK) sin tocar globals. */
  setRates: (patch: Partial<Rates>) => void;
  /** Selecciona la certificación en curso por índice. */
  setCurCert: (index: number) => void;
  /**
   * Edita la cantidad ejecutada de una partida en la cert en curso.
   * En modo `origen` guarda el valor como cantidad A ORIGEN; en modo `esta`
   * convierte el valor tecleado (cantidad de ESTA cert) a origen con
   * `core/certificacion.estaCertToOrigen` = round2(max(0, anterior + v)).
   */
  onCertEdit: (partidaId: string, value: number, mode: CertMode) => void;
  /** Restaura el estado sembrado (datos + UI). Útil en tests y para "nueva obra". */
  reset: () => void;
}

/**
 * Construye el estado de dominio desde `core/seed`. Clona partidas/capítulos
 * (en F2 se mutan), deriva el banco con `buildRecursos` y siembra el histórico
 * de certificaciones. Las tasas y la obra se copian (no se comparte referencia
 * con el seed para no contaminarlo entre stores/tests).
 */
export function seedObraData(): ObraData {
  const partidas = structuredClone(PARTIDAS);
  return {
    chapters: structuredClone(CHAPTERS),
    partidas,
    recursos: buildRecursos(partidas),
    certs: makeCertsInit(partidas),
    rates: { ...DEFAULT_RATES },
    obra: { ...DEFAULT_OBRA },
  };
}

/** Estado de UI inicial (sincronizado con el nº de certs sembradas). */
function seedUi(certs: Cert[]) {
  return {
    view: 'presupuesto' as View,
    active: '01',
    expanded: { '01': true } as Record<string, boolean>,
    curCert: Math.max(0, certs.length - 1), // la última cert queda en curso
  };
}

export const useObraStore = create<ObraState>()(
  immer((set) => {
    const data = seedObraData();
    return {
      ...data,
      ...seedUi(data.certs),

      setView: (v) =>
        set((s) => {
          s.view = v;
        }),

      setActive: (id) =>
        set((s) => {
          s.active = id;
        }),

      setRates: (patch) =>
        set((s) => {
          Object.assign(s.rates, patch);
        }),

      setCurCert: (index) =>
        set((s) => {
          s.curCert = index;
        }),

      onCertEdit: (partidaId, value, mode) =>
        set((s) => {
          const cert = s.certs[s.curCert];
          if (!cert) return;
          if (mode === 'esta') {
            const prev = prevDataOf(s.certs, s.curCert)[partidaId] ?? 0;
            cert.data[partidaId] = estaCertToOrigen(prev, value);
          } else {
            // a origen: la cantidad no baja de 0; round2 para 2 decimales estables
            cert.data[partidaId] = round2(Math.max(0, value));
          }
        }),

      reset: () =>
        set((s) => {
          const fresh = seedObraData();
          s.chapters = fresh.chapters;
          s.partidas = fresh.partidas;
          s.recursos = fresh.recursos;
          s.certs = fresh.certs;
          s.rates = fresh.rates;
          s.obra = fresh.obra;
          Object.assign(s, seedUi(fresh.certs));
        }),
    };
  }),
);

/* ===========================================================================
   store/slices/pccSlice — acciones del plan de control de calidad (v8).
   Plan: docs/plan-control-calidad.md (§4, §8 y E3).

   · Cada acción es UN paso de Deshacer (`structural`): `partidas` y
     `planCalidad` son claves de dominio.
   · Asignar control NO pasa por el copy-on-write ni quita la marca BASE: no
     cambia el precio ni la definición de la partida.
   · Nada se confirma solo: las reglas dejan propuestas.
   · Al confirmar se guarda la huella de la partida (O6). Una confirmada que ha
     cambiado vuelve a leerse con las reglas al confirmarla otra vez, salvo lo
     puesto a mano, que se conserva.
   · Solo importa `core/pcc/reglas` y `core/pcc/datos` (P1): el cálculo, el
     catálogo y las tablas del Código van con la vista.
   =========================================================================== */
import { capituloControlPropuesto, enCapituloControl, planVacio } from '../../core/pcc/datos';
import { estadoTrasConfirmar, huellaDe, necesitaRevision, proponerControl } from '../../core/pcc/reglas';
import type { ControlPartida, PlanCalidadDatos, PrecioCopiado } from '../../core/pcc/tipos';
import type { Partida } from '../../core/types';
import type { ObraSlice, ObraState } from '../obraStore';
import { structural } from './estructuraSlice';

export interface RefPartidaPcc {
  chapterId: string;
  partidaId: string;
}

type PccActions = Pick<
  ObraState,
  | 'iniciarPlanCalidad'
  | 'setPlanCalidad'
  | 'quitarPlanCalidad'
  | 'setControlPartida'
  | 'confirmarControles'
  | 'proponerControles'
  | 'aplicarControlAHomonimos'
  | 'tomarPreciosPlan'
>;

/** Propuesta de las reglas para una partida de la obra abierta. */
function propuestaDe(s: Pick<ObraState, 'chapters' | 'recursos' | 'planCalidad'>, chapterId: string, p: Partida): ControlPartida | null {
  return proponerControl(p, {
    banco: s.recursos,
    enCapituloControl: enCapituloControl(s.chapters, s.planCalidad?.capituloControl, chapterId, p),
  });
}

/** Pone propuestas en las partidas sin asignar. Devuelve cuántas. */
function proponerEn(s: ObraState): number {
  let n = 0;
  for (const ch of s.chapters)
    for (const p of s.partidas[ch.id] ?? []) {
      if (p.pcc) continue;
      const c = propuestaDe(s, ch.id, p);
      if (c) {
        p.pcc = c;
        n += 1;
      }
    }
  return n;
}

export const createPccSlice: ObraSlice<PccActions> = (set, get) => ({
  iniciarPlanCalidad: () => {
    let n = 0;
    structural(() =>
      set((s) => {
        if (s.planCalidad) return;
        s.planCalidad = planVacio({ capituloControl: capituloControlPropuesto(s.chapters) });
        n = proponerEn(s);
      }),
    );
    return n;
  },

  setPlanCalidad: (patch: Partial<PlanCalidadDatos>) =>
    structural(() =>
      set((s) => {
        if (!s.planCalidad) return;
        Object.assign(s.planCalidad, patch);
      }),
    ),

  quitarPlanCalidad: () =>
    structural(() =>
      set((s) => {
        s.planCalidad = undefined;
      }),
    ),

  setControlPartida: (chapterId: string, partidaId: string, pcc: ControlPartida | null) =>
    structural(() =>
      set((s) => {
        const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
        if (!p) return;
        if (pcc) p.pcc = pcc;
        else delete p.pcc;
      }),
    ),

  confirmarControles: (refs: RefPartidaPcc[]) => {
    let n = 0;
    structural(() =>
      set((s) => {
        for (const { chapterId, partidaId } of refs) {
          const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
          const c = p?.pcc;
          if (!p || !c) continue;
          if (c.estado === 'propuesta') {
            c.estado = estadoTrasConfirmar(c);
            if (c.estado === 'confirmada') c.huella = huellaDe(p);
            n += 1;
          } else if (necesitaRevision(c, p)) {
            // Lo puesto a mano se conserva; lo de las reglas se vuelve a leer (O6).
            const nueva = c.origen.tipo === 'manual' ? null : propuestaDe(s, chapterId, p);
            const base = nueva ?? c;
            const estado = estadoTrasConfirmar(base);
            p.pcc = { ...base, estado, ...(estado === 'confirmada' ? { huella: huellaDe(p) } : {}) };
            if (estado !== 'confirmada') delete p.pcc.huella;
            n += 1;
          }
        }
      }),
    );
    return n;
  },

  proponerControles: () => {
    let n = 0;
    structural(() =>
      set((s) => {
        n = proponerEn(s);
      }),
    );
    return n;
  },

  aplicarControlAHomonimos: (chapterId: string, partidaId: string) => {
    const origen = get().partidas[chapterId]?.find((x) => x.id === partidaId);
    if (!origen?.pcc || !origen.code) return 0;
    const pcc = origen.pcc;
    let n = 0;
    structural(() =>
      set((s) => {
        for (const ps of Object.values(s.partidas))
          for (const p of ps ?? []) {
            if (p.id === partidaId || p.code !== origen.code) continue;
            const c = structuredClone(pcc);
            // La huella es de cada partida: la suya, no la de la de origen.
            if (c.estado === 'confirmada') c.huella = huellaDe(p);
            p.pcc = c;
            n += 1;
          }
      }),
    );
    return n;
  },

  tomarPreciosPlan: (precios: Record<string, PrecioCopiado>) =>
    structural(() =>
      set((s) => {
        if (!s.planCalidad) return;
        s.planCalidad.precios = { ...(s.planCalidad.precios ?? {}), ...structuredClone(precios) };
      }),
    ),
});

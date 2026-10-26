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
import { rawUuid } from '../../core/id';
import { nextPos } from '../../core/numbering';
import type { PartidaControlPropuesta } from '../../core/pcc/capitulo';
import { capituloControlPropuesto, enCapituloControl, planVacio } from '../../core/pcc/datos';
import { estadoTrasConfirmar, huellaDe, necesitaRevision, proponerControl } from '../../core/pcc/reglas';
import type { ControlPartida, PlanCalidadDatos, PrecioCopiado } from '../../core/pcc/tipos';
import { nextPartidaCode } from '../../core/tree';
import type { Partida } from '../../core/types';
import { nextPartidaId } from '../base';
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
  | 'crearCapituloControl'
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

  crearCapituloControl: (propuestas: PartidaControlPropuesta[]) => {
    // Las partidas las propone la vista (`partidasControl`): así el store no carga el motor (P1).
    if (!get().planCalidad || !propuestas.length) return 0;
    structural(() =>
      set((s) => {
        const num = s.chapters.reduce((m, c) => Math.max(m, parseInt(c.code, 10) || 0), 0) + 1;
        const chapter = { id: `ch-${rawUuid()}`, code: String(num), title: 'Control de calidad', children: [] };
        s.chapters.push(chapter);
        s.partidas[chapter.id] = [];
        const usados = new Set(Object.values(s.partidas).flatMap((ps) => (ps ?? []).map((p) => p.code.trim().toUpperCase())));
        propuestas.forEach((x, i) => {
          // El código del banco si la obra no lo usa ya; si no, uno nuevo (A2).
          const banco = x.codigoBanco?.trim();
          const code = banco && !usados.has(banco.toUpperCase()) ? banco : nextPartidaCode(s.partidas);
          usados.add(code.toUpperCase());
          s.partidas[chapter.id]!.push({
            id: nextPartidaId(),
            pos: nextPos(chapter.code, i + 1),
            code,
            title: x.title,
            ud: x.ud,
            precio: x.precio,
            cantidad: x.cantidad,
            desc: x.desc,
            med: [],
            items: [],
            pcc: { estado: 'capituloControl', origen: { tipo: 'manual', motivo: 'Creada desde la valoración del plan' }, ensayo: x.ensayo },
          });
        });
        if (s.planCalidad) s.planCalidad.capituloControl = chapter.id;
      }),
    );
    return propuestas.length;
  },
});

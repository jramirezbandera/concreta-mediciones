/* ===========================================================================
   store/slices/rcdSlice — acciones del estudio de gestión de residuos (v7).
   Plan: docs/plan-estudio-residuos.md.

   · Cada acción es UN paso de Deshacer (`structural`): `partidas` y
     `estudioRcd` son claves de dominio.
   · Asignar residuo NO pasa por el copy-on-write ni quita la marca BASE: no
     cambia el precio ni la definición de la partida (plan §3).
   · Nada se confirma solo: las reglas dejan propuestas (D5).
   =========================================================================== */
import { rawUuid } from '../../core/id';
import { nextPos } from '../../core/numbering';
import { findNode, nextPartidaCode, subtreeIds } from '../../core/tree';
import type { Partida } from '../../core/types';
import { estudioVacio } from '../../core/rcd/datos';
import { nextPartidaId } from '../base';
import { estadoTrasConfirmar, huellaDe, necesitaRevision, proponerResiduo } from '../../core/rcd/reglas';
import type { PartidaGestionRcd } from '../../core/rcd/capitulo';
import type { EstudioRcdDatos, ResiduoPartida } from '../../core/rcd/tipos';
import type { ObraSlice, ObraState } from '../obraStore';
import { structural } from './estructuraSlice';

export interface RefPartidaRcd {
  chapterId: string;
  partidaId: string;
}

type RcdActions = Pick<
  ObraState,
  | 'iniciarEstudioRcd'
  | 'setEstudioRcd'
  | 'quitarEstudioRcd'
  | 'setResiduoPartida'
  | 'confirmarResiduos'
  | 'proponerResiduos'
  | 'aplicarResiduoAHomonimos'
  | 'crearCapituloGestionRcd'
>;

/** Capítulo de gestión que se propone al empezar: el que se llame así. */
export function capituloGestionPropuesto(s: Pick<ObraState, 'chapters'>): string | null {
  const re = /gesti[oó]n de residuos|\bresiduos\b|\brcds?\b/i;
  for (const ch of s.chapters) {
    if (re.test(ch.title)) return ch.id;
    const stack = [...(ch.children ?? [])];
    while (stack.length) {
      const sub = stack.shift()!;
      if (re.test(sub.title)) return sub.id;
      stack.push(...(sub.children ?? []));
    }
  }
  return null;
}

/** ¿La partida está en el capítulo (o subcapítulo) de gestión enlazado? */
export function enCapituloGestion(s: Pick<ObraState, 'chapters' | 'estudioRcd'>, chapterId: string, p: Pick<Partida, 'sub'>): boolean {
  const id = s.estudioRcd?.capituloGestion;
  if (!id) return false;
  const f = findNode(s.chapters, id);
  if (!f || f.chapter.id !== chapterId) return false;
  if (f.depth === 0) return true;
  return subtreeIds(f.node as Parameters<typeof subtreeIds>[0]).has(p.sub ?? chapterId);
}

/** Pone propuestas en las partidas sin asignar. Devuelve cuántas. */
function proponerEn(s: ObraState): number {
  let n = 0;
  for (const ch of s.chapters)
    for (const p of s.partidas[ch.id] ?? []) {
      if (p.rcd) continue;
      const r = proponerResiduo(p, enCapituloGestion(s, ch.id, p));
      if (r) {
        p.rcd = r;
        n += 1;
      }
    }
  return n;
}

export const createRcdSlice: ObraSlice<RcdActions> = (set, get) => ({
  iniciarEstudioRcd: () => {
    let n = 0;
    structural(() =>
      set((s) => {
        if (s.estudioRcd) return;
        s.estudioRcd = estudioVacio({ capituloGestion: capituloGestionPropuesto(s) });
        // Sin partidas fuera de la gestión (básico con solo los m²): la estimación
        // sale de los ratios de ECO-eficiencia, ya elegidos.
        const soloGestion = s.chapters.every((ch) => (s.partidas[ch.id] ?? []).every((p) => enCapituloGestion(s, ch.id, p)));
        if (soloGestion)
          Object.assign(s.estudioRcd, {
            fase: 'basico',
            tipos: ['nueva'],
            ratios: { metodo: 'ecoeficiencia', tabla: 'ecoeficiencia-2013', nivel: 'detallado', incluirTierras: true },
          } satisfies Partial<EstudioRcdDatos>);
        n = proponerEn(s);
      }),
    );
    return n;
  },

  setEstudioRcd: (patch: Partial<EstudioRcdDatos>) =>
    structural(() =>
      set((s) => {
        if (!s.estudioRcd) return;
        Object.assign(s.estudioRcd, patch);
      }),
    ),

  quitarEstudioRcd: () =>
    structural(() =>
      set((s) => {
        s.estudioRcd = undefined;
      }),
    ),

  setResiduoPartida: (chapterId: string, partidaId: string, rcd: ResiduoPartida | null) =>
    structural(() =>
      set((s) => {
        const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
        if (!p) return;
        if (rcd) p.rcd = rcd;
        else delete p.rcd;
      }),
    ),

  confirmarResiduos: (refs: RefPartidaRcd[]) => {
    let n = 0;
    structural(() =>
      set((s) => {
        for (const { chapterId, partidaId } of refs) {
          const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
          if (!p?.rcd) continue;
          // Una propuesta, o una confirmada cuya partida cambió (TD1): se confirma tal como está,
          // con la huella de hoy. Volver a leer las reglas es otra acción («Volver a proponer»),
          // para no perder lo que el técnico corrigió en los componentes.
          if (p.rcd.estado !== 'propuesta' && !necesitaRevision(p.rcd, p)) continue;
          p.rcd.estado = estadoTrasConfirmar(p.rcd);
          if (p.rcd.estado === 'confirmada') p.rcd.huella = huellaDe(p);
          else delete p.rcd.huella;
          n += 1;
        }
      }),
    );
    return n;
  },

  proponerResiduos: () => {
    let n = 0;
    structural(() =>
      set((s) => {
        n = proponerEn(s);
      }),
    );
    return n;
  },

  crearCapituloGestionRcd: (propuestas: PartidaGestionRcd[]) => {
    // Las partidas las propone la vista (`partidasGestion`): así el store no carga el motor.
    if (!get().estudioRcd || !propuestas.length) return 0;
    structural(() =>
      set((s) => {
        const num = s.chapters.reduce((m, c) => Math.max(m, parseInt(c.code, 10) || 0), 0) + 1;
        const chapter = { id: `ch-${rawUuid()}`, code: String(num), title: 'Gestión de residuos', children: [] };
        s.chapters.push(chapter);
        s.partidas[chapter.id] = [];
        propuestas.forEach((x, i) => {
          s.partidas[chapter.id]!.push({
            id: nextPartidaId(),
            pos: nextPos(chapter.code, i + 1),
            code: nextPartidaCode(s.partidas),
            title: x.title,
            ud: x.ud,
            precio: x.precio,
            cantidad: x.cantidad,
            desc: x.desc,
            med: [],
            items: [],
            rcd: { estado: 'gestion', origen: { tipo: 'manual', motivo: 'Creada desde la estimación del estudio' }, componentes: [], gestiona: structuredClone(x.gestiona) },
          });
        });
        if (s.estudioRcd) s.estudioRcd.capituloGestion = chapter.id;
      }),
    );
    return propuestas.length;
  },

  aplicarResiduoAHomonimos: (chapterId: string, partidaId: string) => {
    const origen = get().partidas[chapterId]?.find((x) => x.id === partidaId);
    if (!origen?.rcd || !origen.code) return 0;
    const rcd = origen.rcd;
    let n = 0;
    structural(() =>
      set((s) => {
        for (const ps of Object.values(s.partidas))
          for (const p of ps ?? []) {
            if (p.id === partidaId || p.code !== origen.code) continue;
            p.rcd = structuredClone(rcd);
            // La huella es de cada partida: la suya, no la de la de origen.
            if (p.rcd.huella) p.rcd.huella = huellaDe(p);
            n += 1;
          }
      }),
    );
    return n;
  },
});

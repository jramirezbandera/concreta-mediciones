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
import { estadoTrasConfirmar, proponerResiduo } from '../../core/rcd/reglas';
import type { EstudioRcdDatos, FilaCodigo, ResiduoPartida } from '../../core/rcd/tipos';
import type { ObraSlice, ObraState } from '../obraStore';
import { structural } from './estructuraSlice';

/** Lo que hace falta de cada código para crear su partida de gestión. */
export type FilaCapituloRcd = Pick<FilaCodigo, 'ler' | 'descripcion' | 'peligroso' | 't'>;

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
          if (!p?.rcd || p.rcd.estado !== 'propuesta') continue;
          p.rcd.estado = estadoTrasConfirmar(p.rcd);
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

  crearCapituloGestionRcd: (porCodigo: FilaCapituloRcd[]) => {
    // Las filas las da la vista (ya calculadas): así el store no carga el motor.
    if (!get().estudioRcd) return 0;
    const filas = porCodigo.filter((f) => f.t > 0);
    if (!filas.length) return 0;
    structural(() =>
      set((s) => {
        const num = s.chapters.reduce((m, c) => Math.max(m, parseInt(c.code, 10) || 0), 0) + 1;
        const chapter = { id: `ch-${rawUuid()}`, code: String(num), title: 'Gestión de residuos', children: [] };
        s.chapters.push(chapter);
        s.partidas[chapter.id] = [];
        filas.forEach((f, i) => {
          const precio = s.estudioRcd?.precios[f.ler]?.eurPorT ?? 0;
          s.partidas[chapter.id]!.push({
            id: nextPartidaId(),
            pos: nextPos(chapter.code, i + 1),
            code: nextPartidaCode(s.partidas),
            title: `Gestión de residuos: ${f.descripcion.length > 70 ? `${f.descripcion.slice(0, 68)}…` : f.descripcion} (${f.ler}${f.peligroso ? '*' : ''})`,
            ud: 't',
            precio,
            cantidad: Math.round(f.t * 1000) / 1000,
            desc: `Carga, transporte y entrega a gestor autorizado del residuo ${f.ler}${f.peligroso ? '*' : ''} estimado en el estudio de gestión de residuos, incluso canon de gestión y documentación de entrega.`,
            med: [],
            items: [],
            rcd: { estado: 'gestion', origen: { tipo: 'manual', motivo: 'Creada desde la estimación del estudio' }, componentes: [], gestiona: { codigos: [f.ler] } },
          });
        });
        if (s.estudioRcd) s.estudioRcd.capituloGestion = chapter.id;
      }),
    );
    return filas.length;
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
            n += 1;
          }
      }),
    );
    return n;
  },
});

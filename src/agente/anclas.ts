/* ===========================================================================
   agente/anclas — una operación con sus destinos fijados por id.
   ---------------------------------------------------------------------------
   (docs/plan-agente-carpeta.md D4, F4)

   El agente nombra las partidas por su número en el árbol («1.2.3») y las
   líneas por su número en la partida: valen en el momento de aplicar, no
   después. Para repetir un lote sobre OTRA versión de la obra (la del técnico,
   con sus cambios sin guardar), el diario guarda cada operación ANCLADA:

     · las partidas y los contenedores, por su id;
     · las líneas, por sus ids (`lineas`), que al repetir se vuelven a contar.

   Así, si el técnico ha metido una partida antes de la 1.2.3, la repetición va
   a la misma partida aunque ahora sea la 1.2.4. Si lo que tocaba ya no está
   (el técnico lo borró), `desanclar` lo dice y la repetición se para.
   =========================================================================== */
import { findNode, resolveContainerRef, resolvePartidaRef } from '../core/tree';
import type { ObraState } from '../store';
import type { OperacionAgente } from './operaciones';

/** Una operación lista para repetirse sobre otra versión de la obra. */
export interface Ancla {
  /** La operación, con las partidas y los contenedores por id. */
  op: OperacionAgente;
  /** Los ids de las líneas a las que apuntan `indice` o `indices`, en su orden. */
  lineas?: string[];
}

type St = Pick<ObraState, 'chapters' | 'partidas'>;

const idPartida = (st: St, ref: string): string =>
  resolvePartidaRef(st.partidas, ref)?.partida.id ?? ref;

const idContenedor = (st: St, ref: string): string =>
  (resolveContainerRef(st.chapters, ref) ?? findNode(st.chapters, ref.trim()))?.node.id ?? ref;

/** Fija por id los destinos de `op` en el estado `st` (el de justo antes de aplicarla). */
export function anclar(st: St, op: OperacionAgente): Ancla {
  switch (op.op) {
    case 'crear_subcapitulo':
      return { op: { ...op, padre: idContenedor(st, op.padre) } };
    case 'crear_partida':
      return { op: { ...op, capitulo: idContenedor(st, op.capitulo) } };
    case 'renombrar':
    case 'borrar_contenedor':
      return { op: { ...op, ref: idContenedor(st, op.ref) } };
    case 'certificar_100':
      return { op: op.ref && op.ambito !== 'obra' ? { ...op, ref: idContenedor(st, op.ref) } : op };
    case 'mover_partida':
      return {
        op: { ...op, ref: idPartida(st, op.ref), destino: idContenedor(st, op.destino) },
      };
    case 'editar_linea':
    case 'borrar_linea':
    case 'borrar_lineas': {
      const hit = resolvePartidaRef(st.partidas, op.ref);
      const indices = op.op === 'borrar_lineas' ? op.indices : [op.indice];
      const lineas = hit ? indices.map((i) => hit.partida.med[i - 1]?.id ?? '') : undefined;
      return { op: { ...op, ref: hit?.partida.id ?? op.ref }, ...(lineas ? { lineas } : {}) };
    }
    case 'agregar_lineas':
    case 'editar_partida':
    case 'set_precio':
    case 'set_cantidad':
    case 'certificar':
    case 'borrar_partida':
    case 'duplicar_partida':
      return { op: { ...op, ref: idPartida(st, op.ref) } };
    case 'crear_capitulo':
    case 'crear_certificacion':
    case 'set_porcentajes':
    case 'set_coef_k':
    case 'editar_obra':
      return { op };
  }
}

export type Desanclada = { ok: true; op: OperacionAgente } | { ok: false; motivo: string };

/** La operación de un ancla sobre el estado `st`, con las líneas contadas otra vez. */
export function desanclar(st: St, a: Ancla): Desanclada {
  const op = a.op;
  if (op.op !== 'editar_linea' && op.op !== 'borrar_linea' && op.op !== 'borrar_lineas')
    return { ok: true, op };
  if (!a.lineas) return { ok: true, op };
  const hit = resolvePartidaRef(st.partidas, op.ref);
  if (!hit) return { ok: true, op }; // el motor dirá que la partida no está
  const indices = a.lineas.map((id) => hit.partida.med.findIndex((l) => l.id === id) + 1);
  if (indices.some((i) => i === 0)) {
    return {
      ok: false,
      motivo: `una línea de la partida ${hit.partida.pos} que cambió Claude ya no está`,
    };
  }
  if (op.op === 'borrar_lineas') return { ok: true, op: { ...op, indices } };
  return { ok: true, op: { ...op, indice: indices[0]! } };
}

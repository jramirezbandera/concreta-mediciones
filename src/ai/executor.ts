/* ===========================================================================
   ai/executor — el corazón de F-A3: aplica las OPERACIONES sobre la obra.
   ---------------------------------------------------------------------------
   HEADLESS: lee el estado con `getState()` y muta SOLO llamando a acciones del
   store (nunca al DOM). Todo lo que pasa por esas acciones entra gratis en el undo
   global (`store/temporal`, ventana deslizante → un turno = UNA entrada) y en el
   autosave a IndexedDB.

   Garantías (revisión eng):
   · GATE de solo-lectura: si la pestaña es readonly, no muta NADA y lo explica.
   · SELLO de contexto (obraId + curCert): si la obra/cert cambió entre enviar y
     aplicar, no se aplica nada (una respuesta vieja no describe el estado de ahora).
   · TOPE de ~40 ops por turno; lo que exceda se anuncia, nunca se recorta callado.
   · OBRA VACÍA: si llega un `crear_partida` sin capítulos, crea el que falta y lo
     declara (T12: `copyTargetOf` devuelve `chId:''` y `addPartida` sería no-op).
   · POSTCONDICIONES: tras cada op se RELEE el estado y se confirma el efecto; las
     acciones del store son no-ops silenciosos (guardas `if(!p)return`, `setPrecio`
     ignora negativos). Una op sin efecto pasa a «omitida» con motivo — un informe
     que miente es peor que no tener informe.
   · DOS FASES para líneas: las refs/índices de las PROPUESTAS se resuelven a ids
     ESTABLES al planificar (`lineId`); al aplicar se reconvierte id→índice justo
     antes de la llamada. Así «borrar línea 2 + editar línea 3» en el mismo turno
     no se pisan tras el `splice` (regresión Issue 2).

   Clasificación (ver `./ops`): crear_* y agregar_lineas se aplican YA (directas);
   editar_*, borrar_* y set_* pasan por TARJETA (propuesta con diff) y se aplican
   al pulsar «Aplicar», revalidando el sello.
   =========================================================================== */
import { fmtEur, fmtNum, round2 } from '../core/money';
import { lineParcial } from '../core/medicion';
import { findNode, findPartidaById, resolveContainerRef, resolvePartidaRef } from '../core/tree';
import type { MedLine } from '../core/types';
import { getActiveObraId, useSessionStore } from '../persist';
import { copyTargetOf, useObraStore, type NewMedLine } from '../store';
import { isDirect, type LineaField, type Operation, type OpLinea, type PartidaField } from './ops';

/** Tope de operaciones aplicadas por turno; lo que exceda se anuncia (T15). */
export const MAX_OPS_PER_TURN = 40;

/** Sello de contexto: identifica CONTRA QUÉ se emitió una petición/propuesta. */
export interface Seal {
  obraId: string | null;
  curCert: number;
}

/** Sella el contexto vivo (obra activa + certificación en curso). */
export function currentSeal(): Seal {
  return { obraId: getActiveObraId(), curCert: useObraStore.getState().curCert };
}

function sealMatches(seal: Seal): boolean {
  const cur = currentSeal();
  return cur.obraId === seal.obraId && cur.curCert === seal.curCert;
}

/** Recibo de una op ya procesada: qué pasó, con qué destino, y por qué si falló. */
export interface OpReceipt {
  status: 'aplicada' | 'omitida' | 'no-encontrada';
  /** Destino/etiqueta ("Partida 1.2 · Excavación", "Capítulo «Albañilería»"). */
  label: string;
  /** Qué se hizo o se pretendía (lenguaje llano). */
  detail: string;
  /** Motivo, solo para omitida/no-encontrada. */
  reason?: string;
}

/** Una fila del diff de una propuesta (antes → después). */
export interface Diff {
  campo: string;
  antes: string;
  despues: string;
  /** true = borrado/destrucción → el rojo está permitido; si no, neutro→accent. */
  destructivo?: boolean;
}

/** Una operación con consecuencias, a confirmar en la tarjeta antes de aplicar. */
export interface Proposal {
  id: string;
  op: Operation;
  /** Destino legible ("Partida 1.2 · Excavación"). */
  target: string;
  diffs: Diff[];
  partidaId: string;
  chapterId: string;
  /** editar_linea/borrar_linea: id ESTABLE de la línea (fase 1); en aplicación se
   *  reconvierte a índice actual (dos fases, regresión Issue 2). */
  lineId?: string;
}

export interface PlanResult {
  /** Directas aplicadas ya (con su destino enumerado). */
  applied: OpReceipt[];
  /** Omitidas (índice fuera de rango, sin efecto, set_cantidad con medición…). */
  skipped: OpReceipt[];
  /** Refs sin resolver (partida/capítulo inexistente). */
  notFound: OpReceipt[];
  /** Propuestas para la tarjeta (editar / borrar / set_precio / set_cantidad). */
  proposals: Proposal[];
  /** Nº de ops por encima del tope, descartadas y anunciadas. */
  overflow: number;
  /** Título del capítulo creado para una obra vacía (T12), o null. */
  createdChapter: string | null;
  /** true si el gate de solo-lectura abortó todo. */
  readonlyBlocked: boolean;
  /** true si el sello cambió (obra/cert distinta al enviar). */
  sealChanged: boolean;
}

export interface ApplyResult {
  applied: OpReceipt[];
  skipped: OpReceipt[];
  notFound: OpReceipt[];
  readonlyBlocked: boolean;
  sealChanged: boolean;
}

/* ---- mapas op → store ------------------------------------------------------- */

const PARTIDA_FIELD: Record<PartidaField, 'title' | 'ud' | 'code' | 'desc'> = {
  titulo: 'title',
  ud: 'ud',
  codigo: 'code',
  descripcion: 'desc',
};
const PARTIDA_FIELD_LABEL: Record<PartidaField, string> = {
  titulo: 'Título',
  ud: 'Unidad',
  codigo: 'Código',
  descripcion: 'Descripción',
};
const LINEA_FIELD: Record<LineaField, keyof MedLine> = {
  comentario: 'comment',
  uds: 'uds',
  largo: 'largo',
  ancho: 'ancho',
  alto: 'alto',
};

/* ---- helpers de formato ----------------------------------------------------- */

function toNewMedLine(l: OpLinea): NewMedLine {
  const out: NewMedLine = {};
  if (typeof l.comentario === 'string') out.comment = l.comentario;
  if (typeof l.uds === 'number') out.uds = l.uds;
  if (typeof l.largo === 'number') out.largo = l.largo;
  if (typeof l.ancho === 'number') out.ancho = l.ancho;
  if (typeof l.alto === 'number') out.alto = l.alto;
  return out;
}

/** Descripción corta de una línea de medición para el diff ("2×3 = 6"). */
function describeLine(line: MedLine): string {
  const dims = [line.uds, line.largo, line.ancho, line.alto]
    .filter((d) => d !== '' && d != null)
    .map((d) => fmtNum(Number(d)));
  const body = dims.length ? `${dims.join('×')} = ${fmtNum(lineParcial(line))}` : fmtNum(lineParcial(line));
  return line.comment ? `${line.comment} · ${body}` : body;
}

/** Valor actual de un campo de línea, legible para el diff. */
function lineFieldStr(line: MedLine, campo: LineaField): string {
  const v = line[LINEA_FIELD[campo]];
  if (campo === 'comentario') return typeof v === 'string' && v !== '' ? v : '(vacío)';
  return v === '' || v == null ? '(vacío)' : fmtNum(Number(v));
}

function partidaLabel(pos: string, title: string): string {
  return `Partida ${pos} · ${title || '(sin título)'}`;
}

let proposalSeq = 0;

/* ---- planificación (aplica directas, recolecta propuestas) ------------------ */

/**
 * Procesa las ops de un turno: aplica las DIRECTAS ya (con postcondición) y deja
 * las de consecuencia como PROPUESTAS para la tarjeta. Comprueba antes el gate de
 * readonly y el sello; si fallan, no muta nada.
 */
export function planTurn(ops: Operation[], seal: Seal): PlanResult {
  const res: PlanResult = {
    applied: [],
    skipped: [],
    notFound: [],
    proposals: [],
    overflow: 0,
    createdChapter: null,
    readonlyBlocked: false,
    sealChanged: false,
  };

  if (useSessionStore.getState().readonly) {
    res.readonlyBlocked = true;
    return res;
  }
  if (!sealMatches(seal)) {
    res.sealChanged = true;
    return res;
  }

  // Tope de ops (cuenta ops, no partidas expandidas por un ámbito).
  res.overflow = Math.max(0, ops.length - MAX_OPS_PER_TURN);
  const capped = ops.slice(0, MAX_OPS_PER_TURN);

  ensureChapterForPartidas(capped, res);

  let lastCreated: { id: string; chapterId: string; subId: string | null } | null = null;

  for (const op of capped) {
    if (isDirect(op.op)) {
      const created = applyDirect(op, res);
      if (created) lastCreated = created;
    } else {
      planProposal(op, res);
    }
  }

  // Lleva al usuario a la última partida creada (salto + pulso). Solo toca UI, así
  // que no fragmenta el undo (no son claves de dominio).
  if (lastCreated) {
    useObraStore.getState().revealPartida(lastCreated.id, lastCreated.chapterId, lastCreated.subId);
  }

  return res;
}

/** Obra sin capítulos + algún `crear_partida` → crea el capítulo que falta (T12). */
function ensureChapterForPartidas(ops: Operation[], res: PlanResult): void {
  const st = useObraStore.getState();
  if (st.chapters.length > 0) return;
  if (!ops.some((o) => o.op === 'crear_partida')) return;
  const title = 'Capítulo 1';
  st.addChapter(title);
  res.createdChapter = title;
}

/** Aplica una op DIRECTA con postcondición. Devuelve la partida creada si la hubo
 *  (para el `revealPartida` final). */
function applyDirect(
  op: Operation,
  res: PlanResult,
): { id: string; chapterId: string; subId: string | null } | null {
  const st = useObraStore.getState();
  switch (op.op) {
    case 'crear_capitulo': {
      const before = st.chapters.length;
      st.addChapter(op.titulo);
      if (useObraStore.getState().chapters.length > before) {
        res.applied.push({ status: 'aplicada', label: `Capítulo «${op.titulo}»`, detail: 'capítulo creado' });
      } else {
        res.skipped.push({ status: 'omitida', label: `Capítulo «${op.titulo}»`, detail: 'crear capítulo', reason: 'no se pudo crear' });
      }
      return null;
    }
    case 'crear_subcapitulo': {
      const hit = resolveContainerRef(st.chapters, op.padre);
      if (!hit) {
        res.notFound.push({ status: 'no-encontrada', label: `Subcapítulo «${op.titulo}»`, detail: 'crear subcapítulo', reason: `no encuentro el contenedor «${op.padre}»` });
        return null;
      }
      const parentId = hit.node.id;
      const before = countChildren(parentId);
      st.addSubchapter(parentId, op.titulo);
      if (countChildren(parentId) > before) {
        res.applied.push({ status: 'aplicada', label: `Subcapítulo «${op.titulo}»`, detail: `bajo ${hit.node.code} ${hit.node.title}` });
      } else {
        res.skipped.push({ status: 'omitida', label: `Subcapítulo «${op.titulo}»`, detail: 'crear subcapítulo', reason: 'no se pudo crear' });
      }
      return null;
    }
    case 'crear_partida':
      return applyCrearPartida(op, res);
    case 'agregar_lineas': {
      const hit = resolvePartidaRef(st.partidas, op.ref);
      if (!hit) {
        res.notFound.push({ status: 'no-encontrada', label: `Partida ${op.ref}`, detail: 'añadir mediciones', reason: `no encuentro la partida ${op.ref}` });
        return null;
      }
      const before = hit.partida.med.length;
      st.addMedLines(hit.chapterId, hit.partida.id, op.lineas.map(toNewMedLine));
      const after = findPartidaById(useObraStore.getState().partidas, hit.partida.id)?.partida.med.length ?? before;
      const label = partidaLabel(hit.partida.pos, hit.partida.title);
      if (after > before) {
        res.applied.push({ status: 'aplicada', label, detail: `+${after - before} línea(s) de medición` });
      } else {
        res.skipped.push({ status: 'omitida', label, detail: 'añadir mediciones', reason: 'no se añadió ninguna línea' });
      }
      return null;
    }
    default:
      return null; // las de tarjeta no llegan aquí
  }
}

function applyCrearPartida(
  op: Extract<Operation, { op: 'crear_partida' }>,
  res: PlanResult,
): { id: string; chapterId: string; subId: string | null } | null {
  const st = useObraStore.getState();
  let chId: string;
  let subId: string | null;
  let contLabel: string;
  if (op.capitulo) {
    const hit = resolveContainerRef(st.chapters, op.capitulo);
    if (!hit) {
      res.notFound.push({ status: 'no-encontrada', label: `Partida «${op.titulo}»`, detail: 'crear partida', reason: `no encuentro el capítulo «${op.capitulo}»` });
      return null;
    }
    chId = hit.chapter.id;
    subId = hit.node === hit.chapter ? null : hit.node.id;
    contLabel = `${hit.node.code} ${hit.node.title}`;
  } else {
    const t = copyTargetOf(st.chapters, st.active);
    if (!t.chId) {
      res.skipped.push({ status: 'omitida', label: `Partida «${op.titulo}»`, detail: 'crear partida', reason: 'no hay ningún capítulo donde crearla' });
      return null;
    }
    chId = t.chId;
    subId = t.subId;
    contLabel = t.label;
  }

  const id = useObraStore.getState().createPartida(chId, subId);
  if (!id) {
    res.skipped.push({ status: 'omitida', label: `Partida «${op.titulo}»`, detail: 'crear partida', reason: 'el destino no admite partidas' });
    return null;
  }
  const store = useObraStore.getState();
  if (op.codigo) store.editPartidaField(chId, id, 'code', op.codigo);
  store.editPartidaField(chId, id, 'title', op.titulo);
  store.editPartidaField(chId, id, 'ud', op.ud);
  if (op.descripcion) store.editPartidaField(chId, id, 'desc', op.descripcion);
  if (op.precio !== undefined) store.setPrecio(chId, id, op.precio);
  if (op.lineas?.length) store.addMedLines(chId, id, op.lineas.map(toNewMedLine));

  const created = findPartidaById(useObraStore.getState().partidas, id)?.partida;
  const pos = created?.pos ?? '?';
  const bits = [`en ${contLabel}`];
  if (op.lineas?.length) bits.push(`${op.lineas.length} línea(s)`);
  if (op.precio !== undefined) bits.push(`${fmtEur(op.precio)}/${op.ud}`);
  res.applied.push({ status: 'aplicada', label: partidaLabel(pos, op.titulo), detail: bits.join(' · ') });
  return { id, chapterId: chId, subId };
}

/** Nº de hijos directos de un contenedor (para la postcondición de crear_subcapitulo). */
function countChildren(containerId: string): number {
  return findNode(useObraStore.getState().chapters, containerId)?.node.children?.length ?? 0;
}

/* ---- propuestas (fase 1: resolver refs a ids estables + diff) --------------- */

function planProposal(op: Operation, res: PlanResult): void {
  const st = useObraStore.getState();
  // Todas las de tarjeta llevan `ref` a una partida.
  const ref = 'ref' in op ? op.ref : '';
  const hit = resolvePartidaRef(st.partidas, ref);
  if (!hit) {
    res.notFound.push({ status: 'no-encontrada', label: `Partida ${ref}`, detail: describeOp(op), reason: `no encuentro la partida ${ref}` });
    return;
  }
  const p = hit.partida;
  const target = partidaLabel(p.pos, p.title);
  const base = { id: `prop-${++proposalSeq}`, op, target, partidaId: p.id, chapterId: hit.chapterId };

  switch (op.op) {
    case 'editar_partida': {
      const antes = String(p[PARTIDA_FIELD[op.campo]] ?? '');
      res.proposals.push({ ...base, diffs: [{ campo: PARTIDA_FIELD_LABEL[op.campo], antes: antes || '(vacío)', despues: op.valor }] });
      return;
    }
    case 'set_precio': {
      res.proposals.push({ ...base, diffs: [{ campo: 'Precio', antes: fmtEur(p.precio), despues: fmtEur(op.valor) }] });
      return;
    }
    case 'set_cantidad': {
      if (p.med.length > 0) {
        // T11: `partidaCantidad` toma la Σ de la medición, así que fijar la cantidad
        // se guardaría sin cambiar nada — un no-op disfrazado de éxito.
        res.skipped.push({ status: 'omitida', label: target, detail: 'fijar cantidad', reason: 'la partida tiene medición; su cantidad sale de las líneas' });
        return;
      }
      res.proposals.push({ ...base, diffs: [{ campo: 'Cantidad', antes: fmtNum(p.cantidad ?? 0), despues: fmtNum(op.valor) }] });
      return;
    }
    case 'editar_linea': {
      const line = p.med[op.indice - 1];
      if (!line) {
        res.skipped.push({ status: 'omitida', label: target, detail: `editar línea ${op.indice}`, reason: `la partida solo tiene ${p.med.length} línea(s)` });
        return;
      }
      res.proposals.push({
        ...base,
        lineId: line.id,
        diffs: [{ campo: `Línea ${op.indice} · ${op.campo}`, antes: lineFieldStr(line, op.campo), despues: String(op.valor) }],
      });
      return;
    }
    case 'borrar_linea': {
      const line = p.med[op.indice - 1];
      if (!line) {
        res.skipped.push({ status: 'omitida', label: target, detail: `borrar línea ${op.indice}`, reason: `la partida solo tiene ${p.med.length} línea(s)` });
        return;
      }
      res.proposals.push({
        ...base,
        lineId: line.id,
        diffs: [{ campo: `Línea ${op.indice}`, antes: describeLine(line), despues: '(eliminada)', destructivo: true }],
      });
      return;
    }
    default:
      return;
  }
}

/** Etiqueta corta de la acción de una op (para receipts de no-encontrada). */
function describeOp(op: Operation): string {
  switch (op.op) {
    case 'editar_partida':
      return `editar ${op.campo}`;
    case 'editar_linea':
      return `editar línea ${op.indice}`;
    case 'borrar_linea':
      return `borrar línea ${op.indice}`;
    case 'set_precio':
      return 'fijar precio';
    case 'set_cantidad':
      return 'fijar cantidad';
    default:
      return op.op;
  }
}

/* ---- aplicación de propuestas (fase 2: id→índice + postcondición) ----------- */

/**
 * Aplica las propuestas confirmadas en la tarjeta. Revalida readonly y sello (un
 * diff calculado hace minutos no describe lo que se muta ahora), reconvierte cada
 * `lineId` a su índice ACTUAL justo antes de llamar, y verifica postcondiciones.
 */
export function applyProposals(proposals: Proposal[], seal: Seal): ApplyResult {
  const res: ApplyResult = { applied: [], skipped: [], notFound: [], readonlyBlocked: false, sealChanged: false };
  if (useSessionStore.getState().readonly) {
    res.readonlyBlocked = true;
    return res;
  }
  if (!sealMatches(seal)) {
    res.sealChanged = true;
    return res;
  }
  for (const prop of proposals) applyOne(prop, res);
  return res;
}

function applyOne(prop: Proposal, res: ApplyResult): void {
  const op = prop.op;
  const hit = findPartidaById(useObraStore.getState().partidas, prop.partidaId);
  if (!hit) {
    res.notFound.push({ status: 'no-encontrada', label: prop.target, detail: describeOp(op), reason: 'la partida ya no existe' });
    return;
  }
  const st = useObraStore.getState();
  const p = hit.partida;

  switch (op.op) {
    case 'editar_partida': {
      const field = PARTIDA_FIELD[op.campo];
      st.editPartidaField(hit.chapterId, p.id, field, op.valor);
      const after = findPartidaById(useObraStore.getState().partidas, p.id)?.partida;
      if (after && String(after[field] ?? '') === op.valor) {
        res.applied.push({ status: 'aplicada', label: prop.target, detail: `${PARTIDA_FIELD_LABEL[op.campo]} → ${op.valor}` });
      } else {
        res.skipped.push({ status: 'omitida', label: prop.target, detail: `editar ${op.campo}`, reason: 'no cambió' });
      }
      return;
    }
    case 'set_precio': {
      st.setPrecio(hit.chapterId, p.id, op.valor);
      const after = findPartidaById(useObraStore.getState().partidas, p.id)?.partida.precio;
      if (after === op.valor) {
        res.applied.push({ status: 'aplicada', label: prop.target, detail: `precio → ${fmtEur(op.valor)}` });
      } else {
        res.skipped.push({ status: 'omitida', label: prop.target, detail: 'fijar precio', reason: 'el precio no era aplicable' });
      }
      return;
    }
    case 'set_cantidad': {
      if (p.med.length > 0) {
        res.skipped.push({ status: 'omitida', label: prop.target, detail: 'fijar cantidad', reason: 'la partida tiene medición' });
        return;
      }
      st.setCantidad(hit.chapterId, p.id, op.valor);
      const after = findPartidaById(useObraStore.getState().partidas, p.id)?.partida.cantidad;
      if (after === round2(op.valor)) {
        res.applied.push({ status: 'aplicada', label: prop.target, detail: `cantidad → ${fmtNum(op.valor)}` });
      } else {
        res.skipped.push({ status: 'omitida', label: prop.target, detail: 'fijar cantidad', reason: 'no cambió' });
      }
      return;
    }
    case 'editar_linea': {
      const index = p.med.findIndex((l) => l.id === prop.lineId);
      if (index < 0) {
        res.skipped.push({ status: 'omitida', label: prop.target, detail: `editar línea`, reason: 'la línea ya no existe' });
        return;
      }
      const value = op.campo === 'comentario' ? op.valor : (op.valor as number);
      st.editMedLine(hit.chapterId, p.id, index, LINEA_FIELD[op.campo], value as never);
      res.applied.push({ status: 'aplicada', label: prop.target, detail: `línea ${index + 1} · ${op.campo} → ${op.valor}` });
      return;
    }
    case 'borrar_linea': {
      const index = p.med.findIndex((l) => l.id === prop.lineId);
      if (index < 0) {
        res.skipped.push({ status: 'omitida', label: prop.target, detail: 'borrar línea', reason: 'la línea ya no existe' });
        return;
      }
      st.deleteMedLine(hit.chapterId, p.id, index);
      const gone = !findPartidaById(useObraStore.getState().partidas, p.id)?.partida.med.some((l) => l.id === prop.lineId);
      if (gone) {
        res.applied.push({ status: 'aplicada', label: prop.target, detail: `línea eliminada` });
      } else {
        res.skipped.push({ status: 'omitida', label: prop.target, detail: 'borrar línea', reason: 'no se eliminó' });
      }
      return;
    }
    default:
      return;
  }
}

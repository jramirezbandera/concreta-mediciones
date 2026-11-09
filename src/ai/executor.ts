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
import { fmtEur, fmtNum, round2, toEur, type Cents } from '../core/money';
import { lineParcial, partidaCantidad, partidaImporte } from '../core/medicion';
import { findNode, findPartidaById, resolveContainerRef, resolvePartidaRef, type FoundNode } from '../core/tree';
import type { MedLine, Partida } from '../core/types';
import { getActiveObraId, useSessionStore } from '../persist';
import { ALL, copyTargetOf, useObraStore, type ObraState } from '../store';
import {
  LINEA_FIELD,
  PARTIDA_FIELD,
  PARTIDA_FIELD_LABEL,
  agregarLineas,
  borrarLineaPorId,
  certResultOrigen,
  certificarPartida,
  completableIds,
  completarAl100,
  crearCapitulo,
  crearCertificacion,
  crearPartidaEn,
  crearSubcapitulo,
  editarCampoPartida,
  editarLineaPorId,
  fijarCantidad,
  fijarPrecio,
  partidaCertificada,
  partidaLabel,
  scopePartidas as scopeDelMotor,
  type OpReceipt,
  type Recibo,
} from '../agente/motor';
import { type LineaField, type Operation, type OpLinea } from './ops';

export type { OpReceipt } from '../agente/motor';

/** Los aplicadores del motor sobre el store de la app (docs/plan-agente-carpeta.md D2). */
const T = useObraStore;

/** El recibo del motor sin el id de lo creado (los recibos del asistente no lo llevan). */
function sinId(r: Recibo): OpReceipt {
  const rest: Recibo = { ...r };
  delete rest.id;
  return rest;
}

/** Mete un recibo en su lista según su estado. */
function anotar(r: Recibo, res: { applied: OpReceipt[]; skipped: OpReceipt[]; notFound?: OpReceipt[] }): void {
  const x = sinId(r);
  if (x.status === 'aplicada') res.applied.push(x);
  else if (x.status === 'no-encontrada' && res.notFound) res.notFound.push(x);
  else res.skipped.push(x);
}

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

/** Una fila del diff de una propuesta (antes → después). */
export interface Diff {
  campo: string;
  antes: string;
  despues: string;
  /** true = borrado/destrucción → el rojo está permitido; si no, neutro→accent. */
  destructivo?: boolean;
}

/** Certificación destino de una propuesta de cert (F-A4): se nombra en la tarjeta
 *  y avisa si ya se exportó (`firmado`), el riesgo real (aterrizar en la equivocada). */
export interface CertDest {
  num: number;
  period: string;
  firmado: boolean;
}

/** Resumen de un ámbito de `certificar_100`: recuento e importe afectado, con los
 *  ids ya resueltos (fase 1) y las etiquetas para el detalle desplegable. */
export interface ScopeInfo {
  ids: string[];
  count: number;
  importe: string;
  labels: string[];
}

/** Una operación con consecuencias, a confirmar en la tarjeta antes de aplicar. */
export interface Proposal {
  id: string;
  op: Operation;
  /** Destino legible ("Partida 1.2 · Excavación", "Capítulo 2 · Albañilería"). */
  target: string;
  diffs: Diff[];
  /** '' en ops de nivel cert/ámbito (certificar_100, crear_certificacion). */
  partidaId: string;
  chapterId: string;
  /** editar_linea/borrar_linea: id ESTABLE de la línea (fase 1); en aplicación se
   *  reconvierte a índice actual (dos fases, regresión Issue 2). */
  lineId?: string;
  /** Cert destino nombrada (ops de certificación): banner + aviso si `firmado`. */
  certDest?: CertDest;
  /** certificar_100: recuento/importe del ámbito (diff agregado en vez de por fila). */
  scope?: ScopeInfo;
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

/* ---- helpers de formato ----------------------------------------------------- */

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

function eur(c: Cents): string {
  return fmtEur(toEur(c));
}

/** Parcial de una línea cruda del modelo (dimensión ausente = factor 1). */
function opLineaParcial(l: OpLinea): number {
  return lineParcial({ uds: l.uds ?? '', largo: l.largo ?? '', ancho: l.ancho ?? '', alto: l.alto ?? '' });
}

/** Cert en curso como destino nombrado, o undefined si no hay ninguna. */
function currentCertDest(): CertDest | undefined {
  const st = useObraStore.getState();
  const cur = st.certs[st.curCert];
  return cur ? { num: cur.num, period: cur.period, firmado: !!cur.firmadoAt } : undefined;
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
    const created = dispatch(op, res);
    if (created) lastCreated = created;
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

/** Enruta cada op a su handler: crear_* directas, agregar_lineas condicional (cert),
 *  el resto (edición/precio/certificación) a tarjeta. Devuelve la partida creada. */
function dispatch(
  op: Operation,
  res: PlanResult,
): { id: string; chapterId: string; subId: string | null } | null {
  switch (op.op) {
    case 'crear_capitulo':
    case 'crear_subcapitulo':
    case 'crear_partida':
      return applyDirect(op, res);
    case 'agregar_lineas':
      planAgregarLineas(op, res);
      return null;
    case 'editar_partida':
    case 'editar_linea':
    case 'borrar_linea':
    case 'set_precio':
    case 'set_cantidad':
      planProposal(op, res);
      return null;
    case 'certificar':
      planCertificar(op, res);
      return null;
    case 'certificar_100':
      planCertificar100(op, res);
      return null;
    case 'crear_certificacion':
      planCrearCert(op, res);
      return null;
  }
}

/** Aplica una op DIRECTA (crear_*) con postcondición. Devuelve la partida creada
 *  si la hubo (para el `revealPartida` final). */
function applyDirect(
  op: Operation,
  res: PlanResult,
): { id: string; chapterId: string; subId: string | null } | null {
  const st = useObraStore.getState();
  switch (op.op) {
    case 'crear_capitulo':
      anotar(crearCapitulo(T, op.titulo), res);
      return null;
    case 'crear_subcapitulo': {
      const hit = resolveContainerRef(st.chapters, op.padre);
      if (!hit) {
        res.notFound.push({ status: 'no-encontrada', label: `Subcapítulo «${op.titulo}»`, detail: 'crear subcapítulo', reason: `no encuentro el contenedor «${op.padre}»` });
        return null;
      }
      anotar(crearSubcapitulo(T, hit, op.titulo), res);
      return null;
    }
    case 'crear_partida':
      return applyCrearPartida(op, res);
    default:
      return null; // agregar_lineas y las de tarjeta no llegan por aquí
  }
}

/**
 * `agregar_lineas`: DIRECTA salvo que la partida ya esté certificada (añadir
 * medición sube la ofertada y BAJA el % certificado en silencio → pasa a tarjeta,
 * mostrando el % antes/después). Ref inexistente → no-encontrada.
 */
function planAgregarLineas(op: Extract<Operation, { op: 'agregar_lineas' }>, res: PlanResult): void {
  const st = useObraStore.getState();
  const hit = resolvePartidaRef(st.partidas, op.ref);
  if (!hit) {
    res.notFound.push({ status: 'no-encontrada', label: `Partida ${op.ref}`, detail: 'añadir mediciones', reason: `no encuentro la partida ${op.ref}` });
    return;
  }
  const p = hit.partida;
  if (!partidaCertificada(st, p.id)) {
    anotar(agregarLineas(T, hit.chapterId, p.id, p.pos, p.title, op.lineas), res);
    return;
  }
  // Certificada: propuesta con el % certificado antes/después (por cada cert que la tiene).
  const added = op.lineas.reduce((s, l) => s + opLineaParcial(l), 0);
  const ofertadaAntes = partidaCantidad(p);
  const ofertadaDespues = round2(ofertadaAntes + added);
  const cur = st.certs[st.curCert];
  const cert = cur?.data[p.id] ?? 0;
  const pct = (of: number) => (of > 0 ? `${Math.round((cert / of) * 100)}%` : '—');
  res.proposals.push({
    id: `prop-${++proposalSeq}`,
    op,
    target: partidaLabel(p.pos, p.title),
    partidaId: p.id,
    chapterId: hit.chapterId,
    certDest: currentCertDest(),
    diffs: [
      { campo: `Ofertada (${p.ud})`, antes: fmtNum(ofertadaAntes), despues: fmtNum(ofertadaDespues) },
      { campo: '% certificado', antes: pct(ofertadaAntes), despues: pct(ofertadaDespues) },
    ],
  });
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

  const r = crearPartidaEn(T, chId, subId, contLabel, op);
  anotar(r, res);
  return r.id ? { id: r.id, chapterId: chId, subId } : null;
}

/* ---- propuestas (fase 1: resolver refs a ids estables + diff) --------------- */

type PartidaTarjetaOp = Extract<
  Operation,
  { op: 'editar_partida' | 'editar_linea' | 'borrar_linea' | 'set_precio' | 'set_cantidad' }
>;

function planProposal(op: PartidaTarjetaOp, res: PlanResult): void {
  const st = useObraStore.getState();
  // Todas estas ops llevan `ref` a una partida.
  const ref = op.ref;
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
    case 'certificar':
      return 'certificar';
    default:
      return op.op;
  }
}

/* ---- propuestas de CERTIFICACIÓN (F-A4, siempre tarjeta) -------------------- */

/** Contenedor resuelto para un ámbito de cert: por `ref` (código) o, si no, por el
 *  contenedor ACTIVO (id). null si nada resuelve. */
function resolveScopeContainer(st: ObraState, ref?: string): FoundNode | null {
  if (ref) return resolveContainerRef(st.chapters, ref);
  return st.active !== ALL ? findNode(st.chapters, st.active) : null;
}

/** Partidas de un ámbito + su etiqueta. `found:false` = el contenedor no existe.
 *  `visible` es el contenedor activo (o toda la obra si no hay ninguno). */
function scopePartidas(
  st: ObraState,
  ambito: 'obra' | 'capitulo' | 'subarbol' | 'visible',
  ref?: string,
): { ps: Partida[]; label: string; found: boolean } {
  if (ambito === 'obra') return scopeDelMotor(st, 'obra', null);
  const hit = ambito === 'visible' ? resolveScopeContainer(st) : resolveScopeContainer(st, ref);
  if (!hit && ambito === 'visible') return scopeDelMotor(st, 'obra', null);
  return scopeDelMotor(st, ambito === 'visible' ? 'subarbol' : ambito, hit);
}

function planCertificar(op: Extract<Operation, { op: 'certificar' }>, res: PlanResult): void {
  const st = useObraStore.getState();
  const hit = resolvePartidaRef(st.partidas, op.ref);
  if (!hit) {
    res.notFound.push({ status: 'no-encontrada', label: `Partida ${op.ref}`, detail: 'certificar', reason: `no encuentro la partida ${op.ref}` });
    return;
  }
  const cur = st.certs[st.curCert];
  if (!cur) {
    res.skipped.push({ status: 'omitida', label: partidaLabel(hit.partida.pos, hit.partida.title), detail: 'certificar', reason: 'no hay ninguna certificación en curso' });
    return;
  }
  const p = hit.partida;
  const ofertada = partidaCantidad(p);
  const pct = (q: number): string => (ofertada > 0 ? `${Math.round((q / ofertada) * 100)}%` : '—');
  const antes = cur.data[p.id] ?? 0;
  const despues = certResultOrigen(st, op, p.id);
  res.proposals.push({
    id: `prop-${++proposalSeq}`,
    op,
    target: partidaLabel(p.pos, p.title),
    partidaId: p.id,
    chapterId: hit.chapterId,
    certDest: currentCertDest(),
    diffs: [{ campo: `Certificado a origen (${p.ud})`, antes: `${fmtNum(antes)} (${pct(antes)})`, despues: `${fmtNum(despues)} (${pct(despues)})` }],
  });
}

function planCertificar100(op: Extract<Operation, { op: 'certificar_100' }>, res: PlanResult): void {
  const st = useObraStore.getState();
  const cur = st.certs[st.curCert];
  if (!cur) {
    res.skipped.push({ status: 'omitida', label: 'Certificar al 100%', detail: 'certificar', reason: 'no hay ninguna certificación en curso' });
    return;
  }
  const { ps, label, found } = scopePartidas(st, op.ambito, op.ref);
  if (!found) {
    res.notFound.push({ status: 'no-encontrada', label: 'Certificar al 100%', detail: 'certificar', reason: `no encuentro el contenedor «${op.ref ?? ''}»` });
    return;
  }
  const ids = completableIds(ps, cur.data);
  if (ids.length === 0) {
    res.skipped.push({ status: 'omitida', label, detail: 'certificar al 100%', reason: 'ya está todo certificado al 100% (o sin partidas)' });
    return;
  }
  const coefK = st.rates.coefK;
  const idSet = new Set(ids);
  const affected = ps.filter((p) => idSet.has(p.id));
  const importe = affected.reduce((s, p) => s + partidaImporte(p, coefK), 0);
  res.proposals.push({
    id: `prop-${++proposalSeq}`,
    op,
    target: label,
    partidaId: '',
    chapterId: '',
    diffs: [],
    certDest: currentCertDest(),
    scope: { ids, count: ids.length, importe: eur(importe), labels: affected.map((p) => partidaLabel(p.pos, p.title)) },
  });
}

function planCrearCert(op: Extract<Operation, { op: 'crear_certificacion' }>, res: PlanResult): void {
  const st = useObraStore.getState();
  const cur = st.certs[st.curCert];
  const nextNum = (st.certs.at(-1)?.num ?? 0) + 1;
  res.proposals.push({
    id: `prop-${++proposalSeq}`,
    op,
    target: 'Nueva certificación',
    partidaId: '',
    chapterId: '',
    diffs: [
      { campo: 'Certificación', antes: cur ? `nº ${cur.num}` : '—', despues: `nº ${nextNum}${op.periodo ? ` · ${op.periodo}` : ''} (nueva)` },
    ],
  });
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
  // Ops de NIVEL CERT/ÁMBITO: no cuelgan de una partida concreta.
  if (op.op === 'certificar_100') return applyCertificar100(prop, op, res);
  if (op.op === 'crear_certificacion') return applyCrearCert(prop, op, res);

  const hit = findPartidaById(useObraStore.getState().partidas, prop.partidaId);
  if (!hit) {
    res.notFound.push({ status: 'no-encontrada', label: prop.target, detail: describeOp(op), reason: 'la partida ya no existe' });
    return;
  }
  const p = hit.partida;
  const label = prop.target;

  switch (op.op) {
    case 'agregar_lineas':
      anotar(agregarLineas(T, hit.chapterId, p.id, p.pos, p.title, op.lineas), res);
      return;
    case 'certificar':
      anotar(certificarPartida(T, hit, op, label), res);
      return;
    case 'editar_partida':
      anotar(editarCampoPartida(T, hit, op.campo, op.valor, label), res);
      return;
    case 'set_precio':
      anotar(fijarPrecio(T, hit, op.valor, label), res);
      return;
    case 'set_cantidad':
      anotar(fijarCantidad(T, hit, op.valor, label), res);
      return;
    case 'editar_linea':
      anotar(editarLineaPorId(T, hit, prop.lineId, op.campo, op.valor, label), res);
      return;
    case 'borrar_linea':
      // Sin la guarda de líneas certificadas de la UI (plan de líneas de
      // medición): aquí la confirmación es aprobar la propuesta en PropuestaCard.
      anotar(borrarLineaPorId(T, hit, prop.lineId, label), res);
      return;
    default:
      return;
  }
}

/** Aplica `certificar_100`: completa el ámbito ya resuelto (ids de fase 1) en UN
 *  solo `set` (`completePartidas`) y verifica cuántas quedaron registradas. */
function applyCertificar100(prop: Proposal, _op: Extract<Operation, { op: 'certificar_100' }>, res: ApplyResult): void {
  anotar(completarAl100(T, prop.scope?.ids ?? [], prop.target, prop.scope?.importe ?? ''), res);
}

/** Aplica `crear_certificacion`: crea la cert (la deja en curso) y fija su periodo. */
function applyCrearCert(_prop: Proposal, op: Extract<Operation, { op: 'crear_certificacion' }>, res: ApplyResult): void {
  anotar(crearCertificacion(T, op.periodo), res);
}

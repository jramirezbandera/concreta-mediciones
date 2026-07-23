/* ===========================================================================
   ai/validate — parseo defensivo del envelope de respuesta del modelo.
   ---------------------------------------------------------------------------
   El structured output DEBERÍA garantizar la forma `{reply, ops}`, pero el parseo
   es defensivo igualmente: un modelo pequeño puede devolver JSON válido con una op
   incompleta o con un campo de más. Aquí se NARROWEA cada op a su forma tipada
   (`Operation`, ver ./ops); las que no encajan se DESCARTAN con un motivo legible
   (nunca en silencio: el motivo llega al informe del turno).

   La validación es de FORMA (campos presentes y bien tipados), no de dominio: si
   la partida referida existe, si el precio es aplicable, etc., lo decide el
   executor releyendo el estado.
   =========================================================================== */
import {
  LINEA_DIMS,
  LINEA_FIELDS,
  OP_KINDS,
  PARTIDA_FIELDS,
  type LineaField,
  type OpKind,
  type OpLinea,
  type Operation,
  type PartidaField,
} from './ops';
import { AiError } from './types';

/** Op que el modelo emitió pero no encaja en el catálogo: se descarta con motivo. */
export interface DiscardedOp {
  /** El `op` crudo si era legible (para el informe), o '(desconocida)'. */
  op: string;
  reason: string;
}

export interface ChatEnvelope {
  reply: string;
  /** Ops válidas y narrowed; null cuando el modelo no devolvió `ops` (turno de consulta). */
  ops: Operation[] | null;
  /** Ops descartadas por mal formadas, con su motivo (para el informe). */
  discarded: DiscardedOp[];
}

/* ---- helpers de campo -------------------------------------------------------- */

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
/** Índice 1-based: entero ≥ 1. */
function idx(v: unknown): number | undefined {
  const n = num(v);
  return n !== undefined && Number.isInteger(n) && n >= 1 ? n : undefined;
}

/**
 * Normaliza una línea cruda a `OpLinea` limpia: `comentario` string (o ausente),
 * dimensiones numéricas (no finitas/ausentes → ausente = factor 1). Un objeto sin
 * ningún campo útil devuelve `{}` (línea de factor 1, válida). No-objeto → null.
 */
function normalizeLinea(raw: unknown): OpLinea | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const linea: OpLinea = {};
  const c = str(o.comentario);
  if (c !== undefined) linea.comentario = c;
  for (const d of LINEA_DIMS) {
    const n = num(o[d]);
    if (n !== undefined) linea[d] = n;
  }
  return linea;
}

/** Normaliza un array de líneas; descarta las no-objeto. */
function normalizeLineas(raw: unknown): OpLinea[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeLinea).filter((l): l is OpLinea => l !== null);
}

function isOpKind(v: unknown): v is OpKind {
  return typeof v === 'string' && (OP_KINDS as readonly string[]).includes(v);
}

/**
 * Narrowea UNA op cruda a `Operation`, o lanza el motivo (string) por el que se
 * descarta. El discriminante `op` ya está validado por el llamador.
 */
function narrowOp(op: OpKind, o: Record<string, unknown>): Operation {
  switch (op) {
    case 'crear_capitulo': {
      const titulo = str(o.titulo);
      if (!titulo) throw 'falta el título del capítulo';
      return { op, titulo };
    }
    case 'crear_subcapitulo': {
      const padre = str(o.padre);
      const titulo = str(o.titulo);
      if (!padre) throw 'falta el capítulo/subcapítulo padre';
      if (!titulo) throw 'falta el título del subcapítulo';
      return { op, padre, titulo };
    }
    case 'crear_partida': {
      const titulo = str(o.titulo);
      const ud = str(o.ud);
      if (!titulo) throw 'falta el título de la partida';
      if (!ud) throw 'falta la unidad (ud) de la partida';
      const out: Extract<Operation, { op: 'crear_partida' }> = { op, titulo, ud };
      const capitulo = str(o.capitulo);
      if (capitulo) out.capitulo = capitulo;
      const codigo = str(o.codigo);
      if (codigo) out.codigo = codigo;
      const precio = num(o.precio);
      if (precio !== undefined && precio >= 0) out.precio = precio;
      const descripcion = str(o.descripcion);
      if (descripcion) out.descripcion = descripcion;
      const lineas = normalizeLineas(o.lineas);
      if (lineas.length) out.lineas = lineas;
      return out;
    }
    case 'agregar_lineas': {
      const ref = str(o.ref);
      if (!ref) throw 'falta la referencia (posición) de la partida';
      const lineas = normalizeLineas(o.lineas);
      if (!lineas.length) throw 'no trae ninguna línea de medición';
      return { op, ref, lineas };
    }
    case 'editar_partida': {
      const ref = str(o.ref);
      const campo = o.campo;
      const valor = str(o.valor);
      if (!ref) throw 'falta la referencia (posición) de la partida';
      if (!(PARTIDA_FIELDS as readonly unknown[]).includes(campo)) throw `campo "${String(campo)}" no editable en una partida`;
      if (valor === undefined) throw 'falta el valor nuevo';
      return { op, ref, campo: campo as PartidaField, valor };
    }
    case 'editar_linea': {
      const ref = str(o.ref);
      const indice = idx(o.indice);
      const campo = o.campo;
      if (!ref) throw 'falta la referencia (posición) de la partida';
      if (indice === undefined) throw 'falta el índice de línea (1 = primera)';
      if (!(LINEA_FIELDS as readonly unknown[]).includes(campo)) throw `campo "${String(campo)}" no editable en una línea`;
      const cf = campo as LineaField;
      // comentario → string; dimensiones → número.
      if (cf === 'comentario') {
        const valor = typeof o.valor === 'string' ? o.valor : undefined;
        if (valor === undefined) throw 'falta el comentario nuevo';
        return { op, ref, indice, campo: cf, valor };
      }
      const valor = num(o.valor);
      if (valor === undefined || valor < 0) throw 'el valor de la dimensión no es un número válido';
      return { op, ref, indice, campo: cf, valor };
    }
    case 'borrar_linea': {
      const ref = str(o.ref);
      const indice = idx(o.indice);
      if (!ref) throw 'falta la referencia (posición) de la partida';
      if (indice === undefined) throw 'falta el índice de línea (1 = primera)';
      return { op, ref, indice };
    }
    case 'set_precio': {
      const ref = str(o.ref);
      const valor = num(o.valor);
      if (!ref) throw 'falta la referencia (posición) de la partida';
      if (valor === undefined || valor < 0) throw 'el precio no es un número válido';
      return { op, ref, valor };
    }
    case 'set_cantidad': {
      const ref = str(o.ref);
      const valor = num(o.valor);
      if (!ref) throw 'falta la referencia (posición) de la partida';
      if (valor === undefined || valor < 0) throw 'la cantidad no es un número válido';
      return { op, ref, valor };
    }
  }
}

/** Parsea el array crudo de ops en {válidas, descartadas}. */
function parseOps(raw: unknown[]): { ops: Operation[]; discarded: DiscardedOp[] } {
  const ops: Operation[] = [];
  const discarded: DiscardedOp[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      discarded.push({ op: '(desconocida)', reason: 'no es un objeto' });
      continue;
    }
    const o = item as Record<string, unknown>;
    if (!isOpKind(o.op)) {
      discarded.push({ op: String(o.op ?? '(sin op)'), reason: 'tipo de operación desconocido' });
      continue;
    }
    try {
      ops.push(narrowOp(o.op, o));
    } catch (reason) {
      discarded.push({ op: o.op, reason: typeof reason === 'string' ? reason : 'formato inesperado' });
    }
  }
  return { ops, discarded };
}

/**
 * `unknown` (JSON ya parseado por el proveedor) → `{reply, ops, discarded}`.
 * Lanza AiError('bad-response') si no hay un `reply` string usable. `ops` puede
 * ser null (turno de consulta), un array vacío (todas descartadas) o Operation[].
 */
export function parseChatEnvelope(raw: unknown): ChatEnvelope {
  if (typeof raw !== 'object' || raw === null) {
    throw new AiError('bad-response', 'La respuesta del asistente no tiene el formato esperado.');
  }
  const obj = raw as Record<string, unknown>;
  const reply = obj.reply;
  if (typeof reply !== 'string' || reply.trim() === '') {
    throw new AiError('bad-response', 'El asistente no devolvió una respuesta legible.');
  }
  if (obj.ops == null) return { reply, ops: null, discarded: [] };
  if (!Array.isArray(obj.ops)) {
    // `ops` presente pero no-array: forma inesperada → se ignora, no muta nada.
    return { reply, ops: null, discarded: [{ op: '(desconocida)', reason: '`ops` no es una lista' }] };
  }
  const { ops, discarded } = parseOps(obj.ops);
  return { reply, ops, discarded };
}

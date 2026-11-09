/* ===========================================================================
   agente/operaciones — catálogo de OPERACIONES del agente (MCP, CLI).
   ---------------------------------------------------------------------------
   Superconjunto de las del asistente de la app (`ai/ops`): las mismas doce, con
   los mismos nombres y campos, más las que necesita quien monta un presupuesto
   entero desde fuera (renombrar, mover, duplicar y borrar, porcentajes, K y la
   ficha). Las que se añadan aquí se pueden pasar luego al catálogo de la app.

   Diferencias con el asistente de la app (docs/plan-agente-carpeta.md §7):
     · La validación es ESTRICTA: una op mal formada rechaza el lote entero con
       su motivo (el asistente, en cambio, normaliza y descarta lo que le manda
       un modelo pequeño). Aquí quien llama es un agente con herramientas tipadas.
     · Tocar una partida CERTIFICADA (su medición, su cantidad o borrarla) exige
       `forzar: true`: el técnico tiene que haberlo pedido.
     · Sin «contenedor activo»: `crear_partida` dice su capítulo.
   =========================================================================== */
import {
  CERT_AMBITOS,
  CERT_MODOS,
  LINEA_FIELDS,
  OP_KINDS,
  PARTIDA_FIELDS,
  type CertAmbito,
  type CertModo,
  type LineaField,
  type OpLinea,
  type PartidaField,
} from '../ai/ops';

/** Campos de la ficha de la obra que puede cambiar `editar_obra`: los de «Datos
 *  de la obra» (`features/obra/ObraModal`), los del edificio y las notas. */
export const CAMPOS_OBRA_TEXTO = [
  'denominacion',
  'direccion',
  'localidad',
  'provincia',
  'refCatastral',
  'expediente',
  'notes',
  'promotor.nombre',
  'promotor.nif',
  'promotor.telefono',
  'promotor.email',
  'promotor.direccion',
  'constructor.nombre',
  'constructor.cif',
  'constructor.jefe',
  'constructor.telefono',
  'constructor.direccion',
] as const;
export const CAMPOS_OBRA_NUMERO = [
  'superficieConstruida',
  'plantasSobreRasante',
  'plantasBajoRasante',
] as const;
export type CampoObra = (typeof CAMPOS_OBRA_TEXTO)[number] | (typeof CAMPOS_OBRA_NUMERO)[number];

/** Operaciones propias del agente (las de la app están en `ai/ops`). */
export const OP_KINDS_AGENTE = [
  'renombrar',
  'borrar_contenedor',
  'borrar_partida',
  'duplicar_partida',
  'mover_partida',
  'borrar_lineas',
  'set_porcentajes',
  'set_coef_k',
  'editar_obra',
] as const;

export const TODAS_LAS_OPS = [...OP_KINDS, ...OP_KINDS_AGENTE] as const;
export type OpAgenteKind = (typeof TODAS_LAS_OPS)[number];

/**
 * Una operación del agente, ya validada. Las referencias:
 *   · a una PARTIDA (`ref`): su número en el árbol («1.2.3», `pos`) o su id;
 *   · a un CONTENEDOR (`capitulo`, `padre`, `destino`, `ref` de renombrar o
 *     borrar_contenedor): su código («2», «2.1»), su título exacto o su id;
 *   · a una LÍNEA (`indice`, `indices`): su número en la partida, desde 1, en
 *     el momento de aplicar la op (las ops de un lote van en orden).
 */
export type OperacionAgente =
  | { op: 'crear_capitulo'; titulo: string }
  | { op: 'crear_subcapitulo'; padre: string; titulo: string }
  | {
      op: 'crear_partida';
      capitulo: string;
      codigo?: string;
      titulo: string;
      ud: string;
      precio?: number;
      descripcion?: string;
      lineas?: OpLinea[];
    }
  | { op: 'agregar_lineas'; ref: string; lineas: OpLinea[]; forzar?: boolean }
  | { op: 'editar_partida'; ref: string; campo: PartidaField; valor: string }
  | {
      op: 'editar_linea';
      ref: string;
      indice: number;
      campo: LineaField;
      valor: string | number;
      forzar?: boolean;
    }
  | { op: 'borrar_linea'; ref: string; indice: number; forzar?: boolean }
  | { op: 'set_precio'; ref: string; valor: number }
  | { op: 'set_cantidad'; ref: string; valor: number; forzar?: boolean }
  | { op: 'certificar'; ref: string; valor: number; modo: CertModo }
  | { op: 'certificar_100'; ambito: Exclude<CertAmbito, 'visible'>; ref?: string }
  | { op: 'crear_certificacion'; periodo?: string }
  | { op: 'renombrar'; ref: string; titulo: string }
  | { op: 'borrar_contenedor'; ref: string }
  | { op: 'borrar_partida'; ref: string; forzar?: boolean }
  | { op: 'duplicar_partida'; ref: string }
  | { op: 'mover_partida'; ref: string; destino: string }
  | { op: 'borrar_lineas'; ref: string; indices: number[]; forzar?: boolean }
  | { op: 'set_porcentajes'; gg?: number; bi?: number; iva?: number; ci?: number }
  | { op: 'set_coef_k'; valor: number }
  | { op: 'editar_obra'; campo: CampoObra; valor: string | number | null };

/** Error de forma de una op del lote: cuál (desde 0) y por qué. */
export interface ErrorForma {
  indice: number;
  op: string;
  mensaje: string;
}

export type LecturaOps =
  | { ok: true; ops: OperacionAgente[] }
  | { ok: false; errores: ErrorForma[] };

/* ---- validación estricta --------------------------------------------------- */

class Forma extends Error {}

type Obj = Record<string, unknown>;

const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);

function texto(o: Obj, k: string, opcional = false): string | undefined {
  const v = o[k];
  if (v === undefined || v === null) {
    if (opcional) return undefined;
    throw new Forma(`falta «${k}»`);
  }
  if (typeof v !== 'string') throw new Forma(`«${k}» tiene que ser un texto`);
  if (!opcional && !v.trim()) throw new Forma(`«${k}» está vacío`);
  return v;
}

function numero(o: Obj, k: string, opcional = false): number | undefined {
  const v = o[k];
  if (v === undefined || v === null) {
    if (opcional) return undefined;
    throw new Forma(`falta «${k}»`);
  }
  if (typeof v !== 'number' || !Number.isFinite(v))
    throw new Forma(`«${k}» tiene que ser un número`);
  return v;
}

function entero(o: Obj, k: string): number {
  const v = numero(o, k)!;
  if (!Number.isInteger(v) || v < 1) throw new Forma(`«${k}» tiene que ser un entero desde 1`);
  return v;
}

function booleano(o: Obj, k: string): boolean | undefined {
  const v = o[k];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'boolean') throw new Forma(`«${k}» tiene que ser true o false`);
  return v;
}

function uno<T extends string>(o: Obj, k: string, valores: readonly T[]): T {
  const v = o[k];
  if (typeof v !== 'string' || !(valores as readonly string[]).includes(v)) {
    throw new Forma(`«${k}» tiene que ser uno de: ${valores.join(', ')}`);
  }
  return v as T;
}

function lineas(o: Obj, k: string, opcional = false): OpLinea[] | undefined {
  const v = o[k];
  if (v === undefined || v === null) {
    if (opcional) return undefined;
    throw new Forma(`falta «${k}»`);
  }
  if (!Array.isArray(v) || v.length === 0)
    throw new Forma(`«${k}» tiene que ser una lista de líneas no vacía`);
  return v.map((l, i) => {
    if (!isObj(l)) throw new Forma(`la línea ${i + 1} no es un objeto`);
    const out: OpLinea = {};
    for (const key of Object.keys(l)) {
      if (!['comentario', 'uds', 'largo', 'ancho', 'alto'].includes(key)) {
        throw new Forma(
          `la línea ${i + 1} tiene un campo que no existe: «${key}» (son comentario, uds, largo, ancho y alto)`,
        );
      }
    }
    const c = texto(l, 'comentario', true);
    if (c !== undefined) out.comentario = c;
    for (const d of ['uds', 'largo', 'ancho', 'alto'] as const) {
      const n = numero(l, d, true);
      if (n !== undefined) out[d] = n;
    }
    return out;
  });
}

/** Los campos que admite cada op: uno de más es un error (el agente lo escribió
 *  mal, y callarlo sería aplicar otra cosa de la que pidió). */
const CAMPOS: Record<OpAgenteKind, readonly string[]> = {
  crear_capitulo: ['titulo'],
  crear_subcapitulo: ['padre', 'titulo'],
  crear_partida: ['capitulo', 'codigo', 'titulo', 'ud', 'precio', 'descripcion', 'lineas'],
  agregar_lineas: ['ref', 'lineas', 'forzar'],
  editar_partida: ['ref', 'campo', 'valor'],
  editar_linea: ['ref', 'indice', 'campo', 'valor', 'forzar'],
  borrar_linea: ['ref', 'indice', 'forzar'],
  set_precio: ['ref', 'valor'],
  set_cantidad: ['ref', 'valor', 'forzar'],
  certificar: ['ref', 'valor', 'modo'],
  certificar_100: ['ambito', 'ref'],
  crear_certificacion: ['periodo'],
  renombrar: ['ref', 'titulo'],
  borrar_contenedor: ['ref'],
  borrar_partida: ['ref', 'forzar'],
  duplicar_partida: ['ref'],
  mover_partida: ['ref', 'destino'],
  borrar_lineas: ['ref', 'indices', 'forzar'],
  set_porcentajes: ['gg', 'bi', 'iva', 'ci'],
  set_coef_k: ['valor'],
  editar_obra: ['campo', 'valor'],
};

/** Copia `o` sin las claves `undefined` (los opcionales que no vinieron). */
function limpio<T extends Obj>(o: T): T {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
  return o;
}

function leerUna(raw: unknown): OperacionAgente {
  if (!isObj(raw)) throw new Forma('no es un objeto');
  const kind = raw.op;
  if (typeof kind !== 'string' || !(TODAS_LAS_OPS as readonly string[]).includes(kind)) {
    throw new Forma(`«op» no es una operación conocida (son: ${TODAS_LAS_OPS.join(', ')})`);
  }
  const op = kind as OpAgenteKind;
  const permitidos = CAMPOS[op];
  for (const k of Object.keys(raw)) {
    if (k !== 'op' && !permitidos.includes(k)) {
      throw new Forma(
        `«${k}» no es un campo de ${op} (son: ${permitidos.join(', ') || 'ninguno'})`,
      );
    }
  }
  const o = raw;
  switch (op) {
    case 'crear_capitulo':
      return { op, titulo: texto(o, 'titulo')! };
    case 'crear_subcapitulo':
      return { op, padre: texto(o, 'padre')!, titulo: texto(o, 'titulo')! };
    case 'crear_partida': {
      const precio = numero(o, 'precio', true);
      if (precio !== undefined && precio < 0) throw new Forma('«precio» no puede ser negativo');
      return limpio({
        op,
        capitulo: texto(o, 'capitulo')!,
        codigo: texto(o, 'codigo', true),
        titulo: texto(o, 'titulo')!,
        ud: texto(o, 'ud')!,
        precio,
        descripcion: texto(o, 'descripcion', true),
        lineas: lineas(o, 'lineas', true),
      });
    }
    case 'agregar_lineas':
      return limpio({
        op,
        ref: texto(o, 'ref')!,
        lineas: lineas(o, 'lineas')!,
        forzar: booleano(o, 'forzar'),
      });
    case 'editar_partida':
      return {
        op,
        ref: texto(o, 'ref')!,
        campo: uno(o, 'campo', PARTIDA_FIELDS),
        valor: texto(o, 'valor')!,
      };
    case 'editar_linea': {
      const campo = uno(o, 'campo', LINEA_FIELDS);
      const valor = campo === 'comentario' ? (texto(o, 'valor', true) ?? '') : numero(o, 'valor')!;
      return limpio({
        op,
        ref: texto(o, 'ref')!,
        indice: entero(o, 'indice'),
        campo,
        valor,
        forzar: booleano(o, 'forzar'),
      });
    }
    case 'borrar_linea':
      return limpio({
        op,
        ref: texto(o, 'ref')!,
        indice: entero(o, 'indice'),
        forzar: booleano(o, 'forzar'),
      });
    case 'set_precio': {
      const valor = numero(o, 'valor')!;
      if (valor < 0) throw new Forma('«valor» no puede ser negativo');
      return { op, ref: texto(o, 'ref')!, valor };
    }
    case 'set_cantidad': {
      const valor = numero(o, 'valor')!;
      if (valor < 0) throw new Forma('«valor» no puede ser negativo');
      return limpio({ op, ref: texto(o, 'ref')!, valor, forzar: booleano(o, 'forzar') });
    }
    case 'certificar': {
      const valor = numero(o, 'valor')!;
      if (valor < 0) throw new Forma('«valor» no puede ser negativo');
      return { op, ref: texto(o, 'ref')!, valor, modo: uno(o, 'modo', CERT_MODOS) };
    }
    case 'certificar_100': {
      // Sin «visible»: el agente no ve qué tiene abierto el técnico (eso es `seleccion`).
      const ambito = uno(
        o,
        'ambito',
        CERT_AMBITOS.filter((a) => a !== 'visible') as Exclude<CertAmbito, 'visible'>[],
      );
      const ref = texto(o, 'ref', ambito === 'obra');
      return limpio({ op, ambito, ref });
    }
    case 'crear_certificacion':
      return limpio({ op, periodo: texto(o, 'periodo', true) });
    case 'renombrar':
      return { op, ref: texto(o, 'ref')!, titulo: texto(o, 'titulo')! };
    case 'borrar_contenedor':
      return { op, ref: texto(o, 'ref')! };
    case 'borrar_partida':
      return limpio({ op, ref: texto(o, 'ref')!, forzar: booleano(o, 'forzar') });
    case 'duplicar_partida':
      return { op, ref: texto(o, 'ref')! };
    case 'mover_partida':
      return { op, ref: texto(o, 'ref')!, destino: texto(o, 'destino')! };
    case 'borrar_lineas': {
      const v = o.indices;
      if (!Array.isArray(v) || v.length === 0)
        throw new Forma('«indices» tiene que ser una lista no vacía');
      const indices = v.map((x) => {
        if (typeof x !== 'number' || !Number.isInteger(x) || x < 1)
          throw new Forma('cada índice es un entero desde 1');
        return x;
      });
      if (new Set(indices).size !== indices.length) throw new Forma('«indices» tiene repetidos');
      return limpio({ op, ref: texto(o, 'ref')!, indices, forzar: booleano(o, 'forzar') });
    }
    case 'set_porcentajes': {
      const r = limpio({
        op,
        gg: numero(o, 'gg', true),
        bi: numero(o, 'bi', true),
        iva: numero(o, 'iva', true),
        ci: numero(o, 'ci', true),
      });
      const dados = (['gg', 'bi', 'iva', 'ci'] as const).filter((k) => r[k] !== undefined);
      if (dados.length === 0) throw new Forma('da al menos uno: gg, bi, iva o ci (en %)');
      for (const k of dados) {
        const n = r[k]!;
        if (n < 0 || n > 100)
          throw new Forma(`«${k}» es un porcentaje entre 0 y 100 (13 es el 13 %)`);
      }
      return r;
    }
    case 'set_coef_k': {
      const valor = numero(o, 'valor')!;
      if (valor <= 0) throw new Forma('«valor» tiene que ser mayor que 0 (1 = sin ajuste)');
      return { op, valor };
    }
    case 'editar_obra': {
      const campo = uno(o, 'campo', [...CAMPOS_OBRA_TEXTO, ...CAMPOS_OBRA_NUMERO]);
      if ((CAMPOS_OBRA_NUMERO as readonly string[]).includes(campo)) {
        const valor = o.valor === null ? null : numero(o, 'valor')!;
        if (valor !== null && valor < 0) throw new Forma('«valor» no puede ser negativo');
        return { op, campo, valor };
      }
      return { op, campo, valor: texto(o, 'valor', true) ?? '' };
    }
  }
}

/**
 * Lee un lote de operaciones con validación ESTRICTA. Si alguna está mal, no
 * devuelve ninguna: el lote se aplica entero o no se aplica.
 */
export function leerOperaciones(raw: unknown): LecturaOps {
  if (!Array.isArray(raw))
    return {
      ok: false,
      errores: [{ indice: -1, op: '', mensaje: 'las operaciones tienen que ser una lista' }],
    };
  if (raw.length === 0)
    return {
      ok: false,
      errores: [{ indice: -1, op: '', mensaje: 'la lista de operaciones está vacía' }],
    };
  const ops: OperacionAgente[] = [];
  const errores: ErrorForma[] = [];
  raw.forEach((r, indice) => {
    try {
      ops.push(leerUna(r));
    } catch (e) {
      if (!(e instanceof Forma)) throw e;
      errores.push({
        indice,
        op: isObj(r) && typeof r.op === 'string' ? r.op : '',
        mensaje: e.message,
      });
    }
  });
  return errores.length ? { ok: false, errores } : { ok: true, ops };
}

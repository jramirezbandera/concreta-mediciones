/* ===========================================================================
   ai/ops — catálogo de OPERACIONES del asistente (F-A3, ops de presupuesto).
   ---------------------------------------------------------------------------
   Una `Operation` es un ÚNICO objeto plano (`op: enum` + superconjunto de campos
   nullable), NO un `anyOf` de variantes. Motivo original: el límite de 16 uniones
   del conversor de Anthropic (F-A5); se mantiene porque además es más fácil de
   emitir para un modelo pequeño. El JSON Schema (schema.ts) declara los campos;
   la validación FINA (qué campos exige cada op) la hace validate.ts y el executor,
   nunca el schema.

   Este módulo es la FUENTE DE VERDAD del catálogo: los tipos que consume el
   executor, la lista de `op`s conocidas y la CLASIFICACIÓN directa/tarjeta (árbol
   de decisión del plan). schema.ts y prompt.ts se derivan de aquí.

   Ámbito: ops de PRESUPUESTO (F-A3) + ops de CERTIFICACIÓN (F-A4). Estas últimas
   (`certificar`, `certificar_100`, `crear_certificacion`) son SIEMPRE tarjeta.
   =========================================================================== */

/** Tipos de operación reconocidos (F-A3 presupuesto + F-A4 certificación). */
export const OP_KINDS = [
  'crear_capitulo',
  'crear_subcapitulo',
  'crear_partida',
  'agregar_lineas',
  'editar_partida',
  'editar_linea',
  'borrar_linea',
  'set_precio',
  'set_cantidad',
  // F-A4 · certificación (siempre tarjeta):
  'certificar',
  'certificar_100',
  'crear_certificacion',
] as const;

export type OpKind = (typeof OP_KINDS)[number];

/** Campo editable de una partida por `editar_partida`. */
export type PartidaField = 'titulo' | 'ud' | 'codigo' | 'descripcion';
export const PARTIDA_FIELDS: readonly PartidaField[] = ['titulo', 'ud', 'codigo', 'descripcion'];

/** Dimensión numérica de una línea (todo menos el comentario). */
export type LineaDim = 'uds' | 'largo' | 'ancho' | 'alto';
/** Campo editable de una línea de medición por `editar_linea`. */
export type LineaField = 'comentario' | LineaDim;
export const LINEA_FIELDS: readonly LineaField[] = ['comentario', 'uds', 'largo', 'ancho', 'alto'];
/** Las dimensiones (todo menos el comentario) se coercionan a número. */
export const LINEA_DIMS: readonly LineaDim[] = ['uds', 'largo', 'ancho', 'alto'];

/** Modo de `certificar`: valor a ORIGEN (acumulado) o de ESTA certificación. */
export type CertModo = 'origen' | 'esta';
export const CERT_MODOS: readonly CertModo[] = ['origen', 'esta'];

/** Ámbito de `certificar_100`: se DECLARA (no una lista de refs); el executor lo
 *  expande a ids. `capitulo`/`subarbol` usan `ref` (código del contenedor);
 *  `visible` = el contenedor activo; `obra` = todo. */
export type CertAmbito = 'obra' | 'capitulo' | 'subarbol' | 'visible';
export const CERT_AMBITOS: readonly CertAmbito[] = ['obra', 'capitulo', 'subarbol', 'visible'];

/**
 * Línea de medición emitida por el modelo. `comentario` es texto; las dimensiones
 * son números (o ausentes → factor 1, regla de `core/medicion`). Un 0 explícito
 * anula la línea (lo respeta `lineParcial`). Los nombres son los del DOMINIO en
 * castellano (los del prompt); el executor los mapea a `MedLine` (comment/uds…).
 */
export interface OpLinea {
  comentario?: string | null;
  uds?: number | null;
  largo?: number | null;
  ancho?: number | null;
  alto?: number | null;
}

/**
 * Operación NARROWED (validada). El executor solo ve estas formas; validate.ts
 * garantiza que los campos obligatorios de cada `op` están presentes y bien
 * tipados. Es una unión discriminada por `op` para el executor, aunque en el
 * transporte viaje como objeto plano.
 */
export type Operation =
  | { op: 'crear_capitulo'; titulo: string }
  | { op: 'crear_subcapitulo'; padre: string; titulo: string }
  | {
      op: 'crear_partida';
      /** Código/título del capítulo o subcapítulo destino; ausente = contenedor activo. */
      capitulo?: string;
      codigo?: string;
      titulo: string;
      ud: string;
      precio?: number;
      descripcion?: string;
      lineas?: OpLinea[];
    }
  | { op: 'agregar_lineas'; ref: string; lineas: OpLinea[] }
  | { op: 'editar_partida'; ref: string; campo: PartidaField; valor: string }
  | { op: 'editar_linea'; ref: string; indice: number; campo: LineaField; valor: string | number }
  | { op: 'borrar_linea'; ref: string; indice: number }
  | { op: 'set_precio'; ref: string; valor: number }
  | { op: 'set_cantidad'; ref: string; valor: number }
  // F-A4 · certificación (siempre tarjeta):
  | { op: 'certificar'; ref: string; valor: number; modo: CertModo }
  | { op: 'certificar_100'; ambito: CertAmbito; ref?: string }
  | { op: 'crear_certificacion'; periodo?: string };

/**
 * Clasificación directa/tarjeta (árbol de decisión del plan). El criterio no es
 * «aditivo vs destructivo» sino «INOCUO vs con consecuencias»:
 *   · crear_* y agregar_lineas → DIRECTA (se aplican ya, con toast «Deshacer»).
 *   · editar_*, borrar_*, set_* → TARJETA (propuesta con diff antes de aplicar).
 *
 * `agregar_lineas` es directa SALVO que la partida ya esté certificada (añadir
 * medición baja el % certificado en silencio, F-A4): esa reclasificación la decide
 * el executor releyendo el estado, no esta función pura. Las ops de CERTIFICACIÓN
 * (`certificar`, `certificar_100`, `crear_certificacion`) son SIEMPRE tarjeta.
 */
export function isDirect(op: OpKind): boolean {
  return op === 'crear_capitulo' || op === 'crear_subcapitulo' || op === 'crear_partida' || op === 'agregar_lineas';
}

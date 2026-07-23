/* ===========================================================================
   ai/schema — JSON Schema del envelope de respuesta `{reply, ops}`.
   ---------------------------------------------------------------------------
   F-A3 (ops de presupuesto): el asistente puede devolver OPERACIONES. Cada op es
   un OBJETO PLANO (`op: enum` + superconjunto de campos nullable), NO un `anyOf`
   de variantes: así no rompe el límite de 16 uniones del conversor de Anthropic
   (F-A5) y es más fácil de emitir para un modelo pequeño. El schema solo declara
   la FORMA; qué campos exige cada `op` lo valida `validate.ts` y el executor.

   Se pasa a Gemini como `responseJsonSchema` (structured output). Gemini admite
   `type` array (`['string','null']`) y enums, así que el schema va sin convertir.
   =========================================================================== */
import { OP_KINDS } from './ops';

/** `name` del `json_schema` de OpenAI (Responses API). Debe casar `^[a-zA-Z0-9_]+$`. */
export const CHAT_FORMAT_NAME = 'asistente_concreta';

/** Una línea de medición dentro de `lineas` (crear_partida / agregar_lineas). */
const LINEA_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    comentario: { type: ['string', 'null'], description: 'Texto de la línea (opcional).' },
    uds: { type: ['number', 'null'], description: 'Nº de unidades; vacío = 1.' },
    largo: { type: ['number', 'null'], description: 'Longitud; vacío = 1.' },
    ancho: { type: ['number', 'null'], description: 'Anchura; vacío = 1.' },
    alto: { type: ['number', 'null'], description: 'Altura; vacío = 1.' },
  },
};

/**
 * Op-objeto PLANO: `op` obligatorio; el resto de campos son un superconjunto
 * nullable (cada op usa los suyos). La semántica de campos vive en el prompt y
 * la validación en `validate.ts`.
 */
const OP_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['op'],
  properties: {
    op: { type: 'string', enum: [...OP_KINDS], description: 'Tipo de operación.' },
    // Referencias / destinos (posición "1.2.3" de partida, código de contenedor).
    ref: { type: ['string', 'null'], description: 'Posición de la partida objetivo, p.ej. "1.2".' },
    capitulo: { type: ['string', 'null'], description: 'Código/título del capítulo o subcapítulo destino.' },
    padre: { type: ['string', 'null'], description: 'Código/título del contenedor padre del subcapítulo.' },
    indice: { type: ['number', 'null'], description: 'Índice de línea (1 = primera).' },
    // Texto.
    titulo: { type: ['string', 'null'] },
    codigo: { type: ['string', 'null'] },
    ud: { type: ['string', 'null'], description: 'Unidad de medida, p.ej. "m³", "ud", "m²".' },
    descripcion: { type: ['string', 'null'] },
    campo: { type: ['string', 'null'], description: 'Campo a editar.' },
    // Valor polimórfico: texto para editar_partida/editar_linea, número para set_*/certificar.
    valor: { type: ['string', 'number', 'null'] },
    precio: { type: ['number', 'null'], description: 'Precio unitario en euros.' },
    // Medición inline.
    lineas: { type: ['array', 'null'], items: LINEA_SCHEMA },
    // Certificación (F-A4).
    modo: { type: ['string', 'null'], enum: ['origen', 'esta', null], description: 'certificar: valor a origen o de esta cert.' },
    ambito: { type: ['string', 'null'], enum: ['obra', 'capitulo', 'subarbol', 'visible', null], description: 'certificar_100: ámbito a completar.' },
    periodo: { type: ['string', 'null'], description: 'crear_certificacion: periodo de la nueva cert.' },
  },
};

/** Envelope canónico de respuesta `{reply, ops}`. `ops` null = turno conversacional. */
export const CHAT_ENVELOPE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'ops'],
  properties: {
    reply: {
      type: 'string',
      description: 'Respuesta conversacional breve para el usuario, en español.',
    },
    ops: {
      type: ['array', 'null'],
      items: OP_SCHEMA,
      description:
        'Operaciones a aplicar sobre la obra; null (o vacío) en turnos meramente conversacionales.',
    },
  },
};

/* ===========================================================================
   ai/schema — JSON Schema del envelope de respuesta `{reply, ops}`.
   ---------------------------------------------------------------------------
   F-A3 (ops de presupuesto): el asistente puede devolver OPERACIONES. Cada op es
   un OBJETO PLANO (`op: enum` + superconjunto de campos nullable), NO un `anyOf`
   de variantes: así no rompe el límite de 16 uniones del conversor de Anthropic
   (F-A5) y es más fácil de emitir para un modelo pequeño. El schema solo declara
   la FORMA; qué campos exige cada `op` lo valida `validate.ts` y el executor.

   TODOS los campos van en `required` (anulables: el que no aplica va a null). Con
   solo `op` obligatorio, gemini-3.1-flash-lite trataba el resto como opcional y
   se los saltaba en peticiones elaboradas: `crear_partida` sin `titulo` ni `ud`
   (descartada siempre) o `certificar_100` sin `ref`. Obligarlos hace que el
   modelo decida cada campo. Es además lo que exige OpenAI `strict: true`.

   El ORDEN de las propiedades es el orden en que el modelo las escribe: lo
   esencial (destino, título, unidad) va antes que lo largo (descripción, líneas).

   Se pasa a Gemini como `responseJsonSchema` (structured output). Gemini admite
   `type` array (`['string','null']`) y enums, así que el schema va sin convertir.
   =========================================================================== */
import { OP_KINDS } from './ops';

/** `name` del `json_schema` de OpenAI (Responses API). Debe casar `^[a-zA-Z0-9_]+$`. */
export const CHAT_FORMAT_NAME = 'asistente_concreta';

/** Objeto cerrado con TODAS sus propiedades obligatorias (ver cabecera). */
function closedObject(properties: Record<string, unknown>): Record<string, unknown> {
  return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties };
}

/** Una línea de medición dentro de `lineas` (crear_partida / agregar_lineas). */
const LINEA_SCHEMA = closedObject({
  comentario: { type: ['string', 'null'], description: 'Texto de la línea (opcional).' },
  uds: { type: ['number', 'null'], description: 'Nº de unidades; null = 1.' },
  largo: { type: ['number', 'null'], description: 'Longitud; null = 1.' },
  ancho: { type: ['number', 'null'], description: 'Anchura; null = 1.' },
  alto: { type: ['number', 'null'], description: 'Altura; null = 1.' },
});

/**
 * Op-objeto PLANO: `op` + superconjunto de campos nullable (cada op usa los
 * suyos y deja el resto a null). La semántica de campos vive en el prompt y la
 * validación en `validate.ts`.
 */
const OP_SCHEMA = closedObject({
  op: { type: 'string', enum: [...OP_KINDS], description: 'Tipo de operación.' },
  // Referencias / destinos (posición "1.2.3" de partida, código de contenedor).
  ref: { type: ['string', 'null'], description: 'Posición de la partida objetivo, p.ej. "1.2".' },
  capitulo: { type: ['string', 'null'], description: 'Código del capítulo o subcapítulo destino.' },
  padre: { type: ['string', 'null'], description: 'Código del contenedor padre del subcapítulo.' },
  // Texto.
  titulo: {
    type: ['string', 'null'],
    description: 'Título corto. OBLIGATORIO en crear_capitulo, crear_subcapitulo y crear_partida.',
  },
  ud: { type: ['string', 'null'], description: 'Unidad de medida, p.ej. "m³", "ud", "m²". OBLIGATORIA en crear_partida.' },
  codigo: { type: ['string', 'null'], description: 'Solo si el usuario lo dicta; null = la app asigna uno.' },
  precio: { type: ['number', 'null'], description: 'Precio unitario en euros.' },
  descripcion: {
    type: ['string', 'null'],
    description: 'Texto descriptivo de la partida (no sustituye al título). En crear_partida, redáctalo si no lo dan.',
  },
  // Medición inline.
  lineas: { type: ['array', 'null'], items: LINEA_SCHEMA },
  // Edición: campo + valor polimórfico (texto para editar_partida/editar_linea,
  // número para set_*/certificar) e índice de línea.
  campo: { type: ['string', 'null'], description: 'Campo a editar.' },
  valor: { type: ['string', 'number', 'null'] },
  indice: { type: ['number', 'null'], description: 'Índice de línea (1 = primera).' },
  // Certificación (F-A4).
  modo: { type: ['string', 'null'], enum: ['origen', 'esta', null], description: 'certificar: valor a origen o de esta cert.' },
  ambito: {
    type: ['string', 'null'],
    enum: ['obra', 'capitulo', 'subarbol', 'visible', null],
    description: 'certificar_100: ámbito a completar.',
  },
  periodo: { type: ['string', 'null'], description: 'crear_certificacion: periodo de la nueva cert.' },
});

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

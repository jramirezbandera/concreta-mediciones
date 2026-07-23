/* ===========================================================================
   ai/types — contratos núcleo del asistente de IA (transporte).
   ---------------------------------------------------------------------------
   Portado de concreta-v2 (`src/lib/ai/types.ts`) y adaptado al primer incremento
   de Mediciones: SOLO Gemini (OpenAI/Anthropic llegan en F-A5). El parseo del
   envelope `{reply, ops}` y el catálogo de operaciones viven en `validate.ts`
   (F-A3), no aquí: este fichero es solo el transporte (petición, turnos, error).
   =========================================================================== */

/** Proveedores contemplados. Solo `gemini` está cableado en el primer incremento;
 *  los otros dos se mantienen en la unión para no re-tocar el contrato en F-A5. */
export type AiProviderId = 'anthropic' | 'openai' | 'gemini';

export type AiImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface AiImageAttachment {
  /** Base64 puro, SIN prefijo "data:...;base64," */
  data: string;
  mediaType: AiImageMediaType;
}

export type AiErrorKind =
  | 'invalid-key'
  | 'rate-limit'
  | 'network'
  | 'bad-response'
  | 'aborted'
  | 'schema-too-large'
  | 'unknown';

export class AiError extends Error {
  readonly kind: AiErrorKind;
  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.name = 'AiError';
    this.kind = kind;
  }
}

/** Mapea un status HTTP a la clase de error del asistente. */
export function aiErrorKindFromStatus(status: number | undefined): AiErrorKind {
  if (status === 401 || status === 403) return 'invalid-key';
  if (status === 429) return 'rate-limit';
  if (status !== undefined && status >= 500) return 'network';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Chat conversacional — contrato de transporte.
// ---------------------------------------------------------------------------

export interface ChatTurn {
  role: 'user' | 'assistant';
  /** user: texto del usuario · assistant: JSON crudo del envelope (reenviado verbatim). */
  text: string;
  images?: AiImageAttachment[]; // solo turnos user (visión: F-A5)
}

/**
 * System prompt partido en dos bloques — el corte existe para la CACHÉ DE PROMPT.
 *
 * La caché de prompt es un PREFIJO: solo se reutiliza el tramo inicial idéntico
 * byte a byte. Por eso todo lo que cambia por turno (el snapshot de la obra) va
 * DESPUÉS de lo que no cambia; si se colara antes, invalidaría la caché entera.
 *
 * - `stable`: reglas + «SOBRE LA APLICACIÓN» + catálogo de ops. Idéntico entre
 *   turnos. En Gemini la caché es implícita: basta con NO meter nada variable
 *   delante.
 * - `volatile`: snapshot de la obra. Cambia cada turno; nunca se cachea.
 */
export interface ChatSystem {
  stable: string;
  volatile: string;
}

/** Los dos bloques como un solo string (Gemini no tiene breakpoint explícito). */
export function chatSystemText(system: ChatSystem): string {
  return `${system.stable}\n\n${system.volatile}`;
}

export interface ChatRequest {
  system: ChatSystem; // bloque estable (cacheable) + bloque volátil, POR TURNO
  schema: Record<string, unknown>; // envelope canónico = buildChatSchema(...) (F-A3)
  turns: ChatTurn[]; // antiguo → nuevo; el último SIEMPRE 'user'; roles estrictamente alternos
  /**
   * Clave del prefijo cacheado, estable por conversación. Solo la usa OpenAI
   * (`prompt_cache_key`, F-A5); Gemini la ignora. Opcional en el primer
   * incremento por eso.
   */
  cacheKey?: string;
  signal?: AbortSignal;
}

/** Firma común de un proveedor: devuelve el JSON crudo (parseado) o lanza AiError.
 *  El parseo del envelope `{reply, ops}` es responsabilidad del llamador (F-A3). */
export type ProviderChatFn = (
  req: ChatRequest,
  apiKey: string,
  model: string,
) => Promise<unknown>;

export const AI_ERROR_MESSAGES: Record<AiErrorKind, string> = {
  'invalid-key': 'La API key no es válida o no tiene permisos.',
  'rate-limit': 'Límite de peticiones alcanzado. Espera unos segundos y reintenta.',
  network: 'Error de red o del servicio. Comprueba tu conexión.',
  'bad-response': 'El modelo devolvió una respuesta no interpretable.',
  aborted: 'Petición cancelada.',
  'schema-too-large':
    'Este proveedor no admite el esquema del asistente. Cambia a Google (Gemini) para usarlo.',
  unknown: 'Error inesperado.',
};

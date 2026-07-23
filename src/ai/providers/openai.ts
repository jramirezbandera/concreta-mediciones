/* ===========================================================================
   ai/providers/openai — proveedor OpenAI (GPT), chat con structured output.
   ---------------------------------------------------------------------------
   Portado de concreta-v2. El SDK `openai` se carga con dynamic import DENTRO de
   `chatRaw` para que Vite lo separe en su propio chunk (solo se descarga si el
   usuario elige OpenAI como proveedor). BYOK puro: no hay clave compartida (F-A5).

   Responses API verificada contra los tipos de openai@6.46.0:
   - `client.responses.create(body, { signal })`.
   - `text.format: { type: 'json_schema', name, strict, schema }` (schema convertido
     con `toOpenAiSchema`: OpenAI strict admite `type` array pero no `null` en enums).
   - Turnos user → `input_image` (data URL base64) + `input_text`; assistant → string.
   - `reasoning.effort: 'none'` apaga el razonamiento (esos tokens se facturarían
     como salida); `store: false` (BYOK, nota de privacidad); `prompt_cache_key`
     enruta la caché implícita (≥1024 tokens).
   =========================================================================== */
import { AiError, aiErrorKindFromStatus, chatSystemText } from '../types';
import type { ChatTurn, ProviderChatFn } from '../types';
import { CHAT_FORMAT_NAME } from '../schema';
import { toOpenAiSchema } from './schemaConvert';

type OpenAiSdkClass = (typeof import('openai'))['default'];

/** Un bloque de contenido de usuario para la Responses API. */
type OpenAiUserContent =
  | { type: 'input_image'; detail: 'auto'; image_url: string }
  | { type: 'input_text'; text: string };

/** Un ítem de `input` de la Responses API. */
type OpenAiInputItem =
  | { role: 'assistant'; content: string }
  | { role: 'user'; content: OpenAiUserContent[] };

/**
 * Convierte los turnos al `input` de la Responses API: assistant → string (el
 * envelope JSON crudo verbatim); user → imágenes (`input_image`, data URL)
 * seguidas del texto. OMITE el `input_text` vacío cuando el turno lleva imágenes
 * (un turno solo-imagen manda `text: ''`); un turno sin imágenes siempre lleva su
 * texto. Exportado para tests.
 */
export function buildOpenAiInput(turns: ReadonlyArray<ChatTurn>): OpenAiInputItem[] {
  return turns.map((turn) => {
    if (turn.role === 'assistant') return { role: 'assistant', content: turn.text };
    const content: OpenAiUserContent[] = (turn.images ?? []).map((img) => ({
      type: 'input_image',
      detail: 'auto',
      image_url: `data:${img.mediaType};base64,${img.data}`,
    }));
    if (turn.text !== '' || content.length === 0) {
      content.push({ type: 'input_text', text: turn.text });
    }
    return { role: 'user', content };
  });
}

/** Elimina la apiKey del texto por si el SDK la incluyera en un mensaje de error. */
function withoutKey(message: string, apiKey: string): string {
  return apiKey.length > 0 ? message.split(apiKey).join('[redactada]') : message;
}

/** Normaliza cualquier error del SDK/navegador a AiError. Nunca interpola la apiKey. */
export function toAiError(
  err: unknown,
  apiKey: string,
  signal: AbortSignal | undefined,
  OpenAI: OpenAiSdkClass,
): AiError {
  if (err instanceof AiError) return err;
  if (
    signal?.aborted === true ||
    err instanceof OpenAI.APIUserAbortError ||
    (err instanceof Error && err.name === 'AbortError')
  ) {
    return new AiError('aborted', 'Petición a OpenAI cancelada.');
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return new AiError('network', withoutKey(err.message, apiKey));
  }
  const status =
    typeof err === 'object' && err !== null && typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : undefined;
  if (err instanceof OpenAI.APIError || status !== undefined) {
    const message =
      err instanceof Error ? err.message : `Error HTTP ${String(status)} de la API de OpenAI.`;
    return new AiError(aiErrorKindFromStatus(status), withoutKey(message, apiKey));
  }
  return new AiError(
    'unknown',
    err instanceof Error
      ? withoutKey(err.message, apiKey)
      : 'Error inesperado en la petición a OpenAI.',
  );
}

/** `output_text` → JSON parseado; vacío o JSON inválido → AiError('bad-response'). */
export function parseJsonFromOutputText(jsonText: string): unknown {
  if (jsonText === '') {
    throw new AiError('bad-response', 'OpenAI no devolvió texto de salida.');
  }
  try {
    return JSON.parse(jsonText) as unknown;
  } catch {
    throw new AiError('bad-response', 'OpenAI devolvió una respuesta que no es JSON válido.');
  }
}

export const chatRaw: ProviderChatFn = async (req, apiKey, model) => {
  let OpenAI: OpenAiSdkClass;
  try {
    ({ default: OpenAI } = await import('openai'));
  } catch {
    throw new AiError('network', 'No se pudo cargar el SDK de OpenAI (¿sin conexión?).');
  }
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  try {
    const response = await client.responses.create(
      {
        model,
        // Caché de prompt: automática ≥1024 tokens; `prompt_cache_key` enruta el
        // acierto a la máquina con el prefijo caliente (el system estable va delante).
        instructions: chatSystemText(req.system),
        prompt_cache_key: req.cacheKey,
        // Razonamiento apagado: los GPT-5.x razonan por defecto y esos tokens se
        // facturan como salida; la tarea es extracción estructurada guiada.
        reasoning: { effort: 'none' },
        store: false, // BYOK: no almacenar en OpenAI (nota de privacidad).
        text: {
          format: {
            type: 'json_schema',
            name: CHAT_FORMAT_NAME,
            strict: true,
            schema: toOpenAiSchema(req.schema),
          },
        },
        input: buildOpenAiInput(req.turns),
      },
      { signal: req.signal },
    );
    return parseJsonFromOutputText(response.output_text);
  } catch (err) {
    throw toAiError(err, apiKey, req.signal, OpenAI);
  }
};

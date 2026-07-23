/* ===========================================================================
   ai/providers/gemini — proveedor Gemini (Google), chat con structured output.
   ---------------------------------------------------------------------------
   El SDK `@google/genai` se carga con dynamic import DENTRO de `chatRaw` para que
   Vite lo separe en su propio chunk: el asistente es la única parte de la app que
   necesita red, y así no pesa en el arranque.

   Gemini acepta el schema canónico SIN convertir en `responseJsonSchema` (admite
   `type` array y `null` en enums), a diferencia de OpenAI/Anthropic (F-A5).
   =========================================================================== */
import { AiError, aiErrorKindFromStatus, chatSystemText } from '../types';
import type { ProviderChatFn } from '../types';

type GeminiApiErrorClass = (typeof import('@google/genai'))['ApiError'];

/** Extrae un status HTTP numérico de un error del SDK (`status` o `code`).
 *  Exportado para tests. */
export function numericStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const rec = err as Record<string, unknown>;
  if (typeof rec.status === 'number') return rec.status;
  if (typeof rec.code === 'number') return rec.code;
  return undefined;
}

/** Elimina la apiKey del texto por si el SDK la incluyera en un mensaje de error.
 *  Exportado para tests. */
export function scrub(message: string, apiKey: string): string {
  return apiKey ? message.split(apiKey).join('[redactada]') : message;
}

/**
 * Normaliza cualquier error del SDK/fetch a AiError. Nunca interpola la apiKey.
 * `ApiError` se pasa como parámetro porque el SDK se carga por dynamic import.
 * Exportado para tests.
 */
export function toAiError(
  err: unknown,
  apiKey: string,
  signal: AbortSignal | undefined,
  ApiError: GeminiApiErrorClass,
): AiError {
  if (err instanceof AiError) return err;
  if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
    return new AiError('aborted', 'Petición a Gemini cancelada.');
  }
  if (err instanceof ApiError) {
    return new AiError(
      aiErrorKindFromStatus(err.status),
      scrub(`Gemini API (HTTP ${err.status}): ${err.message}`, apiKey),
    );
  }
  const status = numericStatus(err);
  if (status !== undefined) {
    return new AiError(
      aiErrorKindFromStatus(status),
      scrub(`Gemini API (HTTP ${status}): ${err instanceof Error ? err.message : 'error'}`, apiKey),
    );
  }
  if (err instanceof TypeError) {
    // fetch falla sin status (offline, DNS, CORS...) → TypeError.
    return new AiError('network', 'No se pudo conectar con la API de Gemini.');
  }
  return new AiError(
    'unknown',
    scrub(`Error inesperado llamando a Gemini: ${err instanceof Error ? err.message : String(err)}`, apiKey),
  );
}

/** `response.text` → JSON parseado; vacío o JSON inválido → AiError('bad-response').
 *  Exportado para tests. */
export function parseJsonText(text: string | undefined): unknown {
  if (text === undefined || text.trim() === '') {
    throw new AiError('bad-response', 'Gemini devolvió una respuesta vacía.');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AiError('bad-response', 'Gemini devolvió una respuesta que no es JSON válido.');
  }
}

/**
 * Turno de chat: `system` y `schema` llegan en la request. Turnos assistant →
 * role 'model'; turnos user → parts con imágenes `inlineData` + texto.
 */
export const chatRaw: ProviderChatFn = async (req, apiKey, model) => {
  let GoogleGenAI: (typeof import('@google/genai'))['GoogleGenAI'];
  let ApiError: (typeof import('@google/genai'))['ApiError'];
  try {
    ({ GoogleGenAI, ApiError } = await import('@google/genai'));
  } catch {
    throw new AiError('network', 'No se pudo cargar el SDK de Gemini (¿sin conexión?).');
  }

  const ai = new GoogleGenAI({ apiKey });

  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model,
      contents: req.turns.map((turn) => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [
          ...(turn.images ?? []).map((img) => ({
            inlineData: { mimeType: img.mediaType, data: img.data },
          })),
          { text: turn.text },
        ],
      })),
      config: {
        // Caché de prompt: en Gemini es IMPLÍCITA y automática (cachea el prefijo
        // común si supera el umbral). Lo único a respetar es no meter nada
        // variable delante: por eso el system va estable-primero (ver ChatSystem).
        systemInstruction: chatSystemText(req.system),
        // Razonamiento APAGADO: en gemini-3.1-flash-lite `thinkingBudget: 0` lo
        // desactiva por completo (esos tokens se facturarían como salida). Si se
        // cambia de modelo, revalidar que acepta thinkingBudget:0.
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        responseJsonSchema: req.schema,
        abortSignal: req.signal,
      },
    });
    text = response.text;
  } catch (err) {
    throw toAiError(err, apiKey, req.signal, ApiError);
  }
  return parseJsonText(text);
};

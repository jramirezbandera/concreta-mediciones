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
import type { ChatTurn, ProviderChatFn } from '../types';

/** Tokens de razonamiento por turno (ver la llamada en `chatRaw`). */
export const THINKING_BUDGET = 1024;

/** Una `part` de contenido de Gemini: imagen embebida o texto. */
type GeminiPart = { inlineData: { mimeType: string; data: string } } | { text: string };

/**
 * Construye las `parts` de un turno para Gemini: las imágenes primero
 * (`inlineData`) y el texto después. OMITE el part de texto vacío cuando el turno
 * lleva imágenes (un turno solo-imagen manda `text: ''`, y la API rechaza un part
 * de texto vacío junto a una imagen). Un turno sin imágenes siempre lleva su part
 * de texto, aunque esté vacío, para no quedarse sin `parts`. Exportado para tests.
 */
export function turnToParts(turn: ChatTurn): GeminiPart[] {
  const parts: GeminiPart[] = (turn.images ?? []).map((img) => ({
    inlineData: { mimeType: img.mediaType, data: img.data },
  }));
  if (turn.text !== '' || parts.length === 0) parts.push({ text: turn.text });
  return parts;
}

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
    scrub(
      `Error inesperado llamando a Gemini: ${err instanceof Error ? err.message : String(err)}`,
      apiKey,
    ),
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
  for (let attempt = 0; ; attempt++) {
    try {
      text = await generate(ai, req, model);
      break;
    } catch (err) {
      const e = toAiError(err, apiKey, req.signal, ApiError);
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !isTransient(err)) throw e;
      await sleep(delay, req.signal).catch(() => {
        throw new AiError('aborted', 'Petición a Gemini cancelada.');
      });
    }
  }
  return parseJsonText(text);
};

/** Esperas antes de cada reintento ante un fallo PASAJERO del servicio. */
export const RETRY_DELAYS_MS = [1500, 4000];

/**
 * 5xx = Gemini saturado («high demand», 503) o caído un momento: se reintenta.
 * El 429 (cupo) NO: reintentarlo solo gasta más cupo compartido. Por eso no se
 * usa el `retryOptions` del SDK, que reintenta también los 429 y, al rendirse,
 * pierde el status (el usuario dejaría de ver «límite alcanzado»).
 */
export function isTransient(err: unknown): boolean {
  const status = numericStatus(err);
  return status !== undefined && status >= 500;
}

/** Espera `ms` o rechaza en cuanto se cancele la petición. */
function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new Error('aborted'));
      },
      { once: true },
    );
  });
}

/** Una llamada a `generateContent` → texto crudo de la respuesta. */
async function generate(
  ai: InstanceType<(typeof import('@google/genai'))['GoogleGenAI']>,
  req: Parameters<ProviderChatFn>[0],
  model: string,
): Promise<string | undefined> {
  const response = await ai.models.generateContent({
    model,
    contents: req.turns.map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: turnToParts(turn),
    })),
    config: {
      // Caché de prompt: en Gemini es IMPLÍCITA y automática (cachea el prefijo
      // común si supera el umbral). Lo único a respetar es no meter nada
      // variable delante: por eso el system va estable-primero (ver ChatSystem).
      systemInstruction: chatSystemText(req.system),
      // Razonamiento CORTO. Con 0 (apagado) fallaba la mitad de las mediciones
      // derivadas: «micros según la 1.1» contaba encepados (38) en vez de
      // micros (118). Medido en real (8 intentos): 0 → 4/8 · 512 → 7/8 ·
      // 1024 → 7/8 (y su fallo es no emitir, nunca un número malo) · 2048 → 6/8.
      // Gasta ~100-900 tokens de pensamiento por turno; la latencia apenas varía.
      thinkingConfig: { thinkingBudget: THINKING_BUDGET },
      responseMimeType: 'application/json',
      responseJsonSchema: req.schema,
      abortSignal: req.signal,
    },
  });
  return response.text;
}

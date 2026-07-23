/* ===========================================================================
   ai/chat — un turno de chat completo (Gemini-only en el primer incremento).
   ---------------------------------------------------------------------------
   Equivale al dispatcher `runChatTurn` de concreta-v2, pero con un solo proveedor:
   llama a `chatRaw` (Gemini) y parsea el envelope. F-A5 añadirá el switch de
   proveedores (OpenAI/Anthropic) manteniendo esta firma.
   =========================================================================== */
import { AI_MODELS } from './models';
import { chatRaw } from './providers/gemini';
import { parseChatEnvelope, type ChatEnvelope } from './validate';
import type { ChatRequest } from './types';

/** Envía un turno a Gemini y devuelve el envelope parseado (`{reply, ops}`).
 *  Los errores ya vienen normalizados a AiError (por el proveedor / el parser). */
export async function runChatTurn(apiKey: string, req: ChatRequest): Promise<ChatEnvelope> {
  const raw = await chatRaw(req, apiKey, AI_MODELS.gemini);
  return parseChatEnvelope(raw);
}

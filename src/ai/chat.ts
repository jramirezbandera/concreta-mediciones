/* ===========================================================================
   ai/chat — dispatcher de proveedores: un turno de chat completo.
   ---------------------------------------------------------------------------
   Enruta al proveedor activo y parsea el envelope `{reply, ops}`. Cada rama usa un
   dynamic import LITERAL (nunca `import(variable)`) para que Vite genere un chunk
   separado por proveedor: los SDKs quedan fuera del bundle principal y solo se
   descargan al elegir ese proveedor.

   F-A5: se añade OpenAI junto a Gemini. Anthropic queda FUERA (su tope de 16
   uniones no admite el envelope de 21; ver providers/schemaConvert). Solo el import
   se envuelve en try/catch (fallo de carga → AiError 'network'); los errores de
   `chatRaw` (ya normalizados por cada proveedor) y de `parseChatEnvelope` suben.
   =========================================================================== */
import { AI_MODELS } from './models';
import { parseChatEnvelope, type ChatEnvelope } from './validate';
import { AiError } from './types';
import type { AiProviderId, ChatRequest, ProviderChatFn } from './types';

/** Envía un turno al proveedor `provider` y devuelve el envelope parseado.
 *  Los errores ya vienen normalizados a AiError (por el proveedor / el parser). */
export async function runChatTurn(
  provider: AiProviderId,
  apiKey: string,
  req: ChatRequest,
): Promise<ChatEnvelope> {
  let mod: { chatRaw: ProviderChatFn };
  try {
    switch (provider) {
      case 'gemini':
        mod = await import('./providers/gemini');
        break;
      case 'openai':
        mod = await import('./providers/openai');
        break;
      case 'anthropic':
        // No soportado en Mediciones: el envelope excede el tope de 16 uniones de
        // Anthropic. La UI no ofrece este proveedor; esto cubre un ajuste heredado.
        throw new AiError(
          'schema-too-large',
          'Anthropic (Claude) no está disponible en este asistente. Elige Google (Gemini) u OpenAI (GPT).',
        );
      default: {
        const exhaustive: never = provider;
        throw new AiError('unknown', `Proveedor de IA no soportado: ${String(exhaustive)}`);
      }
    }
  } catch (err) {
    if (err instanceof AiError) throw err; // rama anthropic/exhaustiva, no un fallo de import
    throw new AiError('network', 'No se pudo cargar el módulo del proveedor (¿sin conexión?).');
  }
  const raw = await mod.chatRaw(req, apiKey, AI_MODELS[provider]);
  return parseChatEnvelope(raw);
}

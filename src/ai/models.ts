/* ===========================================================================
   ai/models — IDs de modelo, etiquetas y URLs de consola por proveedor.
   ---------------------------------------------------------------------------
   Gemini (clave compartida + BYOK) y OpenAI (BYOK) están cableados. Anthropic se
   mantiene en la unión por contrato pero NO se ofrece: el envelope `{reply, ops}`
   excede su tope de 16 uniones (ver providers/schemaConvert).
   =========================================================================== */
import type { AiProviderId } from './types';

export const AI_MODELS: Record<AiProviderId, string> = {
  // No ofrecido en Mediciones (tope de 16 uniones). ID válido por si se retoma.
  anthropic: 'claude-sonnet-5',
  // GPT-5.6 Terra (verificado 2026-07-12 en concreta-v2): gama media de la familia
  // GPT-5.6, con visión (entrada de imágenes) y structured outputs (json_schema
  // strict). Terra = equilibrio inteligencia/coste (Sol=flagship, Luna=alto volumen).
  // Fuentes: https://developers.openai.com/api/docs/models/gpt-5.6-terra
  openai: 'gpt-5.6-terra',
  // Gemini 3.1 Flash-Lite (modelo FIJADO, no alias). Elegido por su free tier
  // grande: el `-flash` normal daba ~20 peticiones/día por proyecto, inviable
  // para la clave compartida. Soporta structured output (`responseJsonSchema`) y
  // razonamiento apagable (`thinkingBudget: 0`).
  // Fuentes: https://ai.google.dev/gemini-api/docs/models · .../rate-limits
  gemini: 'gemini-3.1-flash-lite',
};

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (GPT)',
  gemini: 'Google (Gemini)',
};

export const AI_PROVIDER_KEY_URLS: Record<AiProviderId, string> = {
  anthropic: 'https://platform.claude.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
  gemini: 'https://aistudio.google.com/apikey',
};

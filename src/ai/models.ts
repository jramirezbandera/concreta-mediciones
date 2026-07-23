/* ===========================================================================
   ai/models — IDs de modelo, etiquetas y URLs de consola por proveedor.
   ---------------------------------------------------------------------------
   Primer incremento: SOLO Gemini está cableado. Las entradas de anthropic/openai
   se mantienen para no re-tocar el contrato en F-A5, pero sus IDs se VERIFICARÁN
   contra la documentación viva cuando se implemente ese proveedor (hoy son
   provisionales; ver docs/plan-asistente-ia.md).
   =========================================================================== */
import type { AiProviderId } from './types';

export const AI_MODELS: Record<AiProviderId, string> = {
  // Provisionales — verificar en F-A5 antes de cablear estos proveedores.
  anthropic: 'claude-sonnet-5',
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

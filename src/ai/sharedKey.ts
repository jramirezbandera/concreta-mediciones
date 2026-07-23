/* ===========================================================================
   ai/sharedKey — clave Gemini COMPARTIDA (fallback para quien no trae la suya).
   ---------------------------------------------------------------------------
   BYOK sigue disponible y SIEMPRE tiene prioridad (ver settingsStore.resolveActiveKey).
   =========================================================================== */
import type { AiProviderId } from './types';

/**
 * La clave NO vive en el código: llega por la variable de entorno
 * VITE_AI_SHARED_GEMINI_KEY, que Vite sustituye al COMPILAR:
 *   - Producción (GitHub Pages): un Secret del repo → `.github/workflows/deploy.yml`
 *     lo pasa a `vite build` → la clave queda horneada en el bundle SERVIDO
 *     (clave de cliente: PÚBLICA por necesidad, cualquiera la ve en el JS
 *     descargado) pero NUNCA en el repositorio ni en el historial de git.
 *   - Desarrollo local: `.env.local` (gitignored por `.env.*`).
 *   - Tests: no se define → la clave compartida queda vacía y el módulo es BYOK
 *     puro; la lógica de resolución se prueba con una clave ficticia explícita
 *     (ver settingsStore.test.ts), sin depender del entorno.
 *
 * ⚠️ El proyecto de Google de esta clave NO debe tener facturación (peor caso
 * 429, nunca cargo). Rotación: cambia el Secret del repo y vuelve a desplegar;
 * al ser un fallback en tiempo de lectura, ningún usuario se queda con la vieja.
 */
export const SHARED_GEMINI_KEY = (
  (import.meta.env as Record<string, string | undefined>).VITE_AI_SHARED_GEMINI_KEY ?? ''
).trim();

/**
 * Clave compartida para `provider`, o null si no hay ninguna. Solo Gemini la
 * tiene; los demás proveedores son BYOK puro.
 */
export function sharedKeyFor(provider: AiProviderId): string | null {
  if (provider === 'gemini' && SHARED_GEMINI_KEY !== '') return SHARED_GEMINI_KEY;
  return null;
}

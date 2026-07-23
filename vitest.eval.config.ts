/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

/**
 * Config del harness de EVAL del prompt (`npm run eval:ia`). Corre SOLO los ficheros
 * `*.eval.ts` (el glob por defecto de vitest es `*.test.ts`, así que la suite normal
 * y CI no los tocan). Golpea la API REAL de Gemini con la clave de `.env.local`;
 * NO es determinista y NO va en CI (gastaría cupo compartido y sería intermitente).
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.eval.ts'],
    // El eval es un INFORME: los console.log deben verse siempre (vitest los oculta
    // en tests que pasan). Sin interceptar, van directos a stdout.
    disableConsoleIntercept: true,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Secuencial: un solo fichero, llamadas de red seriadas (respeta el rate limit).
    fileParallelism: false,
  },
});

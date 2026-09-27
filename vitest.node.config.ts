/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

/**
 * Tests en entorno NODE (`npm run test:node`): el motor de PDF real (pdf.js)
 * y lo que no puede correr en jsdom. Solo los ficheros `*.node.test.ts`; la
 * suite normal los excluye. Sin `src/test/setup.ts`: toca `Element`, que en
 * node no existe.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.node.test.ts'],
    testTimeout: 30_000,
  },
});

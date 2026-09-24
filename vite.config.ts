/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.GITHUB_PAGES === 'true' && repoName ? `/${repoName}/` : '/';

// Identificador del build (aviso de versión nueva): el commit en CI, o la hora del
// build en local. Va horneado en el bundle (`__APP_BUILD__`) y publicado aparte en
// `version.json`; la app compara ambos para saber si corre una versión antigua.
const BUILD_ID = process.env.GITHUB_SHA?.slice(0, 12) || Date.now().toString(36);

/** Emite `version.json` junto al index.html (solo en build). */
function versionFile(): Plugin {
  return {
    name: 'concreta-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ build: BUILD_ID }),
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), versionFile()],
  define: {
    __APP_BUILD__: JSON.stringify(BUILD_ID),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      // Toda la app, no solo core (auditoría G-01): el 96 % que reportaba el
      // include antiguo no decía nada de store/persist/features — justo donde
      // la auditoría concentró hallazgos. vendor (fork) y sandbox (dev) fuera.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/vendor/**',
        'src/features/sandbox/**',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
  },
});

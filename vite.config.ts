import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { configDefaults, defineConfig, type Plugin } from 'vitest/config';
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

/**
 * Recursos de pdf.js (planos PDF, §8.2): `cmaps`, `standard_fonts`, `wasm` e
 * `iccs` de `pdfjs-dist`, publicados en `<base>pdfjs/<carpeta>/` con el mismo
 * `base` de Pages. En build se emiten al `dist`; en desarrollo se sirven desde
 * node_modules. Sin dependencia nueva (como `versionFile`).
 */
function pdfjsAssets(): Plugin {
  const raiz = resolve(__dirname, 'node_modules/pdfjs-dist');
  const carpetas = ['cmaps', 'standard_fonts', 'wasm', 'iccs'];
  const tipos: Record<string, string> = { '.wasm': 'application/wasm', '.js': 'text/javascript' };
  return {
    name: 'concreta-pdfjs-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]!;
        const m = /\/pdfjs\/([a-z_]+)\/([^/]+)$/.exec(url);
        if (!m || !carpetas.includes(m[1]!)) return next();
        const fichero = join(raiz, m[1]!, decodeURIComponent(m[2]!));
        if (!fichero.startsWith(raiz) || !existsSync(fichero) || !statSync(fichero).isFile()) return next();
        res.setHeader('Content-Type', tipos[extname(fichero)] ?? 'application/octet-stream');
        createReadStream(fichero).pipe(res);
      });
    },
    generateBundle() {
      for (const c of carpetas) {
        const dir = join(raiz, c);
        if (!existsSync(dir)) continue;
        for (const f of readdirSync(dir)) {
          const ruta = join(dir, f);
          if (!statSync(ruta).isFile() || f.includes('quickjs')) continue; // sin scripting: el sandbox de JS no se carga nunca
          this.emitFile({ type: 'asset', fileName: `pdfjs/${c}/${f}`, source: readFileSync(ruta) });
        }
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), versionFile(), pdfjsAssets()],
  define: {
    __APP_BUILD__: JSON.stringify(BUILD_ID),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // Los `*.node.test.ts` (pdf.js real) van en su propio proyecto: vitest.node.config.ts.
    exclude: [...configDefaults.exclude, 'src/**/*.node.test.ts'],
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

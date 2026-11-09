#!/usr/bin/env node
/* ===========================================================================
   scripts/mcp/empaquetar — el MCP de Concreta Mediciones, listo para descargar.
   ---------------------------------------------------------------------------
   (docs/plan-agente-carpeta.md D5, F2) Deja en `dist/mcp/`, junto a la app:

     concreta-mediciones.mjs          el servidor (y la CLI) en un solo fichero
                                      para Node: sin node_modules
     concreta-mediciones.mcpb         Claude Desktop: doble clic (trae su Node)
     concreta-mediciones-plugin.zip   Claude Code: el plugin (MCP + skill)
     marketplace.json                 Claude Code: el marketplace que lo ofrece,
                                      con la URL y el sha256 del zip
     version.json                     la versión, para la app y para comprobar

   Se ejecuta tras el build de la app (`npm run build`), que vacía `dist/`.
   `npm run mcp` lo ejecuta solo.

   La versión es `<APP_VERSION>.<aaaammddhhmm>`: sube en cada build, y es lo que
   hace que Claude Code ofrezca la actualización del plugin.
   =========================================================================== */
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { zipSync, strToU8 } from 'fflate';
import { build } from 'vite';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SALIDA = join(RAIZ, 'dist', 'mcp');
const NOMBRE = 'concreta-mediciones';
/** Dónde se publica la app (GitHub Pages): el marketplace apunta aquí. */
const URL_BASE = (
  process.env.MCP_URL_BASE ?? 'https://jramirezbandera.github.io/concreta-mediciones/'
).replace(/\/?$/, '/');
const AUTOR = { name: 'Javier Ramírez Bandera', url: 'https://github.com/jramirezbandera' };
const DESCRIPCION =
  'El presupuesto de una obra de Concreta Mediciones (capítulos, partidas, mediciones, precios y certificaciones), desde Claude, sobre el fichero de la obra en su carpeta.';

/** APP_VERSION y SCHEMA_VERSION, leídos del código (una sola fuente). */
function constante(fichero, nombre) {
  const m = new RegExp(`export const ${nombre}\\s*=\\s*'?([\\w.]+)'?`).exec(
    readFileSync(join(RAIZ, fichero), 'utf8'),
  );
  if (!m) throw new Error(`no encuentro ${nombre} en ${fichero}`);
  return m[1];
}
const APP_VERSION = constante('src/persist/persist.ts', 'APP_VERSION');
const SCHEMA_VERSION = Number(constante('src/store/schema.ts', 'SCHEMA_VERSION'));
const ahora = new Date();
const sello = [
  ahora.getUTCFullYear(),
  ahora.getUTCMonth() + 1,
  ahora.getUTCDate(),
  ahora.getUTCHours(),
  ahora.getUTCMinutes(),
]
  .map((n, i) => String(n).padStart(i === 0 ? 4 : 2, '0'))
  .join('');
const VERSION = `${APP_VERSION.split('.').concat('0').slice(0, 2).join('.')}.${sello}`;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/* ---- 1. el .mjs ------------------------------------------------------------ */

const tmp = join(SALIDA, '.build');
rmSync(SALIDA, { recursive: true, force: true });
await build({
  configFile: false,
  root: RAIZ,
  logLevel: 'warn',
  define: {
    __MCP_VERSION__: JSON.stringify(VERSION),
    __APP_BUILD__: JSON.stringify(`mcp-${VERSION}`),
  },
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: 'src/agente/bin.ts',
    outDir: tmp,
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    sourcemap: false,
    reportCompressedSize: false,
    rollupOptions: {
      // zod lleva anotaciones `@__PURE__` donde Rollup no las entiende: solo ruido.
      onwarn(w, avisar) {
        if (w.code !== 'INVALID_ANNOTATION') avisar(w);
      },
      output: {
        format: 'es',
        entryFileNames: `${NOMBRE}.mjs`,
        inlineDynamicImports: true,
        // Las dependencias CommonJS empaquetadas llaman a require: en ESM no existe.
        banner:
          "import { createRequire as __crearRequire } from 'node:module'; const require = __crearRequire(import.meta.url);",
      },
    },
  },
});
const mjs = readFileSync(join(tmp, `${NOMBRE}.mjs`));
rmSync(tmp, { recursive: true, force: true });
mkdirSync(SALIDA, { recursive: true });
writeFileSync(join(SALIDA, `${NOMBRE}.mjs`), mjs);

/* ---- 1b. comprobarlo: el .mjs empaquetado, por stdio, con el cliente del SDK -- */
/* Si el paquete sale roto (una dependencia que no se empaquetó, algo que escribe
   en la salida estándar y rompe el protocolo), el build falla aquí y no se publica. */
{
  const prueba = mkdtempSync(join(tmpdir(), 'mcp-empaquetar-'));
  const transporte = new StdioClientTransport({
    command: process.execPath,
    args: [join(SALIDA, `${NOMBRE}.mjs`)],
    stderr: 'pipe',
  });
  const cliente = new Client({ name: 'empaquetar', version: VERSION });
  try {
    await cliente.connect(transporte);
    const v = cliente.getServerVersion();
    if (v?.name !== NOMBRE || v.version !== VERSION)
      throw new Error(`se presenta como ${JSON.stringify(v)}`);
    const { tools } = await cliente.listTools();
    if (!tools.some((t) => t.name === 'editar')) throw new Error('no publica editar');
    const llamar = async (name, args) => {
      const r = await cliente.callTool({ name, arguments: args });
      const j = JSON.parse(r.content[0].text);
      if (r.isError || !j.ok) throw new Error(`${name}: ${r.content[0].text}`);
      return j;
    };
    await llamar('nueva_obra', { carpeta: prueba, denominacion: 'Comprobación' });
    const e = await llamar('editar', {
      obra: prueba,
      operaciones: [
        { op: 'crear_capitulo', titulo: 'C' },
        {
          op: 'crear_partida',
          capitulo: '1',
          titulo: 'P',
          ud: 'm²',
          precio: 10,
          lineas: [{ uds: 2, largo: 3 }],
        },
      ],
    });
    if (e.pem !== 60) throw new Error(`el PEM de la comprobación es ${e.pem}, no 60`);
  } finally {
    await cliente.close().catch(() => {});
    rmSync(prueba, { recursive: true, force: true });
  }
}

/* ---- 2. el .mcpb (Claude Desktop) ------------------------------------------ */

const guia = readFileSync(join(RAIZ, 'src', 'agente', 'guia.md'), 'utf8');

const manifest = {
  manifest_version: '0.3',
  name: NOMBRE,
  display_name: 'Concreta Mediciones',
  version: VERSION,
  description: DESCRIPCION,
  long_description:
    'Crea y cambia capítulos, partidas y líneas de medición, lee el resumen económico y comprueba qué le falta a un presupuesto de Concreta Mediciones. Trabaja sobre el fichero <obra>.mediciones.json de la carpeta de la obra; la app (en el navegador) lo tiene abierto.',
  author: AUTOR,
  homepage: URL_BASE,
  repository: { type: 'git', url: 'https://github.com/jramirezbandera/concreta-mediciones' },
  license: 'PolyForm-Noncommercial-1.0.0',
  keywords: ['presupuesto', 'mediciones', 'construcción', 'bc3', 'arquitectura'],
  server: {
    type: 'node',
    entry_point: `server/${NOMBRE}.mjs`,
    mcp_config: { command: 'node', args: [`\${__dirname}/server/${NOMBRE}.mjs`] },
  },
  compatibility: { platforms: ['win32', 'darwin', 'linux'], runtimes: { node: '>=20.0.0' } },
  // Las herramientas las da el servidor al conectarse (tools/list).
  tools_generated: true,
};
const mcpb = zipSync(
  {
    'manifest.json': strToU8(`${JSON.stringify(manifest, null, 2)}\n`),
    server: { [`${NOMBRE}.mjs`]: mjs },
  },
  { level: 9 },
);
writeFileSync(join(SALIDA, `${NOMBRE}.mcpb`), mcpb);

/* ---- 3. el plugin y su marketplace (Claude Code) --------------------------- */

const plugin = {
  name: NOMBRE,
  version: VERSION,
  description: DESCRIPCION,
  author: AUTOR,
  homepage: URL_BASE,
  repository: 'https://github.com/jramirezbandera/concreta-mediciones',
  license: 'PolyForm-Noncommercial-1.0.0',
  keywords: ['presupuesto', 'mediciones', 'construcción', 'bc3'],
};
const mcpJson = {
  mcpServers: {
    [NOMBRE]: { command: 'node', args: [`\${CLAUDE_PLUGIN_ROOT}/server/${NOMBRE}.mjs`] },
  },
};
const zipPlugin = zipSync(
  {
    '.claude-plugin': { 'plugin.json': strToU8(`${JSON.stringify(plugin, null, 2)}\n`) },
    '.mcp.json': strToU8(`${JSON.stringify(mcpJson, null, 2)}\n`),
    server: { [`${NOMBRE}.mjs`]: mjs },
    skills: { mediciones: { 'SKILL.md': strToU8(guia) } },
  },
  { level: 9 },
);
writeFileSync(join(SALIDA, `${NOMBRE}-plugin.zip`), zipPlugin);

const marketplace = {
  name: 'concreta',
  owner: { name: AUTOR.name },
  description: 'Herramientas de Concreta para Claude Code.',
  plugins: [
    {
      name: NOMBRE,
      description: DESCRIPCION,
      version: VERSION,
      source: {
        source: 'archive',
        url: `${URL_BASE}mcp/${NOMBRE}-plugin.zip`,
        sha256: sha256(zipPlugin),
      },
      category: 'productivity',
      tags: ['presupuesto', 'mediciones', 'construcción'],
    },
  ],
};
writeFileSync(join(SALIDA, 'marketplace.json'), `${JSON.stringify(marketplace, null, 2)}\n`);

/* ---- 4. la versión ----------------------------------------------------------- */

const version = {
  version: VERSION,
  appVersion: APP_VERSION,
  schemaVersion: SCHEMA_VERSION,
  generado: ahora.toISOString(),
  ficheros: {
    [`${NOMBRE}.mjs`]: { bytes: mjs.length, sha256: sha256(mjs) },
    [`${NOMBRE}.mcpb`]: { bytes: mcpb.length, sha256: sha256(mcpb) },
    [`${NOMBRE}-plugin.zip`]: { bytes: zipPlugin.length, sha256: sha256(zipPlugin) },
  },
};
writeFileSync(join(SALIDA, 'version.json'), `${JSON.stringify(version, null, 2)}\n`);

const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(`MCP ${VERSION} (esquema ${SCHEMA_VERSION}) en ${SALIDA}`);
for (const [f, x] of Object.entries(version.ficheros))
  console.log(`  ${f.padEnd(34)} ${kb(x.bytes)}`);

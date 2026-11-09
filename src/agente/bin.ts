/* ===========================================================================
   agente/bin — punto de entrada de `concreta-mediciones.mjs`.
   ---------------------------------------------------------------------------
     node concreta-mediciones.mjs                     el servidor MCP por stdio
     node concreta-mediciones.mjs <orden> [--k v…]    la CLI (`agente/cli`)
   =========================================================================== */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { cli } from './cli';
import { servir } from './mcp';

declare const __MCP_VERSION__: string;
/** La versión del paquete (la pone el empaquetado, `scripts/mcp/empaquetar.mjs`). */
const VERSION = typeof __MCP_VERSION__ === 'string' ? __MCP_VERSION__ : '0.0.0-dev';

const argv = process.argv.slice(2);
if (argv.length === 0) {
  // MCP: la salida estándar es solo del protocolo; cualquier otro mensaje, a la de errores.
  console.log =
    console.info =
    console.warn =
    console.debug =
      (...x: unknown[]) => console.error(...x);
  servir(VERSION, new StdioServerTransport()).catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  });
} else {
  const r = cli(argv, VERSION);
  if (r.salida) process.stdout.write(r.salida);
  if (r.errores) process.stderr.write(r.errores);
  process.exitCode = r.codigo;
}

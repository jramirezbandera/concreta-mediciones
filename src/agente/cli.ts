/* ===========================================================================
   agente/cli — la CLI de `concreta-mediciones.mjs` (las mismas órdenes que el MCP).
   ---------------------------------------------------------------------------
     node concreta-mediciones.mjs <orden> [--clave valor…]
     node concreta-mediciones.mjs ayuda

   Cada `--clave valor` es un argumento de la orden. El valor se lee como JSON si
   lo es (números, true, listas) y, si no, como texto; `@ruta` lee el JSON de un
   fichero (las operaciones de editar, sin pelearse con las comillas de
   PowerShell). Sin valor, la clave vale true.
   =========================================================================== */
import { readFileSync } from 'node:fs';
import { ORDENES, autorDeEstaSesion, ejecutar } from './ordenes';

/** Lee los argumentos de la CLI. */
export function argumentosCli(argv: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]!;
    if (!k.startsWith('--') || k.length === 2)
      throw new Error(`argumento suelto: «${k}» (van como --clave valor)`);
    const clave = k.slice(2);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) {
      out[clave] = true;
      continue;
    }
    i++;
    if (v.startsWith('@')) {
      out[clave] = JSON.parse(readFileSync(v.slice(1), 'utf8'));
      continue;
    }
    try {
      out[clave] = JSON.parse(v);
    } catch {
      out[clave] = v;
    }
  }
  return out;
}

export function ayuda(version: string): string {
  const lineas = ORDENES.map((o) => {
    const props = Object.keys((o.entrada.properties as Record<string, unknown>) ?? {});
    return `  ${o.nombre.padEnd(12)} ${props.map((p) => `--${p}`).join(' ')}`;
  });
  return [
    `concreta-mediciones ${version}`,
    '',
    'Sin argumentos: el servidor MCP por stdio.',
    '',
    'Órdenes:',
    ...lineas,
    '',
  ].join('\n');
}

/** Ejecuta la CLI: el código de salida y lo que se escribe (salida y errores). */
export function cli(
  argv: string[],
  version: string,
): { codigo: number; salida: string; errores: string } {
  const [orden, ...resto] = argv;
  if (!orden || orden === 'ayuda' || orden === '--help' || orden === '-h')
    return { codigo: 0, salida: ayuda(version), errores: '' };
  if (orden === '--version') return { codigo: 0, salida: `${version}\n`, errores: '' };
  let args: Record<string, unknown>;
  try {
    args = argumentosCli(resto);
  } catch (e) {
    return { codigo: 2, salida: '', errores: `${e instanceof Error ? e.message : String(e)}\n` };
  }
  const s = ejecutar(orden, args, { autor: autorDeEstaSesion('cli') });
  return { codigo: s.ok ? 0 : 1, salida: `${JSON.stringify(s, null, 2)}\n`, errores: '' };
}

/* ===========================================================================
   agente/mcp — el servidor MCP de Concreta Mediciones (stdio).
   ---------------------------------------------------------------------------
   (docs/plan-agente-carpeta.md D5, F2)

   Publica las órdenes de `agente/ordenes` como herramientas, tal cual: misma
   entrada, misma salida (JSON en texto; `isError` cuando `ok` es false). La guía
   va en las instrucciones de `initialize`, en el recurso `mediciones://guia` y en
   la herramienta `guia`, porque no todos los clientes leen las instrucciones.

   Con el SDK oficial (MIT), empaquetado dentro del `.mjs`: lo instalan usuarios
   con versiones de cliente que no controlamos, y el SDK sigue al protocolo.
   =========================================================================== */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { NOMBRE_MCP, ORDENES, URL_APP, ejecutar, textoGuia } from './ordenes';

const RECURSO_GUIA = 'mediciones://guia';

const PREAMBULO = `Concreta Mediciones por MCP: el presupuesto de una obra (capítulos, partidas, mediciones, precios y certificaciones) en un fichero <obra>.mediciones.json de su carpeta, que el técnico tiene abierto en la app (${URL_APP}). Las rutas, absolutas. Lee la obra con obra, resumen, arbol y partida; cámbiala solo con editar; comprueba con validar. Los precios y las mediciones no se inventan.

`;

/** El servidor, sin transporte (las pruebas lo conectan en memoria). */
export function crearServidor(version: string): Server {
  const servidor = new Server(
    { name: NOMBRE_MCP, title: 'Concreta Mediciones', version },
    { capabilities: { tools: {}, resources: {} }, instructions: PREAMBULO + textoGuia() },
  );

  servidor.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ORDENES.map((o) => ({
      name: o.nombre,
      description: o.descripcion,
      inputSchema: o.entrada as { type: 'object' },
      annotations: { readOnlyHint: o.soloLectura, destructiveHint: false, openWorldHint: false },
    })),
  }));

  servidor.setRequestHandler(CallToolRequestSchema, async (req) => {
    const salida = ejecutar(req.params.name, req.params.arguments ?? {});
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(salida) }],
      isError: !salida.ok,
    };
  });

  servidor.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      { uri: RECURSO_GUIA, name: 'Guía de Concreta Mediciones', mimeType: 'text/markdown' },
    ],
  }));

  servidor.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    if (req.params.uri !== RECURSO_GUIA) throw new Error(`no hay ningún recurso ${req.params.uri}`);
    return { contents: [{ uri: RECURSO_GUIA, mimeType: 'text/markdown', text: textoGuia() }] };
  });

  return servidor;
}

/** Conecta el servidor a un transporte (stdio en el `.mjs`). */
export async function servir(version: string, transporte: Transport): Promise<Server> {
  const s = crearServidor(version);
  await s.connect(transporte);
  return s;
}

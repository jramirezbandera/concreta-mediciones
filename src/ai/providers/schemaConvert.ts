/* ===========================================================================
   ai/providers/schemaConvert — adapta el schema canónico al dialecto de OpenAI.
   ---------------------------------------------------------------------------
   El schema canónico (`schema.ts`) declara los campos anulables como
   `type: ['X', 'null']`, con `null` dentro del `enum` cuando lo hay. Gemini lo
   acepta tal cual (`responseJsonSchema`); OpenAI `strict: true` SÍ admite la unión
   en `type` pero NO admite `null` dentro de un array `enum` (la guía de Structured
   Outputs usa `{ "type": ["string","null"], "enum": [...sin null] }`).

   Porta SOLO el conversor de OpenAI de concreta-v2: Anthropic no se soporta en
   Mediciones (el envelope `{reply, ops}` tiene 21 campos con unión y su tope duro
   son 16 → siempre rechazaría; decisión de F-A5). El conversor recorre
   `properties`, `items` y `anyOf` a cualquier profundidad y NO muta su entrada.
   =========================================================================== */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Copia un nodo recorriendo sus hijos estructurales (properties / items / anyOf). */
function convertChildren(
  node: Record<string, unknown>,
  convertNode: (child: unknown) => unknown,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...node };
  if (isRecord(node.properties)) {
    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node.properties)) {
      properties[key] = convertNode(value);
    }
    out.properties = properties;
  }
  if (node.items !== undefined) {
    out.items = Array.isArray(node.items) ? node.items.map(convertNode) : convertNode(node.items);
  }
  if (Array.isArray(node.anyOf)) {
    out.anyOf = node.anyOf.map(convertNode);
  }
  return out;
}

function convertOpenAiNode(node: unknown): unknown {
  if (!isRecord(node)) return node;
  const out = convertChildren(node, convertOpenAiNode);
  if (Array.isArray(out.enum)) {
    out.enum = out.enum.filter((v) => v !== null);
  }
  return out;
}

/**
 * Adapta un schema canónico al validador `strict: true` de OpenAI: conserva los
 * `type` array (forma documentada para campos anulables) pero elimina `null` de
 * cualquier array `enum`, a cualquier profundidad. No muta el schema de entrada.
 */
export function toOpenAiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  return convertOpenAiNode(schema) as Record<string, unknown>;
}

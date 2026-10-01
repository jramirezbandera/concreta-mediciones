import { describe, expect, it } from 'vitest';
import { CHAT_ENVELOPE_SCHEMA } from './schema';

type Node = { type?: unknown; properties?: Record<string, Node>; required?: string[]; items?: Node };

/** Todos los nodos objeto del schema, a cualquier profundidad. */
function objectNodes(node: Node, out: Node[] = []): Node[] {
  if (node.properties) {
    out.push(node);
    for (const child of Object.values(node.properties)) objectNodes(child, out);
  }
  if (node.items) objectNodes(node.items, out);
  return out;
}

describe('CHAT_ENVELOPE_SCHEMA', () => {
  it('cada objeto declara TODAS sus propiedades en required (Gemini omite las opcionales; OpenAI strict lo exige)', () => {
    const nodes = objectNodes(CHAT_ENVELOPE_SCHEMA as Node);
    expect(nodes.length).toBe(3); // envelope, op, línea
    for (const n of nodes) {
      expect([...(n.required ?? [])].sort()).toEqual(Object.keys(n.properties!).sort());
    }
  });

  it('en la op, titulo y ud van antes que lo largo (descripcion, lineas)', () => {
    const op = (CHAT_ENVELOPE_SCHEMA as Node).properties!.ops!.items!;
    const keys = Object.keys(op.properties!);
    expect(keys[0]).toBe('op');
    expect(keys.indexOf('titulo')).toBeLessThan(keys.indexOf('descripcion'));
    expect(keys.indexOf('ud')).toBeLessThan(keys.indexOf('lineas'));
  });
});

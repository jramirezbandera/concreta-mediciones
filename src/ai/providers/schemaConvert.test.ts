import { describe, expect, it } from 'vitest';
import { toOpenAiSchema } from './schemaConvert';
import { CHAT_ENVELOPE_SCHEMA } from '../schema';

type Node = Record<string, unknown>;
const at = (n: Node, ...path: string[]): Node => path.reduce<Node>((acc, k) => acc[k] as Node, n);

describe('toOpenAiSchema', () => {
  it('conserva los `type` array (forma OpenAI de campos anulables)', () => {
    const out = toOpenAiSchema({ type: 'object', properties: { a: { type: ['string', 'null'] } } });
    expect(at(out, 'properties', 'a').type).toEqual(['string', 'null']);
  });

  it('elimina null de los `enum` a cualquier profundidad', () => {
    const out = toOpenAiSchema({
      type: 'object',
      properties: {
        modo: { type: ['string', 'null'], enum: ['origen', 'esta', null] },
        nested: {
          type: 'object',
          properties: { x: { type: ['string', 'null'], enum: ['a', null] } },
        },
      },
    });
    expect(at(out, 'properties', 'modo').enum).toEqual(['origen', 'esta']);
    expect(at(out, 'properties', 'nested', 'properties', 'x').enum).toEqual(['a']);
  });

  it('recorre los items de un array', () => {
    const out = toOpenAiSchema({
      type: 'object',
      properties: {
        lineas: {
          type: ['array', 'null'],
          items: { type: 'object', properties: { m: { type: ['string', 'null'], enum: ['a', null] } } },
        },
      },
    });
    expect(at(out, 'properties', 'lineas', 'items', 'properties', 'm').enum).toEqual(['a']);
  });

  it('NO muta el schema de entrada', () => {
    const input = {
      type: 'object',
      properties: { modo: { type: ['string', 'null'], enum: ['origen', null] } },
    };
    const snap = JSON.stringify(input);
    toOpenAiSchema(input);
    expect(JSON.stringify(input)).toBe(snap);
  });

  it('sobre el envelope real: modo/ambito pierden null y conservan el type array', () => {
    const out = toOpenAiSchema(CHAT_ENVELOPE_SCHEMA);
    const op = at(out, 'properties', 'ops', 'items', 'properties');
    expect(at(op, 'modo').enum).toEqual(['origen', 'esta']);
    expect(at(op, 'ambito').enum).toEqual(['obra', 'capitulo', 'subarbol', 'visible']);
    expect(at(op, 'ref').type).toEqual(['string', 'null']);
  });
});

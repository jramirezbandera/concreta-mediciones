import { describe, expect, it } from 'vitest';
import { reusar } from './reusar';

describe('reusar', () => {
  it('lo igual por contenido conserva la referencia vieja; lo cambiado, la nueva', () => {
    const viejo = { a: { x: 1 }, b: [{ id: 1 }, { id: 2 }], c: 'hola' };
    const nuevo = { a: { x: 1 }, b: [{ id: 1 }, { id: 3 }], c: 'hola' };
    const r = reusar(viejo, nuevo);
    expect(r).toEqual(nuevo);
    expect(r).not.toBe(viejo);
    expect(r.a).toBe(viejo.a);
    expect(r.b).not.toBe(viejo.b);
    expect(r.b[0]).toBe(viejo.b[0]);
    expect(r.b[1]).toEqual({ id: 3 });
  });

  it('todo igual devuelve el viejo entero, aunque las claves vengan en otro orden', () => {
    const viejo = { a: 1, b: { c: [1, 2], d: null } };
    expect(reusar(viejo, { b: { d: null, c: [1, 2] }, a: 1 })).toBe(viejo);
  });

  it('una clave undefined equivale a no tenerla; una que falta, no', () => {
    const viejo = { a: 1 };
    expect(reusar(viejo, { a: 1, b: undefined })).toBe(viejo);
    expect(reusar({ a: 1, b: 2 }, { a: 1 })).toEqual({ a: 1 });
    expect(reusar([1, 2, 3], [1, 2])).toEqual([1, 2]);
  });
});

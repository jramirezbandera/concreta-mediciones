import { beforeEach, describe, expect, it } from 'vitest';
import type { RefCopyItem, RefPartida } from '../core/refdata';
import { useObraStore } from './obraStore';

const state = () => useObraStore.getState();

/** Item de copia cuya descomposición usa `code` a `precio` (para forzar colisión). */
function refItem(code: string, precio: number): RefCopyItem {
  return {
    sourceName: 'Otra obra',
    partida: {
      id: 'rx',
      pos: '9.9',
      code: 'NEW',
      title: 'Partida copiada',
      ud: 'm',
      precio: 99,
      items: [{ code, type: 'MO', cantidad: 1, desc: 'Recurso', ud: 'h', precio }],
    } as RefPartida,
  };
}

const copied = () => state().partidas['01']!.find((p) => p.code === 'NEW');

beforeEach(() => {
  state().reset(); // obra demo: banco con mo001 @ 17,52; capítulo activo '01'
});

describe('copia entre obras · preflight de colisión', () => {
  it('sin colisión (código nuevo): copia directa, sin pendingCopy', () => {
    const before = state().partidas['01']!.length;
    state().requestCopyRefPartidas([refItem('codigo-nuevo', 5)], null, false);
    expect(state().pendingCopy).toBeNull();
    expect(state().partidas['01']!.length).toBe(before + 1);
    expect(state().recursos['codigo-nuevo']!.precio).toBe(5);
  });

  it('colisión de precio: deja pendingCopy y NO copia todavía', () => {
    const before = state().partidas['01']!.length;
    state().requestCopyRefPartidas([refItem('mo001', 20)], null, false);
    expect(state().pendingCopy).not.toBeNull();
    expect(state().pendingCopy!.collisions.map((c) => c.code)).toContain('mo001');
    expect(state().partidas['01']!.length).toBe(before);
  });

  it('resolver MERGE: mantiene el precio existente; el item usa el código original', () => {
    state().requestCopyRefPartidas([refItem('mo001', 20)], null, false);
    state().resolveCopyRefPartidas({ mo001: 'merge' });
    expect(state().pendingCopy).toBeNull();
    expect(state().recursos['mo001']!.precio).toBe(17.52); // sin pisar el banco
    expect(copied()!.items[0]!.code).toBe('mo001');
  });

  it('resolver FORK: crea código derivado con el precio entrante; el existente intacto', () => {
    state().requestCopyRefPartidas([refItem('mo001', 20)], null, false);
    state().resolveCopyRefPartidas({ mo001: 'fork' });
    expect(state().recursos['mo001']!.precio).toBe(17.52); // intacto
    expect(state().recursos['mo001~2']!.precio).toBe(20); // bifurcado conserva el de origen
    expect(copied()!.items[0]!.code).toBe('mo001~2'); // el item apunta al derivado
  });

  it('la desc copiada usa la de la partida origen, no la canónica del código base', () => {
    // 'ADE010' SÍ está en REF_DESC; sin la corrección, la copia tomaría ese texto.
    const it: RefCopyItem = {
      sourceName: 'Otra obra',
      partida: {
        id: 'rd',
        pos: '9.9',
        code: 'ADE010',
        title: 'X',
        ud: 'm³',
        precio: 50,
        desc: 'Mi descripción editada',
        items: [],
      } as RefPartida,
    };
    state().requestCopyRefPartidas([it], null, false); // sin items → sin colisión → copia directa
    expect(state().partidas['01']!.find((p) => p.code === 'ADE010')!.desc).toBe(
      'Mi descripción editada',
    );
  });

  it('cancelar limpia pendingCopy sin copiar', () => {
    const before = state().partidas['01']!.length;
    state().requestCopyRefPartidas([refItem('mo001', 20)], null, false);
    state().cancelCopyRefPartidas();
    expect(state().pendingCopy).toBeNull();
    expect(state().partidas['01']!.length).toBe(before);
  });
});

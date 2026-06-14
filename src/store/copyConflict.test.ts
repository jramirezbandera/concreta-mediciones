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

  it('bifurcar un recurso YA bifurcado no encadena el sufijo (~3, no ~2~2)', () => {
    state().requestCopyRefPartidas([refItem('mo001', 20)], null, false);
    state().resolveCopyRefPartidas({ mo001: 'fork' }); // crea mo001~2 @ 20
    state().requestCopyRefPartidas([refItem('mo001~2', 30)], null, false); // choca con mo001~2
    state().resolveCopyRefPartidas({ 'mo001~2': 'fork' });
    expect(state().recursos['mo001~3']!.precio).toBe(30); // siguiente libre de la base
    expect(state().recursos['mo001~2~2']).toBeUndefined(); // no se encadena
  });

  it('cancelar limpia pendingCopy sin copiar', () => {
    const before = state().partidas['01']!.length;
    state().requestCopyRefPartidas([refItem('mo001', 20)], null, false);
    state().cancelCopyRefPartidas();
    expect(state().pendingCopy).toBeNull();
    expect(state().partidas['01']!.length).toBe(before);
  });
});

describe('procedencia (base vs portapapeles)', () => {
  it('base (Referencia): copia directa marca chip BASE + baseSource', () => {
    state().requestCopyRefPartidas([refItem('codigo-nuevo', 5)], null, false); // default 'base'
    expect(copied()!.fromBase).toBe(true);
    expect(copied()!.baseSource).toBe('Otra obra');
  });

  it("clip (portapapeles): copia directa SIN chip BASE ni baseSource (partida limpia)", () => {
    state().requestCopyRefPartidas([refItem('codigo-nuevo', 5)], null, false, 'clip');
    expect(copied()!.fromBase).toBeUndefined();
    expect(copied()!.baseSource).toBeUndefined();
  });

  it('clip: la procedencia SOBREVIVE la resolución de colisión (no reaparece BASE)', () => {
    state().requestCopyRefPartidas([refItem('mo001', 20)], null, false, 'clip');
    expect(state().pendingCopy!.provenance).toBe('clip');
    state().resolveCopyRefPartidas({ mo001: 'merge' });
    expect(copied()!.fromBase).toBeUndefined();
    expect(copied()!.baseSource).toBeUndefined();
  });

  it('target CONGELADO: pega en el destino dado aunque cambie el activo entremedias', () => {
    // pegar en sub explícito '01' (cap) con colisión → pendingCopy guarda target
    state().setActive('02'); // el usuario cambia de capítulo activo...
    state().requestCopyRefPartidas([refItem('mo001', 20)], { chId: '01', subId: null }, false, 'clip');
    state().setActive('03'); // ...y vuelve a cambiar mientras el modal está abierto
    state().resolveCopyRefPartidas({ mo001: 'merge' });
    // aterriza en '01' (target congelado), no en el capítulo activo actual ('03')
    expect(state().partidas['01']!.some((p) => p.code === 'NEW')).toBe(true);
    expect((state().partidas['03'] ?? []).some((p) => p.code === 'NEW')).toBe(false);
  });
});

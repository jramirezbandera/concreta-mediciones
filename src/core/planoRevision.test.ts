import { describe, expect, it } from 'vitest';
import a1 from '../test/fixtures/planos/obra-v6-a1.json';
import type { Caja } from './planoGeom';
import { encajaEnPaginas, nombreConRevision, paginasConGeometria, revisionMasNueva, siguienteRevision } from './planoRevision';
import type { PartidasMap, PlanoMeta } from './types';

const obra = a1 as unknown as { planos: PlanoMeta[]; partidas: PartidasMap };
const A3: Caja = [0, 0, 1190.55, 841.89];

describe('siguienteRevision', () => {
  it('la letra o el número siguiente; sin revisión, la B', () => {
    expect(siguienteRevision(undefined)).toBe('Rev. B');
    expect(siguienteRevision('  ')).toBe('Rev. B');
    expect(siguienteRevision('Rev. A')).toBe('Rev. B');
    expect(siguienteRevision('rev. c')).toBe('rev. d');
    expect(siguienteRevision('B')).toBe('C');
    expect(siguienteRevision('Rev. 2')).toBe('Rev. 3');
    expect(siguienteRevision('R09')).toBe('R10');
    expect(siguienteRevision('Rev')).toBe('Rev.1'); // «v» no es una revisión suelta
    expect(siguienteRevision('Rev. Z')).toBe('Rev. Z.1');
  });

  it('el nombre con su revisión', () => {
    expect(nombreConRevision({ nombre: 'Planta primera', revision: 'Rev. B' })).toBe('Planta primera · Rev. B');
    expect(nombreConRevision({ nombre: 'Cubierta' })).toBe('Cubierta');
  });
});

describe('revisionMasNueva', () => {
  it('la del fixture: Rev. A → Rev. B; la B no tiene más nueva', () => {
    expect(revisionMasNueva(obra.planos, 'pl-p1')?.id).toBe('pl-p1b');
    expect(revisionMasNueva(obra.planos, 'pl-p1b')).toBeNull();
    expect(revisionMasNueva(obra.planos, 'pl-cub')).toBeNull();
  });

  it('sigue la cadena, también por una revisión quitada, y solo devuelve una viva', () => {
    const base = obra.planos[0]!;
    const b = { ...base, id: 'b', sustituye: base.id, revision: 'Rev. B', quitado: '2026-09-28T00:00:00.000Z' };
    const c = { ...base, id: 'c', sustituye: 'b', revision: 'Rev. C' };
    expect(revisionMasNueva([base, b, c], base.id)?.id).toBe('c');
    expect(revisionMasNueva([base, b], base.id)).toBeNull();
  });

  it('sin bucles aunque los datos los tengan', () => {
    const base = obra.planos[0]!;
    const x = { ...base, id: 'x', sustituye: 'y' };
    const y = { ...base, id: 'y', sustituye: 'x' };
    expect(revisionMasNueva([x, y], 'x')?.id).toBe('y');
  });
});

describe('encajaEnPaginas (Usar este PDF para este plano)', () => {
  const p1 = obra.planos[0]!;

  it('las páginas con geometría: escalas y formas medidas', () => {
    expect(paginasConGeometria(p1, obra.partidas)).toEqual([1]);
  });

  it('mismas páginas y todo dentro: encaja', () => {
    expect(encajaEnPaginas(p1, obra.partidas, 1, new Map([[1, A3]]))).toBe(true);
  });

  it('otro número de páginas, una página más pequeña o sin su caja: no encaja', () => {
    expect(encajaEnPaginas(p1, obra.partidas, 2, new Map([[1, A3]]))).toBe(false);
    expect(encajaEnPaginas(p1, obra.partidas, 1, new Map([[1, [0, 0, 595.28, 420.94] as Caja]]))).toBe(false);
    expect(encajaEnPaginas(p1, obra.partidas, 1, new Map())).toBe(false);
  });
});

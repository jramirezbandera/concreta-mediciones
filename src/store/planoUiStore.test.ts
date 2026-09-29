/* [A1] El borrador del visor (§5.8): `reconciliar` lo descarta, y dice por
   qué, si cambió la obra, se quitó su plano o cambió la escala de su página. */
import { beforeEach, describe, expect, it } from 'vitest';
import type { Escala, PlanoMeta } from '../core/types';
import { usePlanoUiStore, type Borrador } from './planoUiStore';

const escala = (rev: string): Escala => ({
  rev,
  mPorUnidad: 0.0176,
  n: 50,
  ref: { a: [0, 0], b: [100, 0], metros: 1.76 },
  comprobacion: { fuente: 'cota', a: [0, 0], b: [0, 100], metros: 1.76, medidos: 1.76, desviacion: 0 },
  at: '2026-09-29T10:00:00.000Z',
});
const plano = (extra: Partial<PlanoMeta> = {}): PlanoMeta => ({
  id: 'pl',
  tipo: 'pdf',
  nombre: 'P',
  archivo: 'p.pdf',
  tamano: 1,
  huella: 'a'.repeat(64),
  paginas: 2,
  escalas: { 2: escala('r1') },
  ...extra,
});
const borrador: Borrador = {
  docToken: 'doc',
  planoId: 'pl',
  pagina: 2,
  partidaId: 'p-1',
  calRev: 'r1',
  restar: false,
  forma: { fase: 'dibujando', armada: 'longitud', puntos: [[0, 0]], sustituye: null, cruce: false },
  espera: 'vista',
};
const ui = () => usePlanoUiStore.getState();

beforeEach(() => {
  ui().reset();
  usePlanoUiStore.setState({ docToken: 'doc' });
  ui().guardarBorrador(borrador);
});

describe('reconciliar y el borrador', () => {
  it('sigue valiendo con la misma obra, su plano y la misma escala', () => {
    expect(ui().reconciliar([plano()], 'doc')).toBeNull();
    expect(ui().borrador).toEqual(borrador);
  });

  it('otra obra lo descarta', () => {
    expect(ui().reconciliar([plano()], 'otra')).toBe('obra');
    expect(ui().borrador).toBeNull();
  });

  it('su plano quitado (o que ya no está, o sin su página) lo descarta', () => {
    expect(ui().reconciliar([plano({ quitado: '2026-09-29T10:00:00.000Z' })], 'doc')).toBe('plano');
    ui().guardarBorrador(borrador);
    expect(ui().reconciliar([], 'doc')).toBe('plano');
    ui().guardarBorrador(borrador);
    expect(ui().reconciliar([plano({ paginas: 1 })], 'doc')).toBe('plano');
  });

  it('otra escala en su página (recalibrar o deshacer) lo descarta; en otra página, no', () => {
    expect(ui().reconciliar([plano({ escalas: { 1: escala('r9'), 2: escala('r1') } })], 'doc')).toBeNull();
    expect(ui().reconciliar([plano({ escalas: { 2: escala('r2') } })], 'doc')).toBe('escala');
    ui().guardarBorrador(borrador);
    expect(ui().reconciliar([plano({ escalas: {} })], 'doc')).toBe('escala');
  });
});

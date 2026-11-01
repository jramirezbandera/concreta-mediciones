/* v12: qué era cada línea certificada (`Cert.lineSnap`). */
import { beforeEach, describe, expect, it } from 'vitest';
import type { MedLine, Partida } from '../core/types';
import { SCHEMA_VERSION, blankObraData, fromSerializable, type ObraData } from './schema';
import { useObraStore } from './obraStore';

const state = () => useObraStore.getState();
const linea = (id: string, comment: string, largo: number): MedLine => ({ id, comment, uds: 2, largo, ancho: '', alto: '' });
const partida: Partida = {
  id: 'p1',
  pos: '1.1',
  code: 'A',
  title: 'Tabique',
  ud: 'm',
  precio: 10,
  desc: '',
  med: [linea('m1', 'Salón', 4), linea('m2', 'Cocina', 3)],
  items: [],
};

beforeEach(() => {
  const d = blankObraData('Cert');
  d.chapters = [{ id: 'a', code: '1', title: 'Albañilería' }];
  d.partidas = { a: [structuredClone(partida)] };
  state().loadObra(d);
  state().setCurCert(0);
});

const snap = () => state().certs[state().curCert]!.lineSnap;

describe('Cert.lineSnap', () => {
  it('marcar congela comentario y dimensiones; desmarcar lo suelta', () => {
    state().setCertLine('p1', 'm1', 8);
    expect(snap()).toEqual({ p1: { m1: { comment: 'Salón', dims: [2, 4, '', ''] } } });
    state().setCertLine('p1', 'm1', null);
    expect(snap()).toBeUndefined();
  });

  it('cambiar la línea después no toca lo congelado', () => {
    state().setCertLine('p1', 'm1', 8);
    state().editMedLine('a', 'p1', 0, 'comment', 'Salón-comedor');
    expect(snap()!.p1!.m1!.comment).toBe('Salón');
  });

  it('completar congela todas; teclear la cantidad (override) suelta el congelado', () => {
    state().completePartida('p1');
    expect(Object.keys(snap()!.p1!)).toEqual(['m1', 'm2']);
    state().onCertEdit('p1', 5, 'origen');
    expect(snap()).toBeUndefined();
  });

  it('la certificación siguiente lo hereda, como las cantidades', () => {
    state().setCertLine('p1', 'm2', 6);
    state().addCert();
    const nueva = state().certs.at(-1)!;
    expect(nueva.lineSnap).toEqual({ p1: { m2: { comment: 'Cocina', dims: [2, 3, '', ''] } } });
    expect(nueva.lineSnap).not.toBe(state().certs.at(-2)!.lineSnap);
  });
});

describe('v11 → v12', () => {
  it('rellena el congelado de las líneas marcadas que aún existen', () => {
    const v11 = { ...blankObraData(), schemaVersion: 11 } as ObraData;
    v11.chapters = [{ id: 'a', code: '1', title: 'A' }];
    v11.partidas = { a: [structuredClone(partida)] };
    v11.certs = [{ id: 'c1', num: 1, period: '', retencion: 0, data: { p1: 8 }, lineQty: { p1: { m1: 8, borrada: 3 } } }];
    const d = fromSerializable(structuredClone(v11));
    expect(d.schemaVersion).toBe(SCHEMA_VERSION);
    expect(d.certs[0]!.lineSnap).toEqual({ p1: { m1: { comment: 'Salón', dims: [2, 4, '', ''] } } });
  });

  it('sin certificación por líneas no añade nada', () => {
    const v11 = { ...blankObraData(), schemaVersion: 11 } as ObraData;
    expect(fromSerializable(structuredClone(v11))).toEqual({ ...v11, schemaVersion: SCHEMA_VERSION });
  });
});

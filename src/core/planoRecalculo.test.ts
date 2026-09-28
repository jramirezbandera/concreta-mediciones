/* Recalcular al cambiar la escala de una página (§4.4): candidatas, las que
   quedan aparte y el cambio de cantidad por partida, sobre el fixture A0. */
import { describe, expect, it } from 'vitest';
import a0 from '../test/fixtures/planos/obra-v6-a0.json';
import { fromSerializable, type ObraData } from '../store/schema';
import { escalaDe } from './planoDatos';
import { lineasConOtraEscala, planRecalculo, recalcularLinea } from './planoRecalculo';
import type { Cert, Escala, MedLine, OrigenConEscala, Partida } from './types';

const obra = (): ObraData => fromSerializable(structuredClone(a0) as never);
const linea = (o: ObraData, id: string): MedLine =>
  Object.values(o.partidas)
    .flat()
    .flatMap((p) => p.med)
    .find((l) => l.id === id)!;
const partida = (o: ObraData, id: string): Partida => Object.values(o.partidas).flat().find((p) => p.id === id)!;

/** La escala del fixture (1:50) a la mitad: 1:100, cada longitud ×2. */
const doble = (o: ObraData): Escala => {
  const e = escalaDe(o.planos[0]!, 1)!;
  return { ...structuredClone(e), rev: 'cal-p1-2', mPorUnidad: e.mPorUnidad * 2, n: 100 };
};

describe('recalcularLinea', () => {
  it('tramos, `expr`, `origen` (valores, mPorUnidad, calRev, n) y `uds` intacto', () => {
    const o = obra();
    const e = doble(o);
    const l = recalcularLinea(linea(o, 'l-tabique'), e);
    expect(l.expr).toEqual({ largo: '6,4+8,3+4,2' });
    expect(l.largo).toBe(18.9);
    expect(l.uds).toBe(1);
    expect(l.origen).toMatchObject({ valores: { largo: 18.9 }, mPorUnidad: e.mPorUnidad, calRev: 'cal-p1-2', n: 100 });
  });

  it('un área escala al cuadrado y va sin `expr`; un hueco conserva su signo', () => {
    const o = obra();
    expect(recalcularLinea(linea(o, 'l-salon'), doble(o)).largo).toBe(80);
    const hueco = recalcularLinea(linea(o, 'l-hueco'), doble(o));
    expect(hueco.uds).toBe(-1);
    expect(hueco.expr).toEqual({ largo: '2,4×1,6' });
  });

  it('«(tramos)×h» recalcula los tramos y conserva la h; el kg/m fijo no se toca', () => {
    const o = obra();
    expect(recalcularLinea(linea(o, 'l-pintura-tab'), doble(o)).expr).toEqual({ largo: '(6,4+8,3+4,2)×2,7' });
    const viga = recalcularLinea(linea(o, 'l-viga'), doble(o));
    expect(viga).toMatchObject({ largo: 12, ancho: 42.2, expr: { largo: '12', ancho: 'IPE 300' } });
  });
});

describe('planRecalculo', () => {
  it('candidatas: las líneas con escala de la página (no Recuento), agrupadas por su escala antigua', () => {
    const o = obra();
    const plan = planRecalculo(o, o.planos[0]!.id, 1, doble(o));
    expect(plan.candidatas.map((c) => c.lineId).sort()).toEqual(
      ['l-dorm1', 'l-hueco', 'l-pintura-tab', 'l-salon', 'l-tabique', 'l-viga'].sort(),
    );
    expect(plan.porEscala).toEqual([{ n: 50, lineas: 6 }]);
    expect(plan.aparte).toEqual([]);
    const solado = plan.porPartida.find((p) => p.partidaId === 'p-solado')!;
    expect(solado).toMatchObject({ lineas: 2, antes: 19.04, despues: 76.16, ud: 'm²' });
  });

  it('la misma rev no recalcula nada; otra página tampoco', () => {
    const o = obra();
    const e = escalaDe(o.planos[0]!, 1)!;
    expect(planRecalculo(o, o.planos[0]!.id, 1, e).candidatas).toEqual([]);
    expect(planRecalculo(o, o.planos[0]!.id, 2, doble(o)).candidatas).toEqual([]);
  });

  it('retocadas, aceptadas y certificadas quedan aparte, con su motivo', () => {
    const o = obra();
    linea(o, 'l-tabique').largo = 9.5; // retocada a mano
    delete linea(o, 'l-tabique').expr;
    (linea(o, 'l-dorm1').origen as OrigenConEscala).aceptada = true;
    const cert: Cert = { id: 'c2', num: 2, period: '', retencion: 0, data: { 'p-solado': 20 }, lineQty: { 'p-solado': { 'l-salon': 20 } } };
    o.certs = [...o.certs, cert];
    const plan = planRecalculo(o, o.planos[0]!.id, 1, doble(o));
    expect(plan.aparte.map((a) => [a.lineId, a.motivo, a.certNums])).toEqual([
      ['l-tabique', 'retocada', undefined],
      ['l-salon', 'certificada', [2]],
      ['l-dorm1', 'aceptada', undefined],
    ]);
    expect(plan.candidatas.map((c) => c.lineId)).not.toContain('l-salon');
  });

  it('avisa si la medición nueva queda por debajo de lo certificado', () => {
    const o = obra();
    o.certs = [{ id: 'c1', num: 1, period: '', retencion: 0, data: { 'p-tabique': 9 } }];
    const mitad: Escala = { ...doble(o), mPorUnidad: doble(o).mPorUnidad / 4, n: 25 }; // cada longitud ÷2
    const t = planRecalculo(o, o.planos[0]!.id, 1, mitad).porPartida.find((p) => p.partidaId === 'p-tabique')!;
    expect(t).toMatchObject({ antes: 9.45, despues: 4.73, porDebajoDe: { certNum: 1, cantidad: 9 } });
  });
});

describe('lineasConOtraEscala', () => {
  it('cuenta las líneas cuya calRev no es la activa de su página (las que un recálculo se saltó)', () => {
    const o = obra();
    const p = o.planos[0]!;
    expect(lineasConOtraEscala(o.partidas, p)).toBe(0);
    p.escalas[1] = doble(o);
    expect(lineasConOtraEscala(o.partidas, p)).toBe(6); // Recuento no cuenta
    partida(o, 'p-tabique').med = [recalcularLinea(linea(o, 'l-tabique'), doble(o))];
    expect(lineasConOtraEscala(o.partidas, p)).toBe(5);
  });
});

import { describe, expect, it } from 'vitest';
import { certSnapshotOf, certTotals, prevDataOf } from './certificacion';
import { buildLiquidacion } from './liquidacion';
import type { Cert, Chapter, Partida, PartidasMap, Rates } from './types';

const partida = (id: string, cantidad: number, precio: number): Partida => ({
  id,
  pos: id,
  code: id.toUpperCase(),
  title: `Partida ${id}`,
  ud: 'm²',
  precio,
  cantidad,
  desc: '',
  med: [],
  items: [],
});

const rates: Rates = { iva: 0.21, gg: 0.13, bi: 0.06, ci: 0.03, coefK: 1 };
const chapters: Chapter[] = [{ id: 'a', code: '1', title: 'Albañilería' }];
const partidas: PartidasMap = {
  a: [partida('p1', 100, 10), partida('p2', 50, 20), partida('p3', 10, 5), partida('p4', 8, 30)],
};
const certs: Cert[] = [
  { id: 'c1', num: 1, period: 'Mayo', retencion: 0.05, data: { p1: 60 }, priceSnapshot: { p1: 10, p2: 20, p3: 5, p4: 30 }, coefK: 1 },
  {
    id: 'c2',
    num: 2,
    period: 'Junio',
    retencion: 0.05,
    // p1 con exceso, p2 con defecto, p3 cerrada sin hacer, p4 justa, y un borrado certificado.
    data: { p1: 110, p2: 40, p4: 8, borrada: 2 },
    priceSnapshot: { p1: 10, p2: 22, p3: 5, p4: 30, borrada: 15 },
    coefK: 1,
    cerradas: { p3: true },
    extras: [{ id: 'x1', chapterId: 'a', pos: 'PC1', title: 'Refuerzo no previsto', ud: 'ud', cantidad: 3, precio: 40 }],
  },
];

describe('buildLiquidacion', () => {
  const liq = buildLiquidacion(chapters, partidas, certs, rates, { borrada: { code: 'B', title: 'Partida borrada', ud: 'ud' } })!;
  const filas = liq.capitulos.flatMap((c) => c.grupos.flatMap((g) => g.rows));
  const f = (id: string) => filas.find((r) => r.id === id)!;

  it('sale de la última certificación', () => {
    expect([liq.certNum, liq.certPeriod]).toEqual([2, 'Junio']);
  });

  it('cada partida con su estado, diferencia y %', () => {
    expect(f('p1')).toMatchObject({ estado: 'exceso', presCant: 100, ejecCant: 110, difCant: 10, presImporte: 100000, ejecImporte: 110000, difImporte: 10000 });
    expect(f('p1').pct).toBeCloseTo(110);
    // El ejecutado se valora al precio con que se certificó (22), no al del presupuesto (20).
    expect(f('p2')).toMatchObject({ estado: 'defecto', difCant: -10, presPrecio: 20, ejecPrecio: 22, presImporte: 100000, ejecImporte: 88000, difImporte: -12000 });
    expect(f('p3')).toMatchObject({ estado: 'noEjecutada', ejecCant: 0, difImporte: -5000 });
    expect(f('p4')).toMatchObject({ estado: 'igual', difImporte: 0 });
  });

  it('contradictorios y borradas: sin presupuestado', () => {
    expect(f('x1')).toMatchObject({ estado: 'contradictorio', code: 'P.C.', presImporte: 0, ejecImporte: 12000, pct: null });
    expect(f('borrada')).toMatchObject({ estado: 'eliminada', title: 'Partida borrada', presImporte: 0, ejecImporte: 3000 });
    expect(liq.cuenta).toEqual({ igual: 1, exceso: 1, defecto: 1, noEjecutada: 1, contradictorio: 1, eliminada: 1 });
  });

  it('el lado ejecutado cuadra al céntimo con la certificación', () => {
    const ps = Object.values(partidas).flat();
    const t = certTotals(ps, certs[1]!.data, prevDataOf(certs, 1), rates, 0.05, 1, certs[1]!.extras, [], certSnapshotOf(certs[1]), [], certs[1]!.cerradas);
    expect(liq.ejec.pem).toBe(t.certPEM);
    expect(liq.ejec.pec).toBe(t.pecOrigen);
    expect(liq.pres.pem).toBe(t.budgetPEM);
    expect(liq.ejec.total).toBe(liq.ejec.pec + liq.ejec.iva);
    expect(liq.retenido).toBeGreaterThan(0);
  });

  it('sin certificaciones no hay liquidación', () => {
    expect(buildLiquidacion(chapters, partidas, [], rates)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  ajusteImporte,
  ajusteLabel,
  cantidadToPct,
  certCalc,
  certChapterRows,
  certPrecioK,
  certSnapshotOf,
  certTotals,
  estaCertDisplay,
  estaCertToOrigen,
  extraCalc,
  prevDataOf,
  pctToCantidad,
  sumLineQty,
} from './certificacion';
import { toCents, toEur } from './money';
import type { Ajuste, Cert, CertExtra, Chapter, Partida, PartidasMap, Rates } from './types';

const aj = (over: Partial<Ajuste>): Ajuste => ({
  id: 'a1',
  concepto: '',
  tipo: 'fijo',
  valor: 0,
  signo: -1,
  recurrente: false,
  ...over,
});

const extra = (over: Partial<CertExtra>): CertExtra => ({
  id: 'x1',
  chapterId: '01',
  pos: 'C1',
  title: '',
  ud: 'ud',
  cantidad: 0,
  precio: 0,
  ...over,
});

const partida = (over: Partial<Partida>): Partida => ({
  id: 'p',
  pos: '1.1',
  code: 'X',
  title: '',
  ud: 'ud',
  precio: 0,
  desc: '',
  med: [],
  items: [],
  ...over,
});

const rates: Rates = { iva: 0.1, gg: 0.13, bi: 0.06, coefK: 1 };

describe('certCalc por partida', () => {
  const p = partida({ id: 'p1', cantidad: 100, precio: 10 });
  const row = certCalc(p, { p1: 50 }, { p1: 20 });

  it('a origen / anterior / esta cert', () => {
    expect(toEur(row.aOrigen)).toBe(500); // 50 × 10
    expect(toEur(row.anterior)).toBe(200); // 20 × 10
    expect(toEur(row.estaCert)).toBe(300); // 500 − 200
  });

  it('% de ejecución = ejecutada / ofertada', () => {
    expect(row.ofertada).toBe(100);
    expect(row.pct).toBe(50);
  });

  it('partida no ejecutada → todo 0', () => {
    const r = certCalc(p, {}, {});
    expect(r.aOrigen).toBe(0);
    expect(r.estaCert).toBe(0);
    expect(r.pct).toBe(0);
  });

  it('aplica el coeficiente K al precio', () => {
    const r = certCalc(p, { p1: 50 }, {}, 1.13);
    expect(toEur(r.aOrigen)).toBe(565); // 50 × (10 × 1,13)
  });
});

describe('certTotals (cadena GG+BI → retención → IVA → líquido)', () => {
  const partidas = [partida({ id: 'p1', cantidad: 100, precio: 10 })];
  const t = certTotals(partidas, { p1: 50 }, { p1: 20 }, rates, 0.05);

  it('PEM presupuesto y certificado a origen / anterior', () => {
    expect(toEur(t.budgetPEM)).toBe(1000); // 100 × 10
    expect(toEur(t.certPEM)).toBe(500);
    expect(toEur(t.prevPEM)).toBe(200);
    expect(t.pctGlobal).toBe(50);
  });

  it('PEC a origen, anterior y esta certificación', () => {
    expect(toEur(t.ggbiOrigen)).toBe(95); // 500 × 0,19
    expect(toEur(t.pecOrigen)).toBe(595); // 500 + 95
    expect(toEur(t.pecPrev)).toBe(238); // 200 × 1,19
    expect(toEur(t.pecEsta)).toBe(357); // 595 − 238
  });

  it('retención, base, IVA y líquido a abonar', () => {
    expect(toEur(t.retencion)).toBe(17.85); // 357 × 5%
    expect(toEur(t.base)).toBe(339.15); // 357 − 17,85
    expect(toEur(t.iva)).toBe(33.92); // round2(339,15 × 10%) = 33,92
    expect(toEur(t.liquido)).toBe(373.07); // 339,15 + 33,92
  });
});

describe('extraCalc (precios contradictorios, F4.4)', () => {
  const e = extra({ id: 'x1', cantidad: 4, precio: 25 });
  it('importe a-origen = cantidad · precio, SIN coeficiente K', () => {
    const k = extraCalc(e, 0);
    expect(toEur(k.aOrigen)).toBe(100); // 4 × 25
    expect(toEur(k.anterior)).toBe(0);
    expect(toEur(k.estaCert)).toBe(100);
  });
  it('esta cert = aOrigen − anterior (cantidad de la cert previa)', () => {
    const k = extraCalc(e, 1); // 1 ud certificada antes
    expect(toEur(k.anterior)).toBe(25); // 1 × 25
    expect(toEur(k.estaCert)).toBe(75); // 100 − 25
  });
});

describe('certTotals con contradictorios (F4.4)', () => {
  const partidas = [partida({ id: 'p1', cantidad: 100, precio: 10 })];
  const extras = [extra({ id: 'x1', cantidad: 4, precio: 25 })]; // 100 € a-origen
  const t = certTotals(partidas, { p1: 50 }, { p1: 20 }, rates, 0, 1, extras, []);

  it('suman a certificado/anterior pero NO al PEM de presupuesto', () => {
    expect(toEur(t.budgetPEM)).toBe(1000); // sólo la partida
    expect(toEur(t.certPEM)).toBe(600); // 500 + 100 del contradictorio
    expect(toEur(t.prevPEM)).toBe(200); // el contradictorio es nuevo → anterior 0
  });
  it('el "anterior" del contradictorio sale de prevExtras (mismo id)', () => {
    const prev = [extra({ id: 'x1', cantidad: 1, precio: 25 })];
    const t2 = certTotals(partidas, { p1: 50 }, { p1: 20 }, rates, 0, 1, extras, prev);
    expect(toEur(t2.prevPEM)).toBe(225); // 200 + 25 (1 × 25)
  });
});

describe('ajusteImporte / ajusteLabel', () => {
  it('pct → % sobre pecEsta (round2 por paso); reproduce el caso 10,197 % del Excel', () => {
    const pecEsta = toCents(13843.88);
    expect(toEur(ajusteImporte(aj({ tipo: 'pct', valor: 0.10197 }), pecEsta))).toBe(1411.66);
    expect(toEur(ajusteImporte(aj({ tipo: 'pct', valor: 0.05 }), pecEsta))).toBe(692.19);
  });
  it('fijo → euros tal cual, sin depender de pecEsta', () => {
    expect(toEur(ajusteImporte(aj({ tipo: 'fijo', valor: 1411.66 }), toCents(999)))).toBe(1411.66);
  });
  it('la etiqueta auto-compone el % (decimales variables); el fijo usa el concepto', () => {
    expect(ajusteLabel(aj({ tipo: 'pct', valor: 0.10197, concepto: 'Pago adelantado' }))).toBe(
      'Pago adelantado 10,197 %',
    );
    expect(ajusteLabel(aj({ tipo: 'pct', valor: 0.05, concepto: 'Retención extra' }))).toBe(
      'Retención extra 5 %',
    );
    expect(ajusteLabel(aj({ tipo: 'fijo', concepto: 'Exceso cert. 2' }))).toBe('Exceso cert. 2');
  });
});

describe('certTotals con ajustes configurables', () => {
  const partidas = [partida({ id: 'p1', cantidad: 100, precio: 10 })];
  // pecEsta del fixture = 357 € (ver arriba): 500 → +19% = 595, − prev 238 = 357.

  it('ajuste en % se calcula sobre pecEsta (no en cascada) e independiente de la retención', () => {
    const t = certTotals(partidas, { p1: 50 }, { p1: 20 }, rates, 0.05, 1, [], [], undefined, [
      aj({ id: 'a1', tipo: 'pct', valor: 0.1, signo: -1, concepto: 'Pago adelantado' }),
    ]);
    expect(toEur(t.retencion)).toBe(17.85); // 357 × 5% (sobre pecEsta)
    expect(t.ajustesRows).toHaveLength(1);
    expect(toEur(t.ajustesRows[0]!.importe)).toBe(35.7); // 357 × 10% (sobre pecEsta, NO sobre 339,15)
    expect(t.ajustesRows[0]!.signo).toBe(-1);
    expect(toEur(t.ajustesTotal)).toBe(-35.7);
    expect(toEur(t.base)).toBe(303.45); // 357 − 17,85 − 35,70
  });

  it('ajuste fijo con signo + suma a la base; el − resta', () => {
    const suma = certTotals(partidas, { p1: 50 }, { p1: 20 }, rates, 0, 1, [], [], undefined, [
      aj({ id: 'a1', tipo: 'fijo', valor: 100, signo: 1 }),
    ]);
    expect(toEur(suma.base)).toBe(457); // 357 + 100
    const resta = certTotals(partidas, { p1: 50 }, { p1: 20 }, rates, 0, 1, [], [], undefined, [
      aj({ id: 'a1', tipo: 'fijo', valor: 100, signo: -1 }),
    ]);
    expect(toEur(resta.base)).toBe(257); // 357 − 100
  });

  it('Σ de varios ajustes con signo; IVA sobre la base ya ajustada', () => {
    const t = certTotals(partidas, { p1: 50 }, { p1: 20 }, rates, 0, 1, [], [], undefined, [
      aj({ id: 'a1', tipo: 'pct', valor: 0.1, signo: -1 }), // −35,70
      aj({ id: 'a2', tipo: 'fijo', valor: 100, signo: 1 }), // +100
    ]);
    expect(toEur(t.ajustesTotal)).toBe(64.3); // −35,70 + 100
    expect(toEur(t.base)).toBe(421.3); // 357 + 64,30
    expect(toEur(t.iva)).toBe(42.13); // round2(421,30 × 10%)
    expect(toEur(t.liquido)).toBe(463.43); // 421,30 + 42,13
  });

  it('sin ajustes → ajustesTotal 0 y base intacta (compat)', () => {
    const t = certTotals(partidas, { p1: 50 }, { p1: 20 }, rates, 0.05);
    expect(t.ajustesRows).toHaveLength(0);
    expect(t.ajustesTotal).toBe(0);
    expect(toEur(t.base)).toBe(339.15); // 357 − 17,85, como antes
  });
});

describe('modo "esta certificación" (edición)', () => {
  it('muestra ejecutada − anterior y guarda max(0, prev + v)', () => {
    expect(estaCertDisplay(50, 20)).toBe(30);
    expect(estaCertToOrigen(20, 30)).toBe(50); // ida y vuelta
    expect(estaCertToOrigen(20, -30)).toBe(0); // no baja de 0
  });
});

describe('prevDataOf', () => {
  const certs: Cert[] = [
    { id: 'c1', num: 1, period: 'Abr', retencion: 0.05, data: { p1: 10 } },
    { id: 'c2', num: 2, period: 'May', retencion: 0.05, data: { p1: 25 } },
  ];
  it('la primera no tiene anterior; la segunda usa la primera', () => {
    expect(prevDataOf(certs, 0)).toEqual({});
    expect(prevDataOf(certs, 1)).toEqual({ p1: 10 });
  });
});

describe('certChapterRows (avance por capítulo, F4)', () => {
  const chapters: Chapter[] = [
    { id: '01', code: '1', title: 'Cap uno' },
    { id: '02', code: '2', title: 'Cap dos (vacío)' },
  ];
  const partidas: PartidasMap = {
    '01': [partida({ id: 'p1', cantidad: 100, precio: 10 })], // importe 1.000 €
    '02': [],
  };

  it('suma presupuesto y certificado por capítulo y descarta los de 0', () => {
    const rows = certChapterRows(chapters, partidas, { p1: 50 }, {});
    expect(rows).toHaveLength(1); // el cap 02 (budget 0) se filtra
    const r = rows[0]!;
    expect(r.id).toBe('01');
    expect(r.budget).toBe(toCents(1000)); // 100 · 10
    expect(r.cert).toBe(toCents(500)); // 50 · 10 a origen
    expect(r.pct).toBeCloseTo(50);
  });
});

describe('% editable (F4, dogfood #1) — cantidad, no dinero', () => {
  it('pctToCantidad/cantidadToPct son inversos sobre la ofertada', () => {
    expect(pctToCantidad(124.65, 50)).toBe(62.33); // round2(62.325)
    expect(cantidadToPct(100, 50)).toBe(50);
    expect(cantidadToPct(0, 5)).toBe(0); // sin ofertada → 0, no NaN
  });
});

describe('snapshot de precios por cert (F7.0, residuo de precio de T-2)', () => {
  // El presupuesto "vivo" tiene la partida a 20 €; la cert la congeló a 10 €.
  const vivo = partida({ id: 'p1', cantidad: 100, precio: 20 });
  const snap = { precios: { p1: 10 }, coefK: 1 };

  it('certPrecioK: congelado×K congelado si está en el snapshot; vivo×K vivo si no', () => {
    expect(certPrecioK(vivo, 1.5, { precios: { p1: 8 }, coefK: 1.13 })).toBeCloseTo(9.04);
    expect(certPrecioK(vivo, 1.5, { precios: {}, coefK: 1.13 })).toBe(30); // ausente → vivo
    expect(certPrecioK(vivo, 1.5)).toBe(30); // cert legada (sin snapshot) → vivo
  });

  it('certCalc valora con el precio congelado aunque el vivo cambie', () => {
    const r = certCalc(vivo, { p1: 50 }, { p1: 20 }, 1, snap);
    expect(toEur(r.aOrigen)).toBe(500); // 50 × 10 congelado, no × 20 vivo
    expect(toEur(r.anterior)).toBe(200);
    expect(toEur(r.estaCert)).toBe(300);
  });

  it('certCalc con snapshot ignora el K vivo (usa el K congelado)', () => {
    const r = certCalc(vivo, { p1: 50 }, {}, 2 /* K vivo */, snap); // K congelado = 1
    expect(toEur(r.aOrigen)).toBe(500);
  });

  it('certTotals: certPEM congelado, budgetPEM sigue vivo (referencia del % global)', () => {
    const t = certTotals([vivo], { p1: 50 }, {}, rates, 0, 1, [], [], snap);
    expect(toEur(t.certPEM)).toBe(500); // 50 × 10 congelado
    expect(toEur(t.budgetPEM)).toBe(2000); // 100 × 20 vivo
    expect(t.pctGlobal).toBe(25); // 500 / 2000
  });

  it('certChapterRows valora `cert` con el snapshot y `budget` en vivo', () => {
    const chapters: Chapter[] = [{ id: '01', code: '1', title: 'Uno' }];
    const map: PartidasMap = { '01': [vivo] };
    const rows = certChapterRows(chapters, map, { p1: 50 }, {}, 1, [], snap);
    expect(rows[0]!.cert).toBe(toCents(500));
    expect(rows[0]!.budget).toBe(toCents(2000));
  });

  it('certSnapshotOf: undefined para certs legadas; K congelado o fallback al vivo', () => {
    const legada: Cert = { id: 'c1', num: 1, period: '', retencion: 0, data: {} };
    expect(certSnapshotOf(legada, 1.13)).toBeUndefined();
    expect(certSnapshotOf(undefined, 1.13)).toBeUndefined();
    expect(certSnapshotOf({ priceSnapshot: { p1: 10 }, coefK: 1.05 }, 1.13)).toEqual({
      precios: { p1: 10 },
      coefK: 1.05,
    });
    expect(certSnapshotOf({ priceSnapshot: { p1: 10 } }, 1.13)).toEqual({
      precios: { p1: 10 },
      coefK: 1.13, // sin K congelado (defensivo) → el vivo
    });
  });
});

describe('sumLineQty (certificar marcando líneas, F4.3)', () => {
  it('suma las cantidades por línea a-origen, redondeo a 2 dec', () => {
    expect(sumLineQty({ a: 61.2, b: 63.45 })).toBe(124.65);
    expect(sumLineQty({ a: 0.1, b: 0.2 })).toBe(0.3); // round2 corrige el float
  });
  it('vacío/undefined → 0', () => {
    expect(sumLineQty({})).toBe(0);
    expect(sumLineQty(undefined)).toBe(0);
  });
});

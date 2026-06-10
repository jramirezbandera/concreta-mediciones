import { describe, expect, it } from 'vitest';
import { buildCertListado, buildPresupuestoListado, buildResumen, obraMeta } from './listado';
import { toCents } from './money';
import { CHAPTERS, DEFAULT_RATES, PARTIDAS } from './seed';
import { pem } from './totales';
import type { Cert, Chapter, Obra, Partida, PartidasMap, Rates } from './types';

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

/* Fixture: cap 1 con subcapítulo (y una huérfana), cap 2 vacío, cap 3 plano. */
const chapters: Chapter[] = [
  { id: '01', code: '1', title: 'Demoliciones', children: [{ id: '01.01', code: '1.1', title: 'Interiores' }] },
  { id: '02', code: '2', title: 'Vacío' },
  { id: '03', code: '3', title: 'Albañilería' },
];
const partidas: PartidasMap = {
  '01': [
    partida({ id: 'pa', pos: '1.1', code: 'A', title: 'Huérfana', precio: 10, cantidad: 2 }),
    partida({
      id: 'pb',
      sub: '01.01',
      pos: '1.1.1',
      code: 'B',
      title: 'Con medición',
      precio: 5,
      med: [
        { id: 'm1', comment: 'zona A', uds: 2, largo: 3, ancho: '', alto: '' }, // parcial 6
        { id: 'm2', comment: '', uds: 4, largo: '', ancho: '', alto: '' }, // parcial 4
      ],
    }),
  ],
  '02': [],
  '03': [partida({ id: 'pc', pos: '3.1', code: 'C', title: 'Plana', precio: 7.77, cantidad: 3 })],
};

describe('buildPresupuestoListado (doc combinado, F7.1)', () => {
  const l = buildPresupuestoListado(chapters, partidas);

  it('filtra capítulos vacíos y conserva el orden', () => {
    expect(l.capitulos.map((c) => c.id)).toEqual(['01', '03']);
  });

  it('agrupa por subcapítulo con las huérfanas primero', () => {
    const grupos = l.capitulos[0]!.grupos;
    expect(grupos).toHaveLength(2);
    expect(grupos[0]!.sub).toBeNull();
    expect(grupos[0]!.rows.map((r) => r.id)).toEqual(['pa']);
    expect(grupos[1]!.sub?.code).toBe('1.1');
    expect(grupos[1]!.rows.map((r) => r.id)).toEqual(['pb']);
  });

  it('totales al céntimo: grupo, capítulo y PEM', () => {
    expect(l.capitulos[0]!.grupos[0]!.total).toBe(toCents(20)); // 2 × 10
    expect(l.capitulos[0]!.grupos[1]!.total).toBe(toCents(50)); // (6+4) × 5
    expect(l.capitulos[0]!.total).toBe(toCents(70));
    expect(l.capitulos[1]!.total).toBe(toCents(23.31)); // 3 × 7,77
    expect(l.pem).toBe(toCents(93.31));
  });

  it('embebe las mediciones (parcial por línea; sin medición → [])', () => {
    const pb = l.capitulos[0]!.grupos[1]!.rows[0]!;
    expect(pb.cantidad).toBe(10);
    expect(pb.med.map((m) => m.parcial)).toEqual([6, 4]);
    expect(pb.med[0]!.dims).toEqual([2, 3, '', '']);
    expect(l.capitulos[0]!.grupos[0]!.rows[0]!.med).toEqual([]);
  });

  it('aplica el coeficiente K al precio y a los importes', () => {
    const k = buildPresupuestoListado(chapters, partidas, 1.13);
    const pa = k.capitulos[0]!.grupos[0]!.rows[0]!;
    expect(pa.precio).toBe(11.3);
    expect(pa.importe).toBe(toCents(22.6));
    const pc = k.capitulos[1]!.grupos[0]!.rows[0]!;
    expect(pc.precio).toBe(8.78); // round2(7,77 × 1,13)
    expect(pc.importe).toBe(toCents(26.34)); // round2(3 × 8,7801)
    expect(k.pem).toBe(toCents(22.6 + 56.5 + 26.34));
  });

  it('sobre el seed real: PEM del listado = PEM del motor, al céntimo', () => {
    const seed = buildPresupuestoListado(CHAPTERS, PARTIDAS, DEFAULT_RATES.coefK);
    expect(seed.pem).toBe(pem(PARTIDAS, DEFAULT_RATES.coefK));
  });
});

describe('buildResumen (hoja resumen, F7.1)', () => {
  const r = buildResumen(chapters, partidas, rates);

  it('lista TODOS los capítulos (también vacíos) con su % sobre el PEM', () => {
    expect(r.rows.map((x) => x.id)).toEqual(['01', '02', '03']);
    expect(r.rows[1]!.importe).toBe(0);
    expect(r.rows[0]!.pct).toBeCloseTo((70 / 93.31) * 100, 6);
  });

  it('GG/BI redondeados POR LÍNEA y sumas exactas (coherencia del documento)', () => {
    expect(r.pem).toBe(toCents(93.31));
    expect(r.gg).toBe(toCents(12.13)); // round2(93,31 × 0,13)
    expect(r.bi).toBe(toCents(5.6)); // round2(93,31 × 0,06)
    expect(r.pec).toBe(r.pem + r.gg + r.bi);
    expect(r.iva).toBe(toCents(11.1)); // round2(111,04 × 0,10)
    expect(r.total).toBe(r.pec + r.iva);
  });

  it('obra sin capítulos → filas vacías y todo a 0 (sin NaN)', () => {
    const v = buildResumen([], {}, rates);
    expect(v.rows).toEqual([]);
    expect(v.pem).toBe(0);
    expect(v.total).toBe(0);
  });
});

describe('buildCertListado (con snapshot F7.0 + contradictorios)', () => {
  const certs: Cert[] = [
    { id: 'c1', num: 1, period: 'Abril', retencion: 0.05, data: { pa: 1, pc: 3 } },
    {
      id: 'c2',
      num: 2,
      period: 'Mayo',
      retencion: 0.05,
      data: { pa: 2, pc: 3 },
      priceSnapshot: { pa: 10, pb: 5, pc: 7.77 },
      coefK: 1,
      snapshotAt: '2026-06-11T08:00:00.000Z',
      extras: [{ id: 'x1', chapterId: '02', pos: 'C1', title: 'Extra', ud: 'ud', cantidad: 2, precio: 25 }],
    },
  ];

  it('doble semántica al céntimo: a origen / anterior / esta cert', () => {
    const l = buildCertListado(chapters, partidas, certs, 1, rates)!;
    const pa = l.capitulos[0]!.grupos[0]!.rows[0]!;
    expect(pa.aOrigen).toBe(toCents(20)); // 2 × 10
    expect(pa.anterior).toBe(toCents(10)); // 1 × 10
    expect(pa.estaCert).toBe(toCents(10));
    expect(pa.ofertada).toBe(2);
    expect(pa.pct).toBe(100);
  });

  it('la 1ª cert no tiene anterior (todo 0)', () => {
    const l = buildCertListado(chapters, partidas, certs, 0, rates)!;
    const pa = l.capitulos[0]!.grupos[0]!.rows[0]!;
    expect(pa.anterior).toBe(0);
    expect(pa.estaCert).toBe(pa.aOrigen);
  });

  it('un capítulo sin partidas pero CON contradictorio aparece en el doc', () => {
    const l = buildCertListado(chapters, partidas, certs, 1, rates)!;
    expect(l.capitulos.map((c) => c.id)).toEqual(['01', '02', '03']);
    const c02 = l.capitulos[1]!;
    expect(c02.grupos).toEqual([]);
    expect(c02.extras[0]!.aOrigen).toBe(toCents(50)); // 2 × 25
    expect(c02.aOrigen).toBe(toCents(50));
    // y suma a los totales (certPEM) sin tocar el budgetPEM
    expect(l.totals.certPEM).toBe(toCents(20 + 23.31 + 50));
    expect(l.totals.budgetPEM).toBe(toCents(93.31));
  });

  it('valora con el snapshot congelado aunque el precio vivo cambie (F7.0)', () => {
    const vivas: PartidasMap = structuredClone(partidas);
    vivas['01']![0]!.precio = 99; // pa repreciada DESPUÉS de certificar
    const l2 = buildCertListado(chapters, vivas, certs, 1, rates)!;
    const pa2 = l2.capitulos[0]!.grupos[0]!.rows[0]!;
    expect(pa2.precio).toBe(10); // congelado
    expect(pa2.aOrigen).toBe(toCents(20));
    // la cert 1 es legada (sin snapshot) → sigue el precio vivo
    const l1 = buildCertListado(chapters, vivas, certs, 0, rates)!;
    expect(l1.capitulos[0]!.grupos[0]!.rows[0]!.precio).toBe(99);
  });

  it('metadatos de la cert: num/period/retención/snapshotAt; índice inválido → null', () => {
    const l = buildCertListado(chapters, partidas, certs, 1, rates)!;
    expect(l.num).toBe(2);
    expect(l.period).toBe('Mayo');
    expect(l.retencion).toBe(0.05);
    expect(l.snapshotAt).toBe('2026-06-11T08:00:00.000Z');
    expect(buildCertListado(chapters, partidas, certs, 9, rates)).toBeNull();
  });
});

describe('obraMeta (contrato compartido PDF/XLSX/DOCX)', () => {
  it('aplana las rutas del modal de obra y compone redactor y lugar/fecha', () => {
    const m = obraMeta({
      denominacion: 'Reforma X',
      direccion: 'C/ Mayor 14',
      localidad: 'Málaga',
      provincia: 'Málaga',
      expediente: 'E-2026-1',
      promotor: { nombre: 'ACME SL' },
      constructor: { nombre: 'BuildCo' },
      redactor: { nombre: 'J. Ramírez', colegiado: '1234' },
      lugar: 'Málaga',
      fecha: 'junio 2026',
    } as Obra);
    expect(m.promotor).toBe('ACME SL');
    expect(m.constructora).toBe('BuildCo');
    expect(m.redactor).toBe('J. Ramírez · col. 1234');
    expect(m.lugarFecha).toBe('Málaga, junio 2026');
  });

  it('los campos ausentes quedan en cadena vacía (nunca undefined)', () => {
    const m = obraMeta({ denominacion: 'X', direccion: '', localidad: '' });
    expect(m.promotor).toBe('');
    expect(m.redactor).toBe('');
    expect(m.lugarFecha).toBe('');
  });
});

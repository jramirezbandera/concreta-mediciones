import { describe, expect, it } from 'vitest';
import { DELETED_ROW_ID } from './certificacion';
import {
  buildCertListado,
  buildPresupuestoListado,
  buildResumen,
  composeCertFirmantes,
  firmaCertDefinitiva,
  firmaFor,
  firmaLugarFecha,
  obraMeta,
} from './listado';
import { toCents } from './money';
import { CHAPTERS, DEFAULT_RATES, PARTIDAS } from './seed';
import { costesDirectos } from './totales';
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

const rates: Rates = { iva: 0.1, gg: 0.13, bi: 0.06, ci: 0, coefK: 1 };

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
    expect(seed.pem).toBe(costesDirectos(PARTIDAS, DEFAULT_RATES.coefK));
  });

  it('jerarquía de N niveles: pre-orden, depth, rollup en cabecera y total sin doble cuenta', () => {
    const deep: Chapter[] = [
      {
        id: '01',
        code: '1',
        title: 'Cap',
        children: [
          {
            id: '01.01',
            code: '1.1',
            title: 'Padre sin filas directas',
            children: [{ id: '01.01.01', code: '1.1.1', title: 'Nieto' }],
          },
        ],
      },
    ];
    const ps: PartidasMap = {
      '01': [
        partida({ id: 'd', precio: 100, cantidad: 1 }),
        partida({ id: 'n', sub: '01.01.01', precio: 10, cantidad: 2 }),
      ],
    };
    const l = buildPresupuestoListado(deep, ps);
    const g = l.capitulos[0]!.grupos;
    // El padre intermedio SIN filas directas se conserva (contexto del nieto).
    expect(g.map((x) => [x.sub?.code ?? null, x.depth, x.rows.length])).toEqual([
      [null, 0, 1],
      ['1.1', 1, 0],
      ['1.1.1', 2, 1],
    ]);
    expect(g[1]!.total).toBe(toCents(20)); // rollup del padre = el nieto
    expect(g[2]!.total).toBe(toCents(20));
    expect(l.capitulos[0]!.total).toBe(toCents(120)); // 100 + 20, sin doble cuenta
    expect(l.pem).toBe(toCents(120));
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

  it('sin CI de obra, el PEM ES la Σ de capítulos (documento idéntico al de siempre)', () => {
    expect(r.ci).toBe(0);
    expect(r.cd).toBe(r.pem);
  });

  it('con CI: capítulos = directos, PEM = directos + CI, y GG/BI ya sobre el PEM', () => {
    const c = buildResumen(chapters, partidas, { ...rates, ci: 0.03 });
    expect(c.cd).toBe(toCents(93.31)); // la Σ de capítulos NO se mueve
    expect(c.ci).toBe(toCents(2.8)); // round2(93,31 × 0,03)
    expect(c.pem).toBe(c.cd + c.ci);
    expect(c.gg).toBe(toCents(12.49)); // round2(96,11 × 0,13), ya con el CI dentro
    expect(c.pec).toBe(c.pem + c.gg + c.bi);
    // El % del capítulo pesa sobre los directos: la columna sigue cerrando en 100.
    expect(c.rows.reduce((a, x) => a + x.pct, 0)).toBeCloseTo(100, 6);
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

  it('retenidoAcumulado en el payload: neto hasta esta cert; null sin retención', () => {
    const l0 = buildCertListado(chapters, partidas, certs, 0, rates)!;
    const l1 = buildCertListado(chapters, partidas, certs, 1, rates)!;
    expect(l0.retenidoAcumulado).not.toBeNull();
    expect(l1.retenidoAcumulado!).toBeGreaterThan(l0.retenidoAcumulado!); // crece cert a cert
    // sin retención en ninguna cert → no se emite la línea (null)
    const sinRet = certs.map((c) => ({ ...c, retencion: 0 }));
    expect(buildCertListado(chapters, partidas, sinRet, 1, rates)!.retenidoAcumulado).toBeNull();
  });

  it('D-01/D-02: el rastro borrado va al capítulo sintético y Σ capítulos == certPEM', () => {
    const certsDel: Cert[] = [
      {
        id: 'c1',
        num: 1,
        period: '',
        retencion: 0,
        data: { pa: 2, borrada: 3 }, // `borrada` ya no existe en el presupuesto
        priceSnapshot: { pa: 10, borrada: 5 },
        coefK: 1,
        extras: [
          // contradictorio cuyo capítulo se borró después de certificarlo
          { id: 'x9', chapterId: 'YA-NO-EXISTE', pos: 'C1', title: 'PC huérfano', ud: 'ud', cantidad: 1, precio: 100 },
        ],
      },
    ];
    const l = buildCertListado(chapters, partidas, certsDel, 0, rates)!;
    const sintetico = l.capitulos.at(-1)!;
    expect(sintetico.id).toBe(DELETED_ROW_ID);
    expect(sintetico.title).toBe('Eliminado del presupuesto');
    expect(sintetico.grupos[0]!.rows[0]!.aOrigen).toBe(toCents(15)); // 3 × 5 (agregado)
    expect(sintetico.extras[0]!.aOrigen).toBe(toCents(100));
    expect(sintetico.aOrigen).toBe(toCents(115));
    // El documento cuadra: la Σ de capítulos (incluido el sintético) == total.
    expect(l.capitulos.reduce((a, c) => a + c.aOrigen, 0)).toBe(l.totals.certPEM);
  });
});

describe('obraMeta (contrato compartido PDF/XLSX/DOCX)', () => {
  it('aplana las rutas del modal de obra (cabecera, sin la firma)', () => {
    const m = obraMeta({
      denominacion: 'Reforma X',
      direccion: 'C/ Mayor 14',
      localidad: 'Málaga',
      provincia: 'Málaga',
      expediente: 'E-2026-1',
      promotor: { nombre: 'ACME SL' },
      constructor: { nombre: 'BuildCo' },
    } as Obra);
    expect(m.promotor).toBe('ACME SL');
    expect(m.constructora).toBe('BuildCo');
    expect(m.expediente).toBe('E-2026-1');
    // La firma ya NO vive en ObraMeta (eng-review OV2): es datos de documento.
    expect('redactor' in m).toBe(false);
    expect('lugarFecha' in m).toBe(false);
  });

  it('los campos ausentes quedan en cadena vacía (nunca undefined)', () => {
    const m = obraMeta({ denominacion: 'X', direccion: '', localidad: '' });
    expect(m.promotor).toBe('');
    expect(m.constructora).toBe('');
  });
});

describe('firmaFor (pies de firma por rol, eng-review OV1/OV2/OV3/OV4)', () => {
  const obra = {
    denominacion: 'Reforma X',
    localidad: 'Málaga',
    promotor: { nombre: 'Comunidad Demóstenes 35' },
    constructor: { nombre: 'BuildCo SL', jefe: 'Pedro Gil' },
    direccionFacultativa: [
      { id: 'ag-1', rol: 'Director de obra', nombre: 'J. Ramírez', colegiado: '4821' },
      { id: 'ag-2', rol: 'Director de obra', nombre: 'M. Ruiz', colegiado: '5507' }, // codirección
      { id: 'ag-3', rol: 'Director de ejecución de obra', nombre: '', colegiado: '9' }, // sin nombre
    ],
  } as unknown as Obra;

  it('presupuesto/resumen = Constructora + Propiedad, con jefe como representante (OV4)', () => {
    const f = firmaFor('presupuesto', obra, undefined, '2026-07-04T10:00:00.000Z');
    expect(f.firmantes.map((x) => x.rol)).toEqual(['La Constructora', 'La Propiedad']);
    expect(f.firmantes[0]!.sub).toBe('Por la constructora: Pedro Gil');
    expect(f.firmantes[1]!.nombre).toBe('Comunidad Demóstenes 35');
    expect(firmaFor('resumen', obra, undefined, '').firmantes.map((x) => x.rol)).toEqual([
      'La Constructora',
      'La Propiedad',
    ]);
  });

  it('cert en vivo = dirección facultativa (con nombre) + Constructora; el agente vacío se filtra', () => {
    const f = firmaFor('cert', obra);
    expect(f.firmantes.map((x) => x.nombre)).toEqual(['J. Ramírez', 'M. Ruiz', 'BuildCo SL']);
    expect(f.firmantes[0]!.sub).toBe('Col. 4821');
    expect(f.firmantes[1]!.rol).toBe('Director de obra'); // dos DO = codirección permitida
  });

  it('cert usa el snapshot congelado si existe, ignorando la DF viva (OV1)', () => {
    const snap = [{ rol: 'Director de obra', nombre: 'Firmó antes', sub: 'Col. 1' }];
    const f = firmaFor('cert', obra, { firmantesSnapshot: snap, firmadoAt: '2026-01-01T00:00:00.000Z' });
    expect(f.firmantes).toEqual(snap);
    expect(f.fecha).toBe('2026-01-01T00:00:00.000Z');
  });

  it('cert con snapshot VACÍO (bug legado: selló sin agentes) compone en vivo', () => {
    const f = firmaFor('cert', obra, { firmantesSnapshot: [], firmadoAt: '2026-01-01T00:00:00.000Z' });
    expect(f.firmantes.map((x) => x.nombre)).toEqual(['J. Ramírez', 'M. Ruiz', 'BuildCo SL']);
  });

  it('cert con snapshot PROVISIONAL (solo constructora, sin DF) compone en vivo', () => {
    // Bug reportado: se selló antes de rellenar la DF → la firma no es definitiva
    // y debe recomponer para incluir los directores añadidos después.
    const snap = [{ rol: 'La Constructora', nombre: 'BuildCo SL', sub: 'Por la constructora: Pedro Gil' }];
    const f = firmaFor('cert', obra, { firmantesSnapshot: snap, firmadoAt: '2026-01-01T00:00:00.000Z' });
    expect(f.firmantes.map((x) => x.nombre)).toEqual(['J. Ramírez', 'M. Ruiz', 'BuildCo SL']);
  });

  it('composeCertFirmantes es la fuente única del snapshot (DF + Constructora, filtrada)', () => {
    expect(composeCertFirmantes(obra).map((x) => x.nombre)).toEqual([
      'J. Ramírez',
      'M. Ruiz',
      'BuildCo SL',
    ]);
  });

  it('firmaCertDefinitiva: definitiva solo con DF (con nombre); vacío/solo-constructora = provisional', () => {
    expect(firmaCertDefinitiva(undefined)).toBe(false);
    expect(firmaCertDefinitiva([])).toBe(false);
    expect(firmaCertDefinitiva([{ rol: 'La Constructora', nombre: 'BuildCo SL' }])).toBe(false);
    expect(firmaCertDefinitiva([{ rol: 'Director de obra', nombre: '' }])).toBe(false); // DF sin nombre
    expect(
      firmaCertDefinitiva([
        { rol: 'Director de obra', nombre: 'J. Ramírez' },
        { rol: 'La Constructora', nombre: 'BuildCo SL' },
      ]),
    ).toBe(true);
  });

  it('no rompe con direccionFacultativa malformada (no-array o entradas basura)', () => {
    const raro = {
      localidad: 'X',
      constructor: { nombre: 'C' },
      direccionFacultativa: [null, 42, { nombre: 5, rol: {} }, { rol: 'DO', nombre: 'Ok' }],
    } as unknown as Obra;
    const f = firmaFor('cert', raro);
    // Solo el firmante con nombre string válido sobrevive, más la Constructora.
    expect(f.firmantes.map((x) => x.nombre)).toEqual(['Ok', 'C']);
    const noArray = { constructor: { nombre: 'C' }, direccionFacultativa: 'basura' } as unknown as Obra;
    expect(() => firmaFor('cert', noArray)).not.toThrow();
  });

  it('firmaLugarFecha compone «En [lugar], a [fecha larga]» y degrada bien', () => {
    expect(firmaLugarFecha({ lugar: 'Málaga', fecha: '2026-07-04T00:00:00.000Z' })).toBe(
      'En Málaga, a 4 de julio de 2026',
    );
    expect(firmaLugarFecha({ lugar: 'Málaga', fecha: '' })).toBe('En Málaga');
    expect(firmaLugarFecha({ lugar: '', fecha: '' })).toBe('');
  });
});

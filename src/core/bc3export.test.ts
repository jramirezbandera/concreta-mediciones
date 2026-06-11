/* ===========================================================================
   core/bc3export — tests de la spec F7.4 D1 registro a registro + gate de
   fidelidad capa 2 (D5): round-trip del seed export→`bc3ToObra` EXACTO al
   céntimo (los round-trips PROPIOS no tienen tolerancia — D8).
   =========================================================================== */
import { describe, expect, it } from 'vitest';
import { coefKPct, encodeCp1252, obraToBc3, type Bc3ExportObra } from './bc3export';
import { bc3ToObra } from './bc3import';
import { buildRecursos } from './banco';
import { partidaCantidad } from './medicion';
import { toCents } from './money';
import { CHAPTERS, DEFAULT_OBRA, DEFAULT_RATES, PARTIDAS } from './seed';
import { pem } from './totales';
import type { Partida } from './types';

const decode = (b: Uint8Array) => new TextDecoder('windows-1252').decode(b);
const records = (o: Bc3ExportObra) => decode(obraToBc3(o)).split('\r\n').filter(Boolean);
const rec = (o: Bc3ExportObra, prefix: string) => records(o).find((r) => r.startsWith(prefix));

/** Obra mínima configurable: 1 capítulo, partidas a medida. */
function mini(partida: Partial<Partida> = {}, over: Partial<Bc3ExportObra> = {}): Bc3ExportObra {
  const p: Partida = {
    id: 'p1',
    pos: '1.1',
    code: 'D01',
    title: 'Demolición de tabique',
    ud: 'm²',
    precio: 12.34,
    desc: 'Demolición de tabiquería.',
    med: [{ id: 'p1-m1', comment: 'Planta baja', uds: 2, largo: 4.5, ancho: '', alto: 2.6 }],
    items: [
      { code: 'mo001', type: 'MO', cantidad: 0.45 },
      { code: 'mt001', type: 'MAT', cantidad: 1.05 },
      { code: '%CI', type: '%CI', cantidad: 3 },
    ],
    ...partida,
  };
  const partidas = { '01': [p] };
  return {
    chapters: [{ id: '01', code: '1', title: 'Demoliciones' }],
    partidas,
    recursos: {
      mo001: { type: 'MO', desc: 'Peón ordinario', ud: 'h', precio: 17.52 },
      mt001: { type: 'MAT', desc: 'Ladrillo hueco', ud: 'mu', precio: 98.4 },
    },
    rates: { ...DEFAULT_RATES },
    obra: { ...DEFAULT_OBRA, denominacion: 'Obra de prueba' },
    ...over,
  };
}

/* ---- encoder cp1252 -------------------------------------------------------- */
describe('encodeCp1252', () => {
  it('latin-1 directo y extras del rango 0x80–0x9F', () => {
    expect(Array.from(encodeCp1252('á'))).toEqual([0xe1]);
    expect(Array.from(encodeCp1252('³'))).toEqual([0xb3]);
    expect(Array.from(encodeCp1252('€'))).toEqual([0x80]);
    expect(Array.from(encodeCp1252('–'))).toEqual([0x96]); // U+2013
    expect(Array.from(encodeCp1252('Aañ'))).toEqual([0x41, 0x61, 0xf1]);
  });

  it('carácter no mapeable → "?" (un solo byte, también para astrales)', () => {
    expect(Array.from(encodeCp1252('→'))).toEqual([0x3f]);
    expect(Array.from(encodeCp1252('😀'))).toEqual([0x3f]);
  });

  it('round-trip estable con TextDecoder(windows-1252) fuera de 0x80–0x9F', () => {
    // El rango 0x80–0x9F (€, —, …) se valida a nivel de BYTE en el test del
    // encoder: el TextDecoder de este Node (small-icu) lo decodifica como
    // controles C1 aunque el byte cp1252 emitido sea correcto (en navegador
    // real devuelve €/—/…).
    const s = 'Fábrica de ladrillo · «cañón» ½ º Ç ü';
    expect(decode(encodeCp1252(s))).toBe(s);
  });
});

/* ---- cabecera, ~K y formato global ------------------------------------------ */
describe('obraToBc3 — cabecera y ~K', () => {
  it('emite ~V con ANSI, CRLF en todas las líneas y CRLF final', () => {
    const text = decode(obraToBc3(mini()));
    expect(text.startsWith('~V|Concreta|FIEBDC-3/2016|Concreta Mediciones||ANSI|\r\n')).toBe(true);
    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.replace(/\r\n/g, '')).not.toContain('\n'); // ningún LF suelto
  });

  it('K=1 → sin registro ~K (espejo de coefKOf, que devuelve 1 sin ~K)', () => {
    expect(rec(mini(), '~K|')).toBeUndefined();
  });

  it('K=1,13 → ~K de 7 grupos + EUR con pct 13; K<1 → pct negativo', () => {
    expect(rec(mini({}, { rates: { ...DEFAULT_RATES, coefK: 1.13 } }), '~K|')).toBe(
      String.raw`~K|\2\2\3\2\2\2\2\EUR\|13|`,
    );
    expect(rec(mini({}, { rates: { ...DEFAULT_RATES, coefK: 0.87 } }), '~K|')).toBe(
      String.raw`~K|\2\2\3\2\2\2\2\EUR\|-13|`,
    );
  });

  it('coefKPct redondea a 4 decimales (ruido float fuera)', () => {
    expect(coefKPct(1.1300000000000001)).toBe(13);
    expect(coefKPct(1.000004)).toBe(0.0004);
    expect(coefKPct(1)).toBe(0);
  });
});

/* ---- estructura: raíz, capítulos, partidas ---------------------------------- */
describe('obraToBc3 — conceptos y precios', () => {
  it('raíz `##` con precio = PEM CON K; ~D de la raíz sin marcador `#`', () => {
    const o = mini({}, { rates: { ...DEFAULT_RATES, coefK: 1.13 } });
    const pemEur = (pem(o.partidas, 1.13) / 100).toFixed(2).replace(/\.?0+$/, '');
    expect(rec(o, '~C|OBRA##')).toBe(`~C|OBRA##||Obra de prueba|${pemEur}||0|`);
    expect(rec(o, '~D|OBRA##')).toBe('~D|OBRA##|1\\1\\1\\|');
  });

  it('capítulo `#` con precio = Σ hijos CON K (Σ capítulos = raíz, como Presto)', () => {
    const o = mini({}, { rates: { ...DEFAULT_RATES, coefK: 1.13 } });
    const chPrice = parseFloat(rec(o, '~C|1#')!.split('|')[4]!);
    const rootPrice = parseFloat(rec(o, '~C|OBRA##')!.split('|')[4]!);
    expect(toCents(chPrice)).toBe(toCents(rootPrice));
    expect(toCents(chPrice)).toBe(pem(o.partidas, 1.13));
  });

  it('partida: precio en BASE (sin K) y cantidad 2 dec en la ~D del capítulo', () => {
    const o = mini({}, { rates: { ...DEFAULT_RATES, coefK: 1.13 } });
    expect(rec(o, '~C|D01|')).toBe('~C|D01|m²|Demolición de tabique|12.34||0|');
    // cantidad = 2·4,5·2,6 = 23,4 (ancho vacío = factor 1)
    expect(rec(o, '~D|1#')).toBe('~D|1#|D01\\1\\23.4\\|');
  });

  it('~D de partida: rendimientos 3 dec y %CI con cantidad = porcentaje', () => {
    expect(rec(mini(), '~D|D01')).toBe('~D|D01|mo001\\1\\0.45\\mt001\\1\\1.05\\%CI\\1\\3\\|');
  });

  it('recursos con tipo numérico (MO 1 · MQ 2 · MAT 3) y %CI como concepto %', () => {
    const o = mini({
      items: [
        { code: 'mo001', type: 'MO', cantidad: 0.5 },
        { code: 'mq001', type: 'MQ', cantidad: 0.12 },
        { code: 'mt001', type: 'MAT', cantidad: 1 },
        { code: '%CI', type: '%CI', cantidad: 3 },
      ],
    });
    o.recursos['mq001'] = { type: 'MQ', desc: 'Retro', ud: 'h', precio: 38.5 };
    expect(rec(o, '~C|mo001')).toBe('~C|mo001|h|Peón ordinario|17.52||1|');
    expect(rec(o, '~C|mq001')).toBe('~C|mq001|h|Retro|38.5||2|');
    expect(rec(o, '~C|mt001')).toBe('~C|mt001|mu|Ladrillo hueco|98.4||3|');
    expect(rec(o, '~C|%CI')).toBe('~C|%CI|%|Costes indirectos|0||0|');
  });

  it('los recursos huérfanos del banco NO se exportan (solo el árbol de la obra)', () => {
    const o = mini();
    o.recursos['mq999'] = { type: 'MQ', desc: 'Huérfano', ud: 'h', precio: 99 };
    expect(rec(o, '~C|mq999')).toBeUndefined();
  });

  it('~T con la descripción; sin desc no hay ~T', () => {
    expect(rec(mini(), '~T|D01')).toBe('~T|D01|Demolición de tabiquería.|');
    expect(rec(mini({ desc: '' }), '~T|D01')).toBeUndefined();
  });
});

/* ---- ~M: anclaje por índice y líneas ----------------------------------------- */
describe('obraToBc3 — ~M', () => {
  it('un ~M por partida (también sin medición: 0 líneas, conserva el anclaje)', () => {
    const o = mini();
    o.partidas['01']!.push({
      id: 'p2',
      pos: '1.2',
      code: 'D02',
      title: 'Transporte',
      ud: 'm³',
      precio: 8.9,
      cantidad: 18.5,
      desc: '',
      med: [],
      items: [],
    });
    const ms = records(o).filter((r) => r.startsWith('~M|'));
    expect(ms).toEqual([
      String.raw`~M|1#\D01|1\1\|23.4|\Planta baja\2\4.5\\2.6\|`,
      String.raw`~M|1#\D02|1\2\|18.5||`,
    ]);
  });

  it('línea con TODAS las dims vacías → uds=1 explícito (no es línea de sección)', () => {
    const o = mini({
      med: [
        { id: 'm1', comment: 'Unidad completa', uds: '', largo: '', ancho: '', alto: '' },
        { id: 'm2', comment: '', uds: 2, largo: 3, ancho: '', alto: '' },
      ],
    });
    // línea 1: \Unidad completa\1\\\\  ·  línea 2: \\2\3\\\
    expect(rec(o, '~M|1#')).toBe(String.raw`~M|1#\D01|1\1\|7|\Unidad completa\1\\\\\\2\3\\\|`);
  });
});

/* ---- sanitización ------------------------------------------------------------ */
describe('obraToBc3 — sanitización (BC3 no tiene escape)', () => {
  it('`|`→`¦` y `\\`→`/` en campos; saltos de línea de campos → espacio', () => {
    const o = mini({ title: 'Tabique|especial C\\D', ud: 'm²' });
    o.obra.denominacion = 'Obra\ncon salto';
    expect(rec(o, '~C|D01|')).toBe('~C|D01|m²|Tabique¦especial C/D|12.34||0|');
    expect(rec(o, '~C|OBRA##')).toContain('|Obra con salto|');
  });

  it('~T conserva saltos como CRLF y neutraliza `~` a inicio de línea', () => {
    const o = mini({ desc: 'Línea 1\n~K falso\nLínea 3 con barra \\' });
    const text = decode(obraToBc3(o));
    expect(text).toContain('~T|D01|Línea 1\r\n ~K falso\r\nLínea 3 con barra \\|');
  });
});

/* ===========================================================================
   Gate de fidelidad capa 2 (D5+D8): round-trip PROPIO exacto al céntimo.
   =========================================================================== */
describe('round-trip del seed: obraToBc3 → bc3ToObra EXACTO', () => {
  const seedObra = (coefK = 1): Bc3ExportObra => ({
    chapters: CHAPTERS,
    partidas: PARTIDAS,
    recursos: buildRecursos(PARTIDAS),
    rates: { ...DEFAULT_RATES, coefK },
    obra: { ...DEFAULT_OBRA },
  });

  it('estructura: mismos capítulos, partidas y recursos', () => {
    const { data, report } = bc3ToObra(obraToBc3(seedObra()));
    expect(data.chapters).toHaveLength(CHAPTERS.length);
    expect(report.partidas).toBe(Object.values(PARTIDAS).flat().length);
    expect(Object.keys(data.recursos).sort()).toEqual(Object.keys(buildRecursos(PARTIDAS)).sort());
    expect(data.obra.denominacion).toBe(DEFAULT_OBRA.denominacion);
  });

  it('PEM exacto al céntimo (26.291,91 € del seed) y raíz = PEM (delta 0)', () => {
    const { data, report } = bc3ToObra(obraToBc3(seedObra()));
    expect(pem(data.partidas, data.rates.coefK)).toBe(pem(PARTIDAS, 1));
    expect(pem(PARTIDAS, 1)).toBe(2629191); // ancla del seed
    expect(report.deltaCents).toBe(0); // raíz escrita = PEM recalculado, sin tolerancia
  });

  it('precios, cantidades, rendimientos y mediciones idénticos partida a partida', () => {
    const { data, report } = bc3ToObra(obraToBc3(seedObra()));
    const seedPs = Object.values(PARTIDAS).flat();
    const gotPs = Object.values(data.partidas).flat();
    expect(gotPs).toHaveLength(seedPs.length);
    seedPs.forEach((sp, i) => {
      const gp = gotPs[i]!;
      expect(gp.code).toBe(sp.code);
      expect(gp.precio).toBe(sp.precio);
      expect(partidaCantidad(gp)).toBe(partidaCantidad(sp));
      expect(gp.items.map((it) => [it.code, it.cantidad])).toEqual(sp.items.map((it) => [it.code, it.cantidad]));
      expect(gp.med).toHaveLength(sp.med.length);
      expect(gp.med.map((l) => l.comment)).toEqual(sp.med.map((l) => l.comment));
    });
    // toda medición del seed sobrevive el viaje (ninguna degradada a cantidad)
    expect(report.medVisible).toBe(seedPs.filter((p) => p.med.length).length);
  });

  it('con K=1,13: ~K viaja, PEM CON K exacto y raíz = PEM (delta 0)', () => {
    const { data, report } = bc3ToObra(obraToBc3(seedObra(1.13)));
    expect(data.rates.coefK).toBe(1.13);
    expect(pem(data.partidas, 1.13)).toBe(pem(PARTIDAS, 1.13));
    expect(report.deltaCents).toBe(0);
  });

  it('regresión dims=0 (D4): el import descarta la línea pero la cantidad y el PEM quedan', () => {
    // Línea con largo=0 (anulada, parcial 0): el import mapea 0→'' (factor 1),
    // el Σ de parciales deja de cuadrar y descarta la MEDICIÓN entera; la
    // cantidad viaja en la ~D del capítulo y el PEM no se mueve. Política de
    // mapeo del import documentada en la eng-review (D4), no aritmética.
    const o = mini({
      med: [
        { id: 'm1', comment: 'Tramo válido', uds: 2, largo: 4.5, ancho: '', alto: 2.6 },
        { id: 'm2', comment: 'Tramo anulado', uds: 1, largo: 0, ancho: '', alto: 2.6 },
      ],
    });
    const qty = partidaCantidad(o.partidas['01']![0]!); // 23,4 + 0
    const { data } = bc3ToObra(obraToBc3(o));
    const gp = Object.values(data.partidas).flat()[0]!;
    expect(gp.med).toHaveLength(0);
    expect(partidaCantidad(gp)).toBe(qty);
    expect(pem(data.partidas, 1)).toBe(pem(o.partidas, 1));
  });
});

/* ===========================================================================
   core/bc3export — tests de la spec F7.4 D1 registro a registro + gate de
   fidelidad capa 2 (D5): round-trip del seed export→`bc3ToObra` EXACTO al
   céntimo (los round-trips PROPIOS no tienen tolerancia — D8).
   =========================================================================== */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { coefKPct, encodeCp1252, obraToBc3, type Bc3ExportObra } from './bc3export';
import { bc3ToObra } from './bc3import';
import { buildRecursos, precioCuadraDescompuesto } from './banco';
import { partidaCantidad } from './medicion';
import { toCents } from './money';
import { CHAPTERS, DEFAULT_OBRA, DEFAULT_RATES, PARTIDAS } from './seed';
import { pem } from './totales';
import type { Partida } from './types';

const decode = (b: Uint8Array) => new TextDecoder('windows-1252').decode(b);
const records = (o: Bc3ExportObra) => decode(obraToBc3(o)).split('\r\n').filter(Boolean);
const rec = (o: Bc3ExportObra, prefix: string) => records(o).find((r) => r.startsWith(prefix));

/** Obra mínima configurable: 1 capítulo, partidas a medida. El precio por
 *  defecto CUADRA con el descompuesto (7,88 + 103,32 + 3 % = 114,54) para que
 *  la ~D viaje; los tests de override lo cambian a un precio manual. */
function mini(partida: Partial<Partida> = {}, over: Partial<Bc3ExportObra> = {}): Bc3ExportObra {
  const p: Partida = {
    id: 'p1',
    pos: '1.1',
    code: 'D01',
    title: 'Demolición de tabique',
    ud: 'm²',
    precio: 114.54,
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

/* ---- round-trip de jerarquía N niveles (Fase 1, 2026-06-12) ---------------- */
describe('round-trip N niveles: exportar → reimportar conserva el árbol', () => {
  it('obra sintética de 4 niveles: estructura, pos, mediciones y PEM exactos', () => {
    const p = (id: string, sub: string | undefined, pos: string, precio: number): Partida => ({
      id,
      sub,
      pos,
      code: id.toUpperCase(),
      title: `Partida ${id}`,
      ud: 'm2',
      precio,
      cantidad: 2,
      desc: '',
      med: [],
      items: [],
    });
    const obra: Bc3ExportObra = {
      chapters: [
        {
          id: '01',
          code: '1',
          title: 'Capítulo uno',
          children: [
            {
              id: '01.01',
              code: '1.1',
              title: 'Sub uno',
              children: [
                { id: '01.01.01', code: '1.1.1', title: 'Sub-sub A' },
                { id: '01.01.02', code: '1.1.2', title: 'Sub-sub B' },
              ],
            },
            { id: '01.02', code: '1.2', title: 'Sub dos' },
            { id: '01.03', code: '1.3', title: 'Sub vacío (también viaja)' },
          ],
        },
      ],
      partidas: {
        '01': [
          p('d1', undefined, '1.1', 10),
          p('a1', '01.01.01', '1.1.1.1', 20),
          p('a2', '01.01.01', '1.1.1.2', 30),
          p('b1', '01.01.02', '1.1.2.1', 40),
          // medición en una partida profunda: el ~M viaja anclado por la ruta
          {
            ...p('c1', '01.02', '1.2.1', 50),
            cantidad: undefined,
            med: [{ id: 'c1-m1', comment: 'Zona', uds: 2, largo: 3, ancho: '', alto: '' }],
          },
        ],
      },
      recursos: {},
      rates: { ...DEFAULT_RATES, coefK: 1 },
      obra: { ...DEFAULT_OBRA, denominacion: 'Obra profunda' },
    };

    const re = bc3ToObra(obraToBc3(obra));
    const ch = re.data.chapters[0]!;
    expect(ch.title).toBe('Capítulo uno');
    // El árbol vuelve con los mismos niveles, incluido el sub vacío.
    expect(ch.children!.map((s) => s.title)).toEqual([
      'Sub uno',
      'Sub dos',
      'Sub vacío (también viaja)',
    ]);
    expect(ch.children![0]!.children!.map((s) => s.title)).toEqual(['Sub-sub A', 'Sub-sub B']);
    // Partidas en su contenedor, con pos de ruta y cantidades intactas.
    const ps = re.data.partidas[ch.id]!;
    expect(ps.map((x) => [x.code, x.pos])).toEqual([
      ['D1', '1.1'],
      ['A1', '1.1.1.1'],
      ['A2', '1.1.1.2'],
      ['B1', '1.1.2.1'],
      ['C1', '1.2.1'],
    ]);
    // La medición profunda sobrevive (anclaje por ruta de posiciones).
    const c1 = ps.find((x) => x.code === 'C1')!;
    expect(c1.med.map((m) => [m.comment, m.uds, m.largo])).toEqual([['Zona', 2, 3]]);
    // PEM exacto (round-trip propio sin tolerancia, D8).
    expect(re.report.pemCents).toBe(pem(obra.partidas, 1));
    expect(re.report.deltaCents).toBe(0);
  });

  it('BCCA (banco real, 4 niveles): exportar → reimportar conserva jerarquía y conteos', () => {
    const file = resolve(process.cwd(), 'docs', 'spike', 'samples', 'BCCA2023_V02.bc3');
    if (!existsSync(file)) return; // muestra local, no viaja en CI
    const first = bc3ToObra(new Uint8Array(readFileSync(file)));
    const re = bc3ToObra(
      obraToBc3({
        chapters: first.data.chapters,
        partidas: first.data.partidas,
        recursos: first.data.recursos,
        rates: first.data.rates,
        obra: first.data.obra,
      }),
    );
    expect(re.data.chapters.map((c) => c.title)).toEqual(first.data.chapters.map((c) => c.title));
    // Mismos contenedores nivel a nivel (comparando títulos del árbol entero).
    const shape = (chs: typeof first.data.chapters): unknown =>
      chs.map((c) => ({ t: c.title, k: walk(c.children) }));
    const walk = (subs?: { title: string; children?: unknown[] }[]): unknown =>
      (subs ?? []).map((s) => ({ t: s.title, k: walk(s.children as never) }));
    expect(shape(re.data.chapters)).toEqual(shape(first.data.chapters));
    expect(re.report.partidas).toBe(first.report.partidas);
    expect(re.report.pemCents).toBe(first.report.pemCents);
    // Los 2 conceptos de código con byte no ASCII inicial que el parser (fork)
    // recupera del BCCA sobreviven al ciclo: el encoder cp1252 es round-trip
    // estable en 0x80–0x9F y sanCode no toca la identidad del código. Siguen
    // en el banco y en la justificación de su partida, en el mismo orden.
    const traps = (b: Record<string, unknown>): string[] =>
      Object.keys(b)
        .filter((c) => c.endsWith('KLLKJKJ') || c.endsWith('LKKJJHDD'))
        .sort();
    expect(traps(first.data.recursos)).toHaveLength(2);
    expect(traps(re.data.recursos)).toEqual(traps(first.data.recursos));
    const itemsOf = (d: typeof first.data, pcode: string): string[] =>
      Object.values(d.partidas)
        .flat()
        .find((p) => p.code === pcode)!
        .items.map((i) => i.code);
    expect(itemsOf(first.data, '06DPC80521').some((c) => c.endsWith('KLLKJKJ'))).toBe(true);
    // Módulo el sufijo de dedupe D2: en un BANCO un precio básico (TO00900) es
    // a la vez partida hoja («Precios Básicos») y recurso de justificaciones;
    // el export les da identidades separadas (TO00900 / TO00900.2) en vez de
    // fusionarlas en silencio como haría Presto. El código BASE se conserva.
    const base = (c: string): string => c.replace(/\.\d+$/, '');
    expect(itemsOf(re.data, '06DPC80521').map(base)).toEqual(itemsOf(first.data, '06DPC80521'));
    expect(itemsOf(re.data, '10LWW90040').map(base)).toEqual(itemsOf(first.data, '10LWW90040'));
  }, 60000);
});

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
    expect(rec(o, '~C|D01|')).toBe('~C|D01|m²|Demolición de tabique|114.54||0|');
    // cantidad = 2·4,5·2,6 = 23,4 (ancho vacío = factor 1)
    expect(rec(o, '~D|1#')).toBe('~D|1#|D01\\1\\23.4\\|');
  });

  it('~D de partida: rendimientos 3 dec y %CI como FRACCIÓN (3 % → 0.03, convención Presto)', () => {
    expect(rec(mini(), '~D|D01')).toBe(String.raw`~D|D01|mo001\1\0.45\mt001\1\1.05\%CI\1\0.03\|`);
  });

  it('precio manual (no cuadra con el descompuesto) → SIN ~D: Presto respeta el precio cerrado', () => {
    // Verificado con la trazadora en Presto real: con ~D, Presto recalcula el
    // precio del padre desde los hijos e ignora el del ~C → el PEM divergiría.
    const o = mini({ precio: 12.34, precioManual: true });
    expect(rec(o, '~C|D01|')).toBe('~C|D01|m²|Demolición de tabique|12.34||0|');
    expect(rec(o, '~D|D01')).toBeUndefined();
    expect(rec(o, '~C|mo001')).toBeUndefined(); // sus recursos tampoco viajan
  });

  it('recursos con tipo numérico (MO 1 · MQ 2 · MAT 3) y %CI como concepto % con el pct de precio', () => {
    // descompuesto: 8,76 + 4,62 + 98,4 = 111,78 + 3 % (3,35) = 115,13
    const o = mini({
      precio: 115.13,
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
    expect(rec(o, '~C|%CI')).toBe('~C|%CI|%|Costes indirectos|3||0|');
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
    expect(rec(o, '~C|D01|')).toBe('~C|D01|m²|Tabique¦especial C/D|114.54||0|');
    expect(rec(o, '~C|OBRA##')).toContain('|Obra con salto|');
  });

  it('~T conserva saltos como CRLF y neutraliza `~` a inicio de línea', () => {
    const o = mini({ desc: 'Línea 1\n~K falso\nLínea 3 con barra \\' });
    const text = decode(obraToBc3(o));
    expect(text).toContain('~T|D01|Línea 1\r\n ~K falso\r\nLínea 3 con barra \\|');
  });
});

/* ---- D2: códigos deterministas ------------------------------------------------ */
describe('obraToBc3 — códigos deterministas (D2)', () => {
  const otra = (over: Partial<Partida>): Partida => ({
    id: 'p2',
    pos: '1.2',
    code: 'D01',
    title: 'Demolición de tabique',
    ud: 'm²',
    precio: 114.54,
    desc: 'Demolición de tabiquería.',
    med: [],
    cantidad: 5,
    items: [
      { code: 'mo001', type: 'MO', cantidad: 0.45 },
      { code: 'mt001', type: 'MAT', cantidad: 1.05 },
      { code: '%CI', type: '%CI', cantidad: 3 },
    ],
    ...over,
  });

  it('homónimos DIVERGENTES → sufijo .2 (nada se fusiona en silencio)', () => {
    const o = mini();
    o.partidas['01']!.push(otra({ precio: 99, precioManual: true, title: 'Otra cosa' }));
    expect(rec(o, '~C|D01|')).toContain('|114.54||0|');
    expect(rec(o, '~C|D01.2|')).toBe('~C|D01.2|m²|Otra cosa|99||0|');
    expect(rec(o, '~D|1#')).toBe(String.raw`~D|1#|D01\1\23.4\D01.2\1\5\|`);
    const { data } = bc3ToObra(obraToBc3(o));
    expect(Object.values(data.partidas).flat().map((p) => p.precio)).toEqual([114.54, 99]);
  });

  it('homónimos IDÉNTICOS comparten concepto (la cantidad/medición viven en el padre)', () => {
    const o = mini();
    o.partidas['01']!.push(otra({}));
    const text = decode(obraToBc3(o));
    expect(text.match(/~C\|D01\|/g)).toHaveLength(1); // un solo ~C
    expect(rec(o, '~D|1#')).toBe(String.raw`~D|1#|D01\1\23.4\D01\1\5\|`);
    const ms = records(o).filter((r) => r.startsWith('~M|'));
    expect(ms).toHaveLength(2); // cada referencia conserva SU medición/cantidad
    const { data } = bc3ToObra(obraToBc3(o));
    const got = Object.values(data.partidas).flat();
    expect(got.map((p) => partidaCantidad(p))).toEqual([23.4, 5]);
  });

  it("códigos vacíos o '——' → generados (P001…); idénticos comparten el generado", () => {
    const o = mini({ code: '——' });
    o.partidas['01']!.push(otra({ code: '', precio: 99, precioManual: true }));
    o.partidas['01']!.push(otra({ id: 'p3', code: '', precio: 99, precioManual: true }));
    expect(rec(o, '~D|1#')).toBe(String.raw`~D|1#|P001\1\23.4\P002\1\5\P002\1\5\|`);
    expect(rec(o, '~C|P002|')).toBeDefined();
  });

  it('la dedupe corre TRAS sanitizar (sanitizar puede crear la colisión)', () => {
    const o = mini({ code: 'A|B' });
    o.partidas['01']!.push(otra({ code: 'A¦B', precio: 99, precioManual: true }));
    expect(rec(o, '~D|1#')).toBe(String.raw`~D|1#|A¦B\1\23.4\A¦B.2\1\5\|`);
  });

  it('una partida no puede pisar el código de un capítulo (ni de la raíz)', () => {
    const o = mini({ code: '1' }); // colisiona con el capítulo '1'
    expect(rec(o, '~D|1#')).toBe(String.raw`~D|1#|1.2\1\23.4\|`);
    expect(rec(o, '~C|1.2|')).toContain('Demolición de tabique');
  });

  it("un código de partida no puede empezar por '%' (lo reservan los conceptos porcentaje)", () => {
    const o = mini({ code: '%X' });
    expect(rec(o, '~D|1#')).toBe(String.raw`~D|1#|X\1\23.4\|`);
  });
});

/* ---- D3: subcapítulos anidados ------------------------------------------------ */
describe('obraToBc3 — subcapítulos anidados (D3)', () => {
  /** Cap 1 con una directa + sub 1.1 (dos partidas); sub 1.2 vacío. */
  function conSubs(): Bc3ExportObra {
    const o = mini();
    o.chapters = [
      {
        id: '01',
        code: '1',
        title: 'Demoliciones',
        children: [
          { id: '01.01', code: '1.1', title: 'Tabiquería' },
          { id: '01.02', code: '1.2', title: 'Sub vacío' },
        ],
      },
    ];
    const base = o.partidas['01']![0]!;
    o.partidas['01'] = [
      { ...base, id: 'd1', code: 'DIR01', sub: undefined },
      { ...base, id: 's1', code: 'SUB01', sub: '01.01' },
      { ...base, id: 's2', code: 'SUB02', sub: '01.01', precio: 99, precioManual: true, med: [], cantidad: 5 },
    ];
    return o;
  }

  it('el sub viaja como contenedor real; las directas van ANTES en la ~D del capítulo', () => {
    const o = conSubs();
    // El sub vacío 1.2 también viaja como entrada del ~D (taxonomía).
    expect(rec(o, '~D|1#')).toBe(String.raw`~D|1#|DIR01\1\23.4\1.1\1\1\1.2\1\1\|`);
    // Σ sub = 23,4·114,54 + 5·99 = 2.680,24 + 495 = 3.175,24
    expect(rec(o, '~C|1.1#')).toBe('~C|1.1#||Tabiquería|3175.24||0|');
    expect(rec(o, '~D|1.1#')).toBe(String.raw`~D|1.1#|SUB01\1\23.4\SUB02\1\5\|`);
    // ~M: la directa anclada al capítulo (1\1\), las del sub al sub (1\2\n\)
    const ms = records(o).filter((r) => r.startsWith('~M|'));
    expect(ms[0]).toContain(String.raw`~M|1#\DIR01|1\1\|`);
    expect(ms[1]).toContain(String.raw`~M|1.1#\SUB01|1\2\1\|`);
    expect(ms[2]).toContain(String.raw`~M|1.1#\SUB02|1\2\2\|`);
  });

  it('el sub VACÍO también viaja (la taxonomía es estructura; el «#» evita la partida fantasma)', () => {
    // Regla antigua: no viajaba, porque el import por-mediciones lo confundía
    // con una partida a 0. Con la detección por marcador «#» eso es imposible,
    // y descartarlos re-perdía la taxonomía de los bancos (BCCA: 1.177 grupos).
    expect(rec(conSubs(), '~C|1.2#')).toBe('~C|1.2#||Sub vacío|0||0|');
  });

  it('round-trip: el import conserva los subcapítulos con PEM exacto y mismo orden', () => {
    const o = conSubs();
    const { data, report } = bc3ToObra(obraToBc3(o));
    expect(report.chapters).toBe(1);
    expect(report.partidas).toBe(3);
    expect(Object.values(data.partidas).flat().map((p) => p.code)).toEqual(['DIR01', 'SUB01', 'SUB02']);
    const ch = data.chapters[0]!;
    expect(ch.children!.map((s) => s.title)).toEqual(['Tabiquería', 'Sub vacío']);
    const sub1 = ch.children![0]!;
    expect(Object.values(data.partidas).flat().filter((p) => p.sub === sub1.id)).toHaveLength(2);
    expect(pem(data.partidas, 1)).toBe(pem(o.partidas, 1));
    expect(report.deltaCents).toBe(0);
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

  /** ¿La justificación de esta partida viaja en el .bc3? (precio = descompuesto) */
  const banco = buildRecursos(PARTIDAS);
  const conDescomp = (p: Partida) => p.items.length > 0 && precioCuadraDescompuesto(p, banco);

  it('estructura: mismos capítulos, partidas y los recursos de las ~D que viajan', () => {
    const { data, report } = bc3ToObra(obraToBc3(seedObra()));
    expect(data.chapters).toHaveLength(CHAPTERS.length);
    expect(report.partidas).toBe(Object.values(PARTIDAS).flat().length);
    const expected = [
      ...new Set(
        Object.values(PARTIDAS)
          .flat()
          .filter(conDescomp)
          .flatMap((p) => p.items.filter((it) => it.type !== '%CI').map((it) => it.code)),
      ),
    ].sort();
    expect(Object.keys(data.recursos).sort()).toEqual(expected);
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
      // la justificación solo viaja si cuadra con el precio (precio manual →
      // partida alzada sin ~D, o Presto recalcularía el padre y movería el PEM)
      const wantItems = conDescomp(sp) ? sp.items.map((it) => [it.code, it.cantidad]) : [];
      expect(gp.items.map((it) => [it.code, it.cantidad])).toEqual(wantItems);
      expect(gp.med).toHaveLength(sp.med.length);
      expect(gp.med.map((l) => l.comment)).toEqual(sp.med.map((l) => l.comment));
    });
    // toda medición del seed sobrevive el viaje (ninguna degradada a cantidad)
    expect(report.medVisible).toBe(seedPs.filter((p) => p.med.length).length);
  });

  it('con K=1,13: el export escribe el K como CI del ~K; al reimportar se hornea (K→1) y el PEM se conserva', () => {
    const before = pem(PARTIDAS, 1.13);
    const { data, report } = bc3ToObra(obraToBc3(seedObra(1.13)));
    // coefK ya no round-trippea como multiplicador: viaja como CI del ~K y al
    // reimportar se hornea en los precios (línea %CI), dejando coefK=1.
    expect(data.rates.coefK).toBe(1);
    expect(report.ciPct).toBe(13);
    // El PEM se conserva salvo el redondeo del unitario a 2 decimales al hornear.
    expect(Math.abs(pem(data.partidas, 1) - before)).toBeLessThan(50); // < 0,50 €
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

/* ===========================================================================
   Gate capa 3 (D5): fixture Presto ANONIMIZADO commiteado — ejercita los
   quirks del dialecto que el writer no produce (fechas, ~T de raíz vacío,
   línea de sección en ~M, % con precio=pct y rendimiento=fracción, capítulo
   sin ~M, precios de capítulo/raíz con el redondeo de K POR PRECIO de Presto).
   =========================================================================== */
describe('gate capa 3: fixture Presto anonimizado', () => {
  const FIXTURE = resolve(process.cwd(), 'src', 'core', '__fixtures__', 'presto-mini.bc3');
  const bytes = new Uint8Array(readFileSync(FIXTURE));

  it('importa el dialecto: estructura, K, % como fracción→porcentaje y línea de sección filtrada', () => {
    const { data, report } = bc3ToObra(bytes);
    expect(report.chapters).toBe(2);
    expect(report.partidas).toBe(3);
    expect(report.coefK).toBe(1); // K en 1; el CI (10%) del ~K va como línea %CI
    expect(report.ciPct).toBe(10);
    expect(report.medVisible).toBe(2); // E01 (sección filtrada sin romper la suma) y E02; E03 sin ~M
    // E01: los directos + auxiliares originales, MÁS la línea «Costes indirectos»
    // (%CI) que añade el import; el % de la línea va anidado sobre el auxiliar.
    const e01 = Object.values(data.partidas).flat().find((p) => p.code === 'E01')!;
    expect(e01.items.slice(0, 2).map((it) => [it.code, it.cantidad])).toEqual([
      ['MO01', 0.2],
      ['%AUX', 2], // 0.02 del archivo → 2 % en el modelo (drive-by del import)
    ]);
    expect(e01.items.at(-1)).toMatchObject({ code: '%CI', type: '%CI' });
    expect(data.recursos['MO01']).toMatchObject({ type: 'MO', precio: 17 });
  });

  it('re-export → re-import: PEM, estructura y mediciones ESTABLES (idempotencia)', () => {
    const a = bc3ToObra(bytes);
    const b = bc3ToObra(obraToBc3(a.data));
    // El CI ya viaja horneado (líneas %CI), así que el re-import no añade más
    // (su ~K no trae CI → coefK=1, ciPct=0): el árbol queda ESTABLE.
    expect(pem(b.data.partidas, b.data.rates.coefK)).toBe(pem(a.data.partidas, a.data.rates.coefK));
    expect(b.report.chapters).toBe(a.report.chapters);
    expect(b.report.partidas).toBe(a.report.partidas);
    expect(b.report.medVisible).toBe(a.report.medVisible);
    expect(b.report.deltaCents).toBe(0); // nuestra raíz = nuestro PEM exacto
    const ea = Object.values(a.data.partidas).flat().find((p) => p.code === 'E01')!;
    const eb = Object.values(b.data.partidas).flat().find((p) => p.code === 'E01')!;
    // Mismos items (incl. la línea %CI) tras el viaje completo.
    expect(eb.items.map((it) => [it.code, it.cantidad])).toEqual(
      ea.items.map((it) => [it.code, it.cantidad]),
    );
  });
});

/* ===========================================================================
   Gate capa 4 (D5): round-trip del .bc3 REAL — LOCAL-ONLY skip-if-missing
   (docs/spike/samples/ no está en git: datos de cliente).
   =========================================================================== */
const REAL = resolve(process.cwd(), 'docs', 'spike', 'samples', 'obra ejemplo.bc3');
describe.skipIf(!existsSync(REAL))('gate capa 4: round-trip del .bc3 real (local-only)', () => {
  it('import → export → import: PEM exacto, estructura y mediciones estables', () => {
    const a = bc3ToObra(new Uint8Array(readFileSync(REAL)));
    const b = bc3ToObra(obraToBc3(a.data));
    expect(pem(b.data.partidas, b.data.rates.coefK)).toBe(pem(a.data.partidas, a.data.rates.coefK));
    expect(b.report.chapters).toBe(a.report.chapters); // 19
    expect(b.report.partidas).toBe(a.report.partidas); // 167
    expect(b.report.medVisible).toBe(a.report.medVisible);
    expect(b.report.coefK).toBe(a.report.coefK);
    expect(b.report.deltaCents).toBe(0);
    // precio y cantidad partida a partida (los códigos pueden ganar sufijo .2 por dedupe)
    const pa = Object.values(a.data.partidas).flat();
    const pb = Object.values(b.data.partidas).flat();
    pa.forEach((p, i) => {
      expect(pb[i]!.precio).toBe(p.precio);
      expect(partidaCantidad(pb[i]!)).toBe(partidaCantidad(p));
    });
  });
});

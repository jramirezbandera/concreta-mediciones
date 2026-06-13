import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bc3ToObra, Bc3ImportError, summarizeParserWarnings } from './bc3import';
import { toEur } from './money';
import { pem as pemOf } from './totales';

/** Lee un .bc3 de muestra del spike como bytes (ruta absoluta -> fs de Node, no
 *  pasa por la resolución de assets de Vite). Vitest corre desde la raíz. */
function sample(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(process.cwd(), 'docs', 'spike', 'samples', name)));
}

describe('bc3ToObra — import de obra real (Presto)', () => {
  const { data, report } = bc3ToObra(sample('obra ejemplo.bc3'));

  it('mapea la estructura: 19 capítulos · 167 partidas', () => {
    expect(report.chapters).toBe(19);
    expect(report.partidas).toBe(167);
    expect(data.chapters).toHaveLength(19);
    expect(Object.values(data.partidas).reduce((s, ps) => s + ps.length, 0)).toBe(167);
  });

  it('el CI del ~K (+13%) entra como línea %CI, no como coefK (K = palanca del usuario)', () => {
    expect(report.coefK).toBe(1); // K queda en 1; ya NO carga el CI del banco
    expect(data.rates.coefK).toBe(1);
    expect(report.ciPct).toBe(13); // el 13% del ~K va como «Costes indirectos»
  });

  it('el PEM (motor) cuadra con el precio raíz del .bc3 (ruido de redondeo)', () => {
    // El CI va horneado en el precio de cada partida como línea %CI (coefK=1).
    // La desviación frente a la raíz es ruido de redondeo del unitario a 2
    // decimales + el redondeo de la línea %CI (anidada sobre medios auxiliares
    // en las partidas que los traen); sobre ~491.298 € son ~1,8 € (0,0004%).
    expect(report.rootPriceCents).not.toBeNull();
    expect(Math.abs(report.deltaCents!)).toBeLessThan(300); // < 3 €
    // y el motor recalcula el mismo PEM que el report.
    expect(pemOf(data.partidas, data.rates.coefK)).toBe(report.pemCents);
    // sanity: ~491.298 €
    expect(toEur(report.pemCents)).toBeGreaterThan(490_000);
    expect(toEur(report.pemCents)).toBeLessThan(492_000);
  });

  it('importa el banco de recursos y las líneas de medición de algunas partidas', () => {
    expect(report.recursos).toBeGreaterThan(100);
    // 120/167 con la alineación por POSICIÓN (por índice eran 111: el ~M que
    // falta en C03 desplazaba el resto). Las 47 restantes no traen ~M o su
    // detalle no reproduce la cantidad (fórmulas, etc.).
    expect(report.medVisible).toBe(120);
    // ningún recurso del banco es de tipo %CI (los % no entran al banco)
    expect(Object.values(data.recursos).every((r) => r.type !== '%CI')).toBe(true);
  });

  it('marca las partidas como BASE y arranca una certificación en blanco', () => {
    const first = Object.values(data.partidas).flat()[0]!;
    expect(first.fromBase).toBe(true);
    expect(first.baseSource).toBe('Importado .bc3');
    expect(data.certs).toHaveLength(1);
    expect(data.certs[0]!.data).toEqual({});
  });

  it('decodifica con el charset declarado (ANSI → windows-1252)', () => {
    expect(report.charset).toBe('windows-1252');
    expect(report.program).toContain('Presto');
  });

  it('conserva los subcapítulos como children y agrupa sus partidas (sub/pos)', () => {
    const withSubs = data.chapters.filter((c) => c.children?.length);
    expect(withSubs.length).toBeGreaterThan(0);
    const ch = withSubs[0]!;
    const sub = ch.children![0]!;
    const grouped = data.partidas[ch.id]!.filter((p) => p.sub === sub.id);
    expect(grouped.length).toBeGreaterThan(0);
    expect(grouped[0]!.pos.startsWith(`${sub.code}.`)).toBe(true);
  });
});

describe('bc3ToObra — banco de precios (BCCA 2023, sin mediciones ~M)', () => {
  const { data, report } = bc3ToObra(sample('BCCA2023_V02.bc3'));

  it('detecta los capítulos por el marcador FIEBDC «#»: 3 capítulos · 20 subcapítulos cada uno', () => {
    // El ~D de la raíz «##» referencia «-BAS»/«-AUX»/«-UNI»; el parser (fork)
    // ya enlaza códigos con prefijo no alfanumérico → los 3 capítulos reales.
    expect(data.chapters.map((c) => c.title)).toEqual([
      'Precios Básicos',
      'Precios Auxiliares',
      'Precios Unitarios',
    ]);
    expect(data.chapters.every((c) => c.children?.length === 20)).toBe(true);
    expect(report.partidas).toBe(11798);
    expect(report.recursos).toBeGreaterThan(4000);
  });

  it('el BCCA importa SIN avisos del parser: los códigos «-XXX»/byte raro enlazan (fork)', () => {
    // Antes del fork: 4 avisos «child code "1"» (el parser descartaba el código
    // real del ~D y leía su factor como código hijo) y DOS conceptos PERDIDOS
    // («�KLLKJKJ»/«�LKKJJHDD»: ~C reales con precio cuyo código empieza por un
    // byte no ASCII). Ahora todo enlaza y no queda ningún aviso.
    expect(report.warnings.filter((w) => w.includes('Aviso del parser'))).toEqual([]);
    // Los dos conceptos antes perdidos entran al banco como recursos reales.
    const codes = Object.keys(data.recursos);
    expect(codes.some((c) => c.endsWith('KLLKJKJ'))).toBe(true);
    expect(codes.some((c) => c.endsWith('LKKJJHDD'))).toBe(true);
  });

  it('conserva los niveles profundos del banco (ÁRIDOS Y PIEDRAS → Arenas → precios)', () => {
    const basicos = data.chapters[0]!;
    const aridos = basicos.children![0]!;
    expect(aridos.title).toBe('ÁRIDOS Y PIEDRAS');
    expect(aridos.children!.length).toBeGreaterThan(0); // Arenas, Gravas… ya no se aplanan
    const arenas = aridos.children![0]!;
    expect(arenas.code).toBe('1.1.1');
    // Las partidas hoja cuelgan de su contenedor INMEDIATO, con pos de ruta.
    const arena = Object.values(data.partidas)
      .flat()
      .find((p) => p.code === 'AA00100')!;
    expect(arena.sub).toBe(arenas.id);
    expect(arena.pos.startsWith('1.1.1.')).toBe(true);
  });

  it('las partidas hoja llegan con código, ud y precio del banco', () => {
    const arena = Object.values(data.partidas)
      .flat()
      .find((p) => p.code === 'AA00100')!;
    expect(arena.title).toBe('ARENA CERNIDA');
    expect(arena.ud).toBe('m3');
    // Un precio BÁSICO (recurso type 3) NO lleva CI: Arquímedes lo muestra a su
    // valor de cuadro (12,76). El CI solo entra en las partidas compuestas.
    expect(arena.precio).toBe(12.76);
    expect(arena.sub).toBeTruthy();
    // El banco trae rendimiento explícito 0 en los ~D hoja → cantidad 0 y PEM 0.
    expect(arena.cantidad).toBe(0);
    expect(report.pemCents).toBe(0);
  });

  it('la denominación e IVA vienen del ~K; el CI (13%) va como línea, K=1', () => {
    expect(data.obra.denominacion).toBe('BANCO DE COSTE DE LA CONSTRUCCIÓN DE ANDALUCÍA');
    expect(report.coefK).toBe(1); // K en 1; el 13% del ~K va como %CI
    expect(report.ciPct).toBe(13);
    expect(data.rates.iva).toBe(0.21); // el ~K del BCCA declara IVA 21
  });
});

describe('bc3ToObra — errores', () => {
  it('lanza Bc3ImportError ante un archivo no .bc3', () => {
    const bytes = new TextEncoder().encode('esto no es un fichero FIEBDC');
    expect(() => bc3ToObra(bytes)).toThrow(Bc3ImportError);
  });
});

/* ---- fixtures sintéticos FIEBDC (auditoría 2026-06) ------------------------ */
const bc3 = (...recs: string[]): Uint8Array =>
  new TextEncoder().encode(['~V|prog|FIEBDC-3/2016|prog|||ANSI||2|||', ...recs].join('\r\n') + '\r\n');
const OBRA_MIN = [
  '~C|R##||Obra|100|010101|0|',
  '~C|C1#||Cap|100|010101|0|',
  '~D|R##|C1\\1\\1|',
];
const allPartidas = (r: ReturnType<typeof bc3ToObra>) => Object.values(r.data.partidas).flat();

describe('bc3ToObra — semántica FIEBDC (fixtures sintéticos)', () => {
  it('cantidad = FACTOR × RENDIMIENTO, en partidas y en la justificación', () => {
    const r = bc3ToObra(
      bc3(
        ...OBRA_MIN,
        '~C|P1|m2|Part|5|010101|0|',
        '~C|MAT1|u|Mat|1|010101|3|',
        '~D|C1#|P1\\2\\5|', // 2 × 5 = 10
        '~D|P1|MAT1\\3\\2|', // 3 × 2 = 6
      ),
    );
    const p = allPartidas(r)[0]!;
    expect(p.cantidad).toBe(10);
    expect(p.items[0]!.cantidad).toBe(6);
  });

  it('factor/rendimiento VACÍOS valen 1 (espec); el 0 explícito se conserva', () => {
    const r = bc3ToObra(
      bc3(
        ...OBRA_MIN,
        '~C|P1|m2|Sin rendimiento|5|010101|0|',
        '~C|P2|m2|Rendimiento cero|5|010101|0|',
        '~D|C1#|P1\\\\\\P2\\1\\0|',
      ),
    );
    const [p1, p2] = allPartidas(r);
    expect(p1!.cantidad).toBe(1);
    expect(p2!.cantidad).toBe(0);
  });

  it('alinea cada ~M con su partida por POSICIÓN, no por orden de archivo', () => {
    const r = bc3ToObra(
      bc3(
        ...OBRA_MIN,
        '~C|P1|m2|P uno|1|010101|0|',
        '~C|P2|m2|P dos|1|010101|0|',
        '~D|C1#|P1\\1\\10\\P2\\1\\10|',
        // ~M en orden INVERSO al ~D y con totales iguales: por índice, cada
        // partida heredaría la medición de la otra sin que el guard lo detecte.
        '~M|C1#\\P2|1\\2\\|10|\\linea de P2\\2\\5\\\\\\|',
        '~M|C1#\\P1|1\\1\\|10|\\linea de P1\\1\\10\\\\\\|',
      ),
    );
    const [p1, p2] = allPartidas(r);
    expect(p1!.med.map((m) => m.comment)).toEqual(['linea de P1']);
    expect(p2!.med.map((m) => m.comment)).toEqual(['linea de P2']);
  });

  it('ignora líneas de subtotal/fórmula (TIPO 1/2/3) del ~M', () => {
    const r = bc3ToObra(
      bc3(
        ...OBRA_MIN,
        '~C|P1|m2|Part|1|010101|0|',
        '~D|C1#|P1\\1\\2|',
        // línea normal (suma 2) + subtotal TIPO 1 con uds que corrompería la suma
        '~M|C1#\\P1|1\\1\\|2|\\linea\\2\\\\\\\\1\\Subtotal\\2\\\\\\|',
      ),
    );
    const p = allPartidas(r)[0]!;
    expect(p.med.map((m) => m.comment)).toEqual(['linea']);
  });

  it('conserva la jerarquía de N niveles (sub-subcapítulos anidados, sin aplanar)', () => {
    // CAP → SUB1 → {SSA, SSB} → partidas; CAP → SUB2 → partida
    const r = bc3ToObra(
      bc3(
        ...OBRA_MIN,
        '~C|SUB1#||Subcapitulo 1.1|0|010101|0|',
        '~C|SSA#||Sub-sub A|0|010101|0|',
        '~C|SSB#||Sub-sub B|0|010101|0|',
        '~C|SUB2#||Subcapitulo 1.2|0|010101|0|',
        '~C|P1|m2|Partida 1|10|010101|0|',
        '~C|P2|m2|Partida 2|10|010101|0|',
        '~C|P3|m2|Partida 3|10|010101|0|',
        '~C|P4|m2|Partida 4|10|010101|0|',
        '~D|C1#|SUB1\\1\\1\\SUB2\\1\\1|',
        '~D|SUB1#|SSA\\1\\1\\SSB\\1\\1|',
        '~D|SSA#|P1\\1\\1\\P2\\1\\1|',
        '~D|SSB#|P3\\1\\1|',
        '~D|SUB2#|P4\\1\\1|',
      ),
    );
    const ch = r.data.chapters[0]!;
    const sub1 = ch.children![0]!;
    expect(sub1.title).toBe('Subcapitulo 1.1');
    expect(sub1.children!.map((s) => [s.code, s.title])).toEqual([
      ['1.1.1', 'Sub-sub A'],
      ['1.1.2', 'Sub-sub B'],
    ]);
    const ps = r.data.partidas[ch.id]!;
    expect(ps.map((p) => [p.code, p.pos, p.sub])).toEqual([
      ['P1', '1.1.1.1', sub1.children![0]!.id],
      ['P2', '1.1.1.2', sub1.children![0]!.id],
      ['P3', '1.1.2.1', sub1.children![1]!.id],
      ['P4', '1.2.1', ch.children![1]!.id],
    ]);
  });

  it('un contenedor reutilizado en dos ramas se CLONA (con aviso), no se pierde', () => {
    // COMUN# cuelga de C1 y de C2: el árbol exige una copia por rama.
    const r = bc3ToObra(
      bc3(
        '~C|R##||Obra|100|010101|0|',
        '~C|C1#||Cap uno|0|010101|0|',
        '~C|C2#||Cap dos|0|010101|0|',
        '~C|COMUN#||Grupo comun|0|010101|0|',
        '~C|P1|m2|Part|5|010101|0|',
        '~D|R##|C1\\1\\1\\C2\\1\\1|',
        '~D|C1#|COMUN\\1\\1|',
        '~D|C2#|COMUN\\1\\1|',
        '~D|COMUN#|P1\\1\\2|',
      ),
    );
    expect(r.data.chapters).toHaveLength(2);
    expect(r.data.chapters[0]!.children![0]!.title).toBe('Grupo comun');
    expect(r.data.chapters[1]!.children![0]!.title).toBe('Grupo comun');
    expect(r.report.partidas).toBe(2); // P1 instanciada en ambas ramas
    expect(r.report.warnings.some((w) => w.includes('reutilizan'))).toBe(true);
  });

  it('un ~D cíclico no revienta: se corta y se avisa', () => {
    const r = bc3ToObra(
      bc3(
        '~C|R##||Obra|100|010101|0|',
        '~C|A#||CapA|100|010101|0|',
        '~C|B#||CapB|100|010101|0|',
        '~C|P1|m2|Part|5|010101|0|',
        '~D|R##|A\\1\\1|',
        '~D|A#|B\\1\\1|',
        '~D|B#|A\\1\\1\\P1\\1\\2|',
      ),
    );
    expect(r.report.partidas).toBe(1);
    expect(r.report.warnings.some((w) => w.includes('circulares'))).toBe(true);
  });

  it('un hijo referenciado sin ~C genera aviso visible (antes se perdía en silencio)', () => {
    const r = bc3ToObra(
      bc3(...OBRA_MIN, '~C|P1|m2|Part|5|010101|0|', '~D|C1#|P1\\1\\2\\GHOST\\1\\3|'),
    );
    expect(r.report.partidas).toBe(1);
    expect(r.report.warnings.some((w) => w.includes('GHOST'))).toBe(true);
  });

  it('summarizeParserWarnings agrupa miles de diags por categoría (no los vuelca crudos)', () => {
    const diags = [
      // 3 missing-child de DOS códigos distintos + 1500 registros ~F + 16 ~P.
      { level: 'warn', code: 'BC3_D_MISSING_CHILD_CODE', message: '~D child code "AAA" under parent "P"' },
      { level: 'warn', code: 'BC3_D_MISSING_CHILD_CODE', message: '~D child code "AAA" under parent "Q"' },
      { level: 'warn', code: 'BC3_D_MISSING_CHILD_CODE', message: '~D child code "BBB" under parent "R"' },
      ...Array.from({ length: 1500 }, () => ({ level: 'warn', code: 'BC3_UNKNOWN_RECORD', message: 'x', recordType: 'F' })),
      ...Array.from({ length: 16 }, () => ({ level: 'warn', code: 'BC3_UNKNOWN_RECORD', message: 'x', recordType: 'P' })),
      { level: 'info', code: 'X', message: 'INFO_NO_DEBE_SALIR' },
    ];
    const out = summarizeParserWarnings(diags);
    // Una línea por categoría (missing-child y unknown-record), no 1519.
    expect(out).toHaveLength(2);
    const mc = out.find((w) => w.includes('conceptos inexistentes'))!;
    expect(mc).toContain('3 referencias');
    expect(mc).toContain('«AAA»'); // ejemplos del código, deduplicados
    expect(mc).toContain('«BBB»');
    const ur = out.find((w) => w.includes('no soportado'))!;
    expect(ur).toContain('1516 registros');
    expect(ur).toContain('~F (ficheros adjuntos (PDF/fichas)) ×1500');
    expect(ur).toContain('~P (conceptos paramétricos) ×16');
    // info fuera.
    expect(out.some((w) => w.includes('INFO_NO_DEBE_SALIR'))).toBe(false);
  });

  it('códigos con prefijo no alfanumérico («-BAS») enlazan en el ~D (quirk BCCA, parser fork)', () => {
    const r = bc3ToObra(
      bc3(
        '~C|R##||Obra|0|010101|0|',
        '~C|-BAS#||Basicos|0|010101|0|',
        '~C|P1|m2|Part|10|010101|0|',
        '~D|R##|-BAS\\1\\1|',
        '~D|-BAS#|P1\\1\\2|',
      ),
    );
    expect(r.data.chapters.map((c) => c.title)).toEqual(['Basicos']);
    expect(allPartidas(r)).toHaveLength(1);
    expect(allPartidas(r)[0]!.cantidad).toBe(2);
    expect(r.report.warnings.filter((w) => w.includes('child code'))).toEqual([]);
  });

  it('un código marca-de-agua (byte no ASCII, sin ~C) no desalinea el triplete del ~D', () => {
    const r = bc3ToObra(
      bc3(
        ...OBRA_MIN,
        '~C|P1|m2|Part|10|010101|0|',
        '~C|MO1|h|Peon|10|010101|1|',
        '~C|MA1|t|Arena|5|010101|3|',
        '~D|C1#|P1\\1\\2|',
        '~D|P1|MO1\\1\\0.5\\MA1\\1\\0.25\\ñXXWATER\\1\\1|',
      ),
    );
    const p = allPartidas(r)[0]!;
    // Los recursos reales sobreviven con sus rendimientos SIN desalinear
    // (antes el código fantasma rompía el triplete y su factor «1» se leía
    // como código hijo).
    expect(p.items.map((i) => i.code)).toEqual(['MO1', 'MA1']);
    expect(p.items.map((i) => i.cantidad)).toEqual([0.5, 0.25]);
    // El aviso nombra el código fantasma REAL, no un «1» desalineado.
    expect(r.report.warnings.some((w) => w.includes('XXWATER'))).toBe(true);
    expect(r.report.warnings.some((w) => w.includes('"1"'))).toBe(false);
  });

  it('importa GG/BI/IVA del ~K cuando vienen > 0 y avisa de la BAJA', () => {
    const r = bc3ToObra(
      bc3(
        '~K|\\2\\2\\2\\2\\2\\2\\2\\EUR\\|13\\17\\6\\10\\21|',
        ...OBRA_MIN,
        '~C|P1|m2|Part|5|010101|0|',
        '~D|C1#|P1\\1\\2|',
      ),
    );
    expect(r.report.coefK).toBe(1); // K en 1; el CI (13%) va como %CI / precio
    expect(r.report.ciPct).toBe(13);
    expect(r.data.rates.gg).toBe(0.17);
    expect(r.data.rates.bi).toBe(0.06);
    expect(r.data.rates.iva).toBe(0.21);
    expect(r.report.warnings.some((w) => w.includes('baja del 10%'))).toBe(true);
  });
});

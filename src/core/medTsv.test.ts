import { describe, expect, it } from 'vitest';
import { lineaParaDestino } from './medPaste';
import { lineasATsv, normalizarTsv, parseTsv, textoErrorTsv, type TsvError } from './medTsv';
import type { MedLine } from './types';

const line = (over: Partial<MedLine>): MedLine => ({
  id: 'x',
  comment: '',
  uds: '',
  largo: '',
  ancho: '',
  alto: '',
  ...over,
});

/** Lee y exige éxito. */
function ok(text: string): MedLine[] {
  const r = parseTsv(text);
  if (!r.ok) throw new Error(`esperaba éxito: ${JSON.stringify(r.error)}`);
  return r.lines;
}
/** Lee y exige error. */
function err(text: string): TsvError {
  const r = parseTsv(text);
  if (r.ok) throw new Error('esperaba un error');
  return r.error;
}
const rot = (s: string) => ({ uds: 'Uds', largo: 'Largo', ancho: 'Ancho', alto: 'Alto' })[s] ?? s;

describe('escribir TSV', () => {
  it('5 columnas, coma decimal, sin miles, casilla vacía = celda vacía, el VALOR y no la operación', () => {
    const tsv = lineasATsv([
      line({ comment: 'Salón', uds: 2, largo: 1234.5, alto: 2.6 }),
      line({ comment: 'Pasillo', uds: 1, largo: 316.3978, expr: { largo: '300+16,3978' } }),
    ]);
    expect(tsv).toBe('Salón\t2\t1234,5\t\t2,6\nPasillo\t1\t316,3978\t\t');
  });

  it('el comentario pierde tabuladores y saltos', () => {
    expect(lineasATsv([line({ comment: 'Uno\tdos\nlínea' })])).toBe('Uno dos línea\t\t\t\t');
  });

  it("antepone ' a lo que una hoja tomaría por fórmula o por número", () => {
    const c = (comment: string) => lineasATsv([line({ comment })]).split('\t')[0];
    expect(c('=SUMA(A1)')).toBe("'=SUMA(A1)");
    expect(c('+34')).toBe("'+34");
    expect(c('- Hueco puerta')).toBe("'- Hueco puerta");
    expect(c('@usuario')).toBe("'@usuario");
    expect(c("'citado")).toBe("''citado");
    expect(c('123')).toBe("'123");
    expect(c('2,5')).toBe("'2,5");
    expect(c('Eje 12')).toBe('Eje 12');
  });
});

describe('ida y vuelta Concreta → TSV → Concreta', () => {
  it('queda igual salvo `expr` (se escribe el valor)', () => {
    const lines = [
      line({ comment: 'Zanjas', uds: 1, largo: 85, ancho: 0.6, alto: 1.2 }),
      line({ comment: '- Hueco puerta', uds: -1, largo: 0.8, alto: 2.1 }),
      line({ comment: '', uds: 3 }),
      line({ comment: '=raro', largo: 316.3978, expr: { largo: '300+16,3978' } }),
    ];
    const back = ok(lineasATsv(lines));
    expect(back).toEqual(lines.map((l) => ({ ...l, id: '', expr: undefined })).map(({ expr: _e, ...l }) => l));
  });

  it('un comentario numérico vuelve como comentario, no como uds', () => {
    expect(ok(lineasATsv([line({ comment: '123' })]))[0]).toMatchObject({ comment: '123', uds: '' });
  });

  it("«'123⇥⇥⇥⇥» es un comentario «123»", () => {
    expect(ok("'123\t\t\t\t")[0]).toMatchObject({ comment: '123', uds: '' });
  });

  it("un ' literal al principio del comentario sobrevive", () => {
    expect(ok(lineasATsv([line({ comment: "'citado" })]))[0]!.comment).toBe("'citado");
  });
});

describe('leer TSV de una hoja de cálculo', () => {
  it('«IPE300⇥2⇥9,50» en una partida por Peso rellena el kg/m', () => {
    const [l] = ok('IPE300\t2\t9,50');
    expect(l).toMatchObject({ comment: 'IPE300', uds: 2, largo: 9.5 });
    const enPeso = lineaParaDestino(l!, 'peso');
    expect(enPeso.ancho).toBeCloseTo(42.2, 1);
  });

  it('sin texto en la 1.ª columna, todas son casillas desde uds', () => {
    expect(ok('2\t3,5\n1\t4')).toMatchObject([
      { comment: '', uds: 2, largo: 3.5 },
      { comment: '', uds: 1, largo: 4 },
    ]);
  });

  it('la disposición se decide UNA vez para todo el bloque', () => {
    // La 2.ª fila tiene texto: la 1.ª columna es comentario también en la 1.ª.
    expect(ok('12\t2\nMuro\t3')).toMatchObject([
      { comment: '12', uds: 2 },
      { comment: 'Muro', uds: 3 },
    ]);
  });

  it('CRLF, salto final y filas vacías del final no cuentan; las del medio sí', () => {
    expect(ok('A\t1\r\n\r\nB\t2\r\n\t\r\n\r\n')).toHaveLength(3);
  });

  it('«9.50» es 9,5 y «0.125» es 0,125 (punto decimal sin ambigüedad)', () => {
    expect(ok('9.50')[0]!.uds).toBe(9.5);
    expect(ok('0.125')[0]!.uds).toBe(0.125);
    expect(ok('1.234,56')[0]!.uds).toBe(1234.56); // formato español con miles
  });

  it('operaciones y perfiles se leen como al teclear (y guardan la operación)', () => {
    const [l] = ok('Vigas\t2*3\t5,57+3,2');
    expect(l).toMatchObject({ uds: 6, largo: 8.77, expr: { uds: '2*3', largo: '5,57+3,2' } });
  });

  it('un comentario entre comillas con salto de línea y comillas dobladas', () => {
    const [l] = ok('"Muro ""norte""\nplanta 1"\t2');
    expect(l).toMatchObject({ comment: 'Muro "norte"\nplanta 1', uds: 2 });
  });
});

describe('rechazos, con fila y columna', () => {
  it('«1.234» es ambiguo (miles o decimal): se rechaza', () => {
    const e = err('A\t1\nB\t1.234');
    expect(e).toMatchObject({ kind: 'cell', row: 2, col: 'uds', reason: 'ambiguo', value: '1.234' });
    expect(textoErrorTsv(e, rot)).toBe('No se pudo pegar: fila 2, Uds «1.234» es ambiguo. Pégalo sin separador de miles');
  });

  it('«-1.234» y «1.234+2» también (número a número)', () => {
    expect(err('A\t-1.234')).toMatchObject({ reason: 'ambiguo' });
    expect(err('A\t1.234+2')).toMatchObject({ reason: 'ambiguo' });
  });

  it('«1,234.56» (punto decimal inglés) se rechaza', () => {
    expect(err('A\t1\t1,234.56')).toMatchObject({ row: 1, col: 'largo', reason: 'ingles' });
  });

  it('más de una coma en un número se rechaza', () => {
    expect(err('A\t1,2,3')).toMatchObject({ reason: 'comas' });
  });

  it('«1e400» no es una cifra', () => {
    expect(err('A\t1e400')).toMatchObject({ kind: 'cell', reason: 'ilegible' });
  });

  it('un parcial que no es finito se rechaza', () => {
    const big = '9'.repeat(150);
    expect(err(`A\t${big}\t${big}\t${big}`)).toMatchObject({ kind: 'infinito', row: 1 });
  });

  it("una casilla que empieza por ' es texto, no una cifra", () => {
    expect(err("A\t'2")).toMatchObject({ reason: 'texto' });
  });

  it('más de 5 columnas', () => {
    const e = err('A\t1\t2\t3\t4\t5');
    expect(textoErrorTsv(e, rot)).toBe('Fila 1: 6 columnas; admite comentario y 4 casillas');
  });

  it('más de 500 filas', () => {
    const e = err(Array.from({ length: 501 }, (_, i) => `L${i}\t1`).join('\n'));
    expect(textoErrorTsv(e, rot)).toMatch(/^Solo se pegan hasta 500 filas/);
    expect(ok(Array.from({ length: 500 }, (_, i) => `L${i}\t1`).join('\n'))).toHaveLength(500);
  });

  it('50 000 «(» dan un error controlado, sin colgarse', () => {
    const t0 = performance.now();
    expect(err('('.repeat(50_000))).toMatchObject({ kind: 'cell', col: 'comment', reason: 'largo' });
    expect(err(`A\t${'('.repeat(50_000)}`)).toMatchObject({ kind: 'cell', reason: 'largo' });
    expect(performance.now() - t0).toBeLessThan(1000);
  });

  it('más de 200 000 caracteres', () => {
    expect(err('a'.repeat(200_001))).toMatchObject({ kind: 'too-long' });
  });
});

describe('normalizarTsv (comparar, no parsear)', () => {
  it('CRLF → LF y sin filas vacías finales', () => {
    expect(normalizarTsv('A\t1\r\nB\t2\r\n\r\n')).toBe('A\t1\nB\t2');
    expect(normalizarTsv('')).toBe('');
  });
});

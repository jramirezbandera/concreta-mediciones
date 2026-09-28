/* ===========================================================================
   Copia .zip (§9.2, A1) en node: el formato (`persist/zip`) y la validación de
   una copia (`leerCopiaZip`) SIN escribir nada. Los topes se prueban con sus
   valores REALES donde cabe en un test (obra.json 50 MB, 500 MB por entrada,
   500 entradas; bombas de ceros que ocupan KB comprimidas) y con topes
   pequeños para el total; exportar usa los mismos (`excedeTopesZip`).
   =========================================================================== */
import { Deflate, deflateSync, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, toSerializable, useObraStore, type ObraData } from '../store';
import { ImportError, TOPES_ZIP, excedeTopesZip, leerCopiaZip } from './transfer';
import { EscritorZip, crc32, leerDirectorio, leerEntrada } from './zip';

const MB = 1024 * 1024;
const H1 = 'a'.repeat(64);
const H2 = 'b'.repeat(64);

function obra(): ObraData {
  const d = toSerializable(useObraStore.getState());
  return {
    ...d,
    planos: [{ id: 'pl1', tipo: 'pdf', nombre: 'Planta baja', archivo: 'pb.pdf', tamano: 10, huella: H1, paginas: 1, escalas: {} }],
  };
}
const obraJson = () => strToU8(JSON.stringify({ kind: 'concreta-obra', schemaVersion: SCHEMA_VERSION, data: obra() }));

interface Cruda {
  nombre: string;
  cuerpo: Uint8Array;
  metodo?: number;
  crc?: number;
  declarado?: number;
  flags?: number;
}
/** Un .zip escrito a mano, con lo que haga falta falsear. */
function zipCrudo(es: Cruda[]): Blob {
  const partes: Uint8Array[] = [];
  const cds: Uint8Array[] = [];
  let off = 0;
  for (const e of es) {
    const n = strToU8(e.nombre);
    const loc = new Uint8Array(30 + n.length);
    const v = new DataView(loc.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, e.flags ?? 0x800, true);
    v.setUint16(8, e.metodo ?? 0, true);
    v.setUint32(14, e.crc ?? 0, true);
    v.setUint32(18, e.cuerpo.length, true);
    v.setUint32(22, e.declarado ?? e.cuerpo.length, true);
    v.setUint16(26, n.length, true);
    loc.set(n, 30);
    const cd = new Uint8Array(46 + n.length);
    const w = new DataView(cd.buffer);
    w.setUint32(0, 0x02014b50, true);
    w.setUint16(4, 20, true);
    w.setUint16(6, 20, true);
    w.setUint16(8, e.flags ?? 0x800, true);
    w.setUint16(10, e.metodo ?? 0, true);
    w.setUint32(16, e.crc ?? 0, true);
    w.setUint32(20, e.cuerpo.length, true);
    w.setUint32(24, e.declarado ?? e.cuerpo.length, true);
    w.setUint16(28, n.length, true);
    w.setUint32(42, off, true);
    cd.set(n, 46);
    partes.push(loc, e.cuerpo);
    cds.push(cd);
    off += loc.length + e.cuerpo.length;
  }
  const fin = new Uint8Array(22);
  const f = new DataView(fin.buffer);
  f.setUint32(0, 0x06054b50, true);
  f.setUint16(8, es.length, true);
  f.setUint16(10, es.length, true);
  f.setUint32(12, cds.reduce((s, c) => s + c.length, 0), true);
  f.setUint32(16, off, true);
  return new Blob([...partes, ...cds, fin] as BlobPart[]);
}
const guardada = (nombre: string, contenido: Uint8Array): Cruda => ({ nombre, cuerpo: contenido, crc: crc32(contenido) });
const comprimida = (nombre: string, contenido: Uint8Array): Cruda => ({
  nombre,
  cuerpo: deflateSync(contenido),
  metodo: 8,
  crc: crc32(contenido),
  declarado: contenido.length,
});
/** `n` ceros comprimidos en flujo: KB en el zip, `n` bytes al descomprimir. */
function bomba(n: number): Uint8Array {
  const partes: Uint8Array[] = [];
  const d = new Deflate({ level: 1 }, (c) => partes.push(c));
  const cero = new Uint8Array(4 * MB);
  for (let k = 0; k < n; k += cero.length) {
    const fin = k + cero.length >= n;
    d.push(fin ? cero.subarray(0, n - k) : cero, fin);
  }
  const out = new Uint8Array(partes.reduce((s, c) => s + c.length, 0));
  let o = 0;
  for (const c of partes) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}
const pdf = (texto: string) => strToU8(`%PDF-1.4\n${texto}\n%%EOF`);
const rechazo = async (p: Promise<unknown>) => {
  const e = await p.catch((x: unknown) => x);
  expect(e).toBeInstanceOf(ImportError);
  return (e as ImportError).detalle;
};

describe('persist/zip: el formato', () => {
  it('CRC-32 del vector conocido', () => {
    expect(crc32(strToU8('123456789'))).toBe(0xcbf43926);
    // por trozos da lo mismo
    expect(crc32(strToU8('6789'), crc32(strToU8('12345')))).toBe(0xcbf43926);
  });

  it('lo que escribe lo lee fflate (y viceversa): es un .zip de verdad', async () => {
    const z = new EscritorZip();
    await z.anadir('obra.json', strToU8('{"a":1}'), true);
    await z.anadir(`planos/${H1}.pdf`, pdf('uno'), false);
    const blob = z.cerrar();
    const leido = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(new TextDecoder().decode(leido['obra.json'])).toBe('{"a":1}');
    expect(leido[`planos/${H1}.pdf`]).toEqual(pdf('uno'));

    const ajeno = new Blob([zipSync({ 'obra.json': strToU8('{"b":2}'), [`planos/${H2}.pdf`]: [pdf('dos'), { level: 0 }] })]);
    const es = await leerDirectorio(ajeno, 10);
    const obraE = es.find((e) => e.nombre === 'obra.json')!;
    expect(obraE.metodo).toBe(8);
    const r = await leerEntrada(ajeno, obraE, { max: 100, guardar: true, crc: true });
    expect(new TextDecoder().decode(r.datos!)).toBe('{"b":2}');
  });

  it('un PDF sin comprimir con firmas ZIP por dentro sale idéntico', async () => {
    const trampa = new Uint8Array([
      ...pdf('a'),
      0x50, 0x4b, 0x07, 0x08, 1, 2, 3, 4,
      0x50, 0x4b, 0x03, 0x04, 5, 6,
      0x50, 0x4b, 0x01, 0x02, 7,
      ...pdf('b'),
    ]);
    const z = new EscritorZip();
    await z.anadir('obra.json', obraJson(), true);
    await z.anadir(`planos/${H1}.pdf`, trampa, false);
    const copia = await leerCopiaZip(z.cerrar());
    expect(new Uint8Array(await copia.leerPdf(H1))).toEqual(trampa);
  });
});

describe('leerCopiaZip: valida sin escribir nada', () => {
  it('una copia buena: el presupuesto, los PDF por la huella de su nombre y el tamaño contado', async () => {
    const z = new EscritorZip();
    await z.anadir('obra.json', obraJson(), true);
    await z.anadir(`planos/${H1}.pdf`, pdf('uno'), false);
    await z.anadir(`planos/${H2}.pdf`, pdf('dos'), false);
    const copia = await leerCopiaZip(z.cerrar());
    expect(copia.data.planos).toHaveLength(1);
    expect([...copia.pdfs.keys()]).toEqual([H1, H2]);
    expect(copia.tamano).toBe(obraJson().length + pdf('uno').length + pdf('dos').length);
    expect(new Uint8Array(await copia.leerPdf(H2))).toEqual(pdf('dos'));
  });

  it('rechaza nombres desconocidos y repetidos, con su causa', async () => {
    const base = [comprimida('obra.json', obraJson())];
    expect(await rechazo(leerCopiaZip(zipCrudo([...base, guardada('notas.txt', strToU8('x'))])))).toBe(
      'Nombre desconocido en la copia: notas.txt',
    );
    expect(await rechazo(leerCopiaZip(zipCrudo([...base, guardada(`../planos/${H1}.pdf`, pdf('x'))])))).toMatch(
      /^Nombre desconocido en la copia: \.\.\//,
    );
    expect(await rechazo(leerCopiaZip(zipCrudo([...base, guardada(`planos/${H1.toUpperCase()}.pdf`, pdf('x'))])))).toMatch(
      /Nombre desconocido/,
    );
    expect(
      await rechazo(leerCopiaZip(zipCrudo([...base, guardada(`planos/${H1}.pdf`, pdf('x')), guardada(`planos/${H1}.pdf`, pdf('y'))]))),
    ).toBe(`Nombre repetido en la copia: planos/${H1}.pdf`);
    expect(await rechazo(leerCopiaZip(zipCrudo([guardada(`planos/${H1}.pdf`, pdf('x'))])))).toMatch(/no trae obra\.json/);
  });

  it('tamaños falsos: obra.json que dice 10 bytes y descomprime 51 MB (tope real de 50 MB)', async () => {
    const z = zipCrudo([{ nombre: 'obra.json', cuerpo: bomba(51 * MB), metodo: 8, declarado: 10 }]);
    expect(await rechazo(leerCopiaZip(z))).toBe('obra.json pasa de 50 MB.');
  });

  it('tamaños falsos: un PDF que dice 100 bytes y descomprime 501 MB (tope real de 500 MB)', async () => {
    const z = zipCrudo([
      comprimida('obra.json', obraJson()),
      { nombre: `planos/${H1}.pdf`, cuerpo: bomba(501 * MB), metodo: 8, declarado: 100 },
    ]);
    expect(await rechazo(leerCopiaZip(z))).toBe('El PDF de «Planta baja» pasa de 500 MB.');
  });

  it('más de 500 entradas (tope real): se rechaza sin leer ninguna', async () => {
    const es = [comprimida('obra.json', obraJson())];
    for (let i = 0; i < 500; i++) es.push(guardada(`planos/${i.toString(16).padStart(64, '0')}.pdf`, pdf(`${i}`)));
    expect(await rechazo(leerCopiaZip(zipCrudo(es)))).toBe('La copia tiene más de 500 archivos.');
    await expect(leerCopiaZip(zipCrudo(es.slice(0, 500)))).resolves.toBeTruthy();
  });

  it('el total se cuenta sumando lo descomprimido (topes pequeños)', async () => {
    const topes = { ...TOPES_ZIP, total: obraJson().length + 1000 };
    const bien = zipCrudo([comprimida('obra.json', obraJson()), comprimida(`planos/${H1}.pdf`, new Uint8Array(1000))]);
    await expect(leerCopiaZip(bien, topes)).resolves.toBeTruthy();
    const mal = zipCrudo([
      comprimida('obra.json', obraJson()),
      { ...comprimida(`planos/${H1}.pdf`, new Uint8Array(1001)), declarado: 1 },
    ]);
    expect(await rechazo(leerCopiaZip(mal, topes))).toMatch(/^La copia pasa de /);
  });

  it('dañado, cifrado u otra compresión: se dice', async () => {
    const buena = zipCrudo([comprimida('obra.json', obraJson())]);
    const cortada = buena.slice(0, buena.size - 30);
    expect(await rechazo(leerCopiaZip(cortada))).toBe('El archivo .zip está dañado.');
    expect(await rechazo(leerCopiaZip(new Blob([strToU8('no soy un zip')])))).toBe('El archivo .zip está dañado.');
    expect(await rechazo(leerCopiaZip(zipCrudo([{ ...comprimida('obra.json', obraJson()), crc: 1 }])))).toBe(
      'El archivo .zip está dañado.',
    );
    expect(await rechazo(leerCopiaZip(zipCrudo([{ ...comprimida('obra.json', obraJson()), flags: 0x801 }])))).toMatch(
      /contraseña: obra\.json/,
    );
    expect(await rechazo(leerCopiaZip(zipCrudo([{ ...comprimida('obra.json', obraJson()), metodo: 12 }])))).toMatch(
      /compresión que Concreta no lee/,
    );
  });

  it('un presupuesto que no es de Concreta: el error de siempre', async () => {
    const z = zipCrudo([comprimida('obra.json', strToU8('{ no es json'))]);
    await expect(leerCopiaZip(z)).rejects.toMatchObject({ kind: 'malformado' });
  });
});

describe('exportar comprueba los MISMOS topes antes de empezar', () => {
  it('con los topes reales', () => {
    expect(excedeTopesZip(1000, [10 * MB, 20 * MB])).toBeNull();
    expect(excedeTopesZip(1000, [501 * MB])).toBe('Un plano pasa de 500 MB.');
    expect(excedeTopesZip(1000, [500 * MB, 500 * MB, 500 * MB, 500 * MB, 100 * MB])).toBe(
      'La obra con sus planos pasa de 2 GB.',
    );
    expect(excedeTopesZip(51 * MB, [])).toBe('El presupuesto pasa de 50 MB.');
    expect(excedeTopesZip(1000, new Array(500).fill(1))).toBe('La copia tendría más de 500 archivos.');
    expect(excedeTopesZip(1000, new Array(499).fill(1))).toBeNull();
  });
});

/* ===========================================================================
   F7.4a — BALA TRAZADORA (D9, Codex run 7): genera `docs/trazadora-presto.bc3`,
   el .bc3 mínimo de la spec (raíz + 1 capítulo + 2 partidas con ~D/~M/~T,
   ~K = 13 %, acentos, €, sanitización) que hay que abrir en PRESTO REAL antes
   de construir F7.4b — gate manual D5 capa 5: estructura, acentos y
   PEM = 604,93 €.

   El test REGENERA el artefacto cuando el writer cambia y falla solo si no
   puede dejarlo sincronizado: el .bc3 queda COMMITEADO (datos sintéticos, sin
   cliente) y hace de fixture estable — cualquier cambio de formato del writer
   aparece como diff de git en el artefacto.
   =========================================================================== */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { obraToBc3, type Bc3ExportObra } from './bc3export';
import { bc3ToObra } from './bc3import';
import { partidaCantidad } from './medicion';
import { pem } from './totales';

const ARTIFACT = resolve(process.cwd(), 'docs', 'trazadora-presto.bc3');

/** Obra trazadora: lo mínimo que ejercita TODOS los registros de la spec. */
const TRAZADORA: Bc3ExportObra = {
  chapters: [{ id: '01', code: 'C1', title: 'DEMOLICIONES Y GESTIÓN DE RESIDUOS' }],
  partidas: {
    '01': [
      {
        id: 'p1',
        pos: '1.1',
        code: 'DEM010',
        title: 'Demolición de tabique de ladrillo hueco sencillo',
        ud: 'm²',
        precio: 12.34,
        desc:
          'Demolición de tabique de ladrillo hueco sencillo, con medios manuales, sin afectar a la estabilidad de los elementos contiguos.\n' +
          'Medido a cinta corrida — incluye retirada de escombros (coste medio 1 €/m²).',
        med: [
          { id: 'p1-m1', comment: 'Salón y cocina', uds: 2, largo: 4.5, ancho: '', alto: 2.6 },
          { id: 'p1-m2', comment: 'A deducir hueco de puerta', uds: -1, largo: 0.8, ancho: '', alto: 2.1 },
          { id: 'p1-m3', comment: 'Pasillo', uds: 1, largo: 3.2, ancho: '', alto: 2.6 },
        ],
        items: [
          { code: 'mo001', type: 'MO', cantidad: 0.45 },
          { code: 'mt001', type: 'MAT', cantidad: 1.05 },
          { code: '%CI', type: '%CI', cantidad: 3 },
        ],
      },
      {
        id: 'p2',
        pos: '1.2',
        code: 'TRA020',
        // `|` y `\` a propósito: en el archivo deben viajar como `¦` y `/`.
        title: 'Carga y transporte de escombros | contenedor \\ gestor autorizado',
        ud: 'm³',
        precio: 8.9,
        precioManual: true,
        cantidad: 18.5,
        desc: 'Carga manual y transporte de escombros a vertedero autorizado con contenedor de 5 m³.',
        med: [],
        items: [],
      },
    ],
  },
  recursos: {
    mo001: { type: 'MO', desc: 'Peón ordinario construcción', ud: 'h', precio: 17.52 },
    mt001: { type: 'MAT', desc: 'Ladrillo cerámico hueco sencillo 24x11,5x4', ud: 'mu', precio: 98.4 },
    // huérfano deliberado: NO debe viajar (el export es el árbol de la obra)
    mq999: { type: 'MQ', desc: 'Maquinaria sin uso', ud: 'h', precio: 99 },
  },
  rates: { iva: 0.1, gg: 0.13, bi: 0.06, coefK: 1.13 },
  obra: {
    denominacion: 'Obra trazadora Concreta — Demolición y transporte',
    direccion: 'Calle del Ensayo 1',
    localidad: 'Sevilla',
  },
};

const bytes = obraToBc3(TRAZADORA);
const text = new TextDecoder('windows-1252').decode(bytes);

describe('trazadora — el archivo mínimo para el gate manual en Presto', () => {
  it('PEM con K = 604,93 € (30,04·12,34·1,13 + 18,5·8,9·1,13, redondeo por partida)', () => {
    expect(pem(TRAZADORA.partidas, 1.13)).toBe(60493);
  });

  it('ejercita ~V/~K/~C/~D/~M/~T con ANSI, K=13 % y la raíz al PEM', () => {
    expect(text.startsWith('~V|Concreta|FIEBDC-3/2016|Concreta Mediciones||ANSI|\r\n')).toBe(true);
    expect(text).toContain(String.raw`~K|\2\2\3\2\2\2\2\EUR\|13|`);
    expect(text).toContain('|604.93||0|'); // raíz Y capítulo único: PEM con K
    expect(text).toContain(String.raw`~D|OBRA##|C1\1\1\|`);
    expect(text).toContain(String.raw`~D|C1#|DEM010\1\30.04\TRA020\1\18.5\|`);
    expect(text).toContain(String.raw`~M|C1#\DEM010|1\1\|30.04|`);
    expect(text).toContain(String.raw`~M|C1#\TRA020|1\2\|18.5||`); // sin med: 0 líneas, ancla el índice
    expect(text).toContain('~T|DEM010|');
    expect(text).toContain(String.raw`~D|DEM010|mo001\1\0.45\mt001\1\1.05\%CI\1\3\|`);
  });

  it('sanitiza `|`→`¦` y `\\`→`/`; el huérfano del banco no viaja', () => {
    expect(text).toContain('~C|TRA020|m³|Carga y transporte de escombros ¦ contenedor / gestor autorizado|8.9||0|');
    expect(text).not.toContain('mq999');
  });

  it('acentos y € en bytes cp1252 (ó=0xF3, €=0x80, —=0x97)', () => {
    expect(bytes).toContain(0xf3);
    expect(bytes).toContain(0x80);
    expect(bytes).toContain(0x97);
    expect(bytes).not.toContain(0x3f); // ningún '?': todo el texto es mapeable
  });

  it('round-trip propio EXACTO: estructura, K, PEM al céntimo y mediciones', () => {
    const { data, report } = bc3ToObra(bytes);
    expect(report.chapters).toBe(1);
    expect(report.partidas).toBe(2);
    expect(Object.keys(data.recursos).sort()).toEqual(['mo001', 'mt001']);
    expect(data.rates.coefK).toBe(1.13);
    expect(pem(data.partidas, 1.13)).toBe(60493);
    expect(report.deltaCents).toBe(0);
    const [p1, p2] = Object.values(data.partidas).flat();
    if (!p1 || !p2) throw new Error('faltan partidas en el reimport');
    expect(p1.precio).toBe(12.34);
    expect(partidaCantidad(p1)).toBe(30.04);
    expect(p1.med.map((l) => l.comment)).toEqual(['Salón y cocina', 'A deducir hueco de puerta', 'Pasillo']);
    expect(p1.items.map((it) => [it.code, it.cantidad])).toEqual([
      ['mo001', 0.45],
      ['mt001', 1.05],
      ['%CI', 3],
    ]);
    expect(p2.precio).toBe(8.9);
    expect(partidaCantidad(p2)).toBe(18.5);
    expect(p2.med).toHaveLength(0);
  });

  it('docs/trazadora-presto.bc3 está sincronizada con el writer (se regenera sola)', () => {
    const current = existsSync(ARTIFACT) ? new Uint8Array(readFileSync(ARTIFACT)) : null;
    const same = current?.length === bytes.length && current.every((b, i) => b === bytes[i]);
    if (!same) {
      writeFileSync(ARTIFACT, bytes);
      console.warn('[trazadora] docs/trazadora-presto.bc3 regenerada — revisa el diff y reábrela en Presto');
    }
    expect(new Uint8Array(readFileSync(ARTIFACT))).toEqual(bytes);
  });
});

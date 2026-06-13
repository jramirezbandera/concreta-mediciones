/* ===========================================================================
   F7.4a — BALA TRAZADORA (D9, Codex run 7): genera `docs/trazadora-presto.bc3`,
   el .bc3 mínimo de la spec (raíz + 1 capítulo + 2 partidas con ~D/~M/~T,
   ~K = 13 %, acentos, €, sanitización) que hay que abrir en PRESTO REAL antes
   de construir F7.4b — gate manual D5 capa 5: estructura, acentos y
   PEM = 4.074,13 €.

   ITERACIÓN 2 (tras el 1er pase por Presto 8.7, 2026-06-11): la 1ª trazadora
   cazó dos errores de spec, corregidos aquí: (1) los conceptos % llevan el
   rendimiento como FRACCIÓN (3 % → 0.03) — escribir 3 multiplicaba el CI
   ×100 —; (2) Presto recalcula el precio del padre desde la ~D e ignora el
   del ~C → DEM010 ahora cuadra con su descompuesto (114,54) y TRA020 (precio
   manual) viaja como precio cerrado SIN ~D, que Presto ya demostró respetar
   (8,90 → 186,11 con su K). Presto mostrará raíz ≈ 4.074,19 €: redondea
   precio×K por partida (T-8); la diferencia con nuestro 4.074,13 entra en la
   tolerancia <1 € del criterio dual D8.

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
        // = su descompuesto (7,88 + 103,32 + 3 % medios aux = 114,54) → la ~D viaja
        precio: 114.54,
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
          // Un `%` de MEDIOS AUXILIARES (no costes indirectos): su descripción
          // viaja y al reimportar el ~K (13 %) añade su PROPIA línea «Costes
          // indirectos» encima, sin confundirse (modelo de % distinguidos).
          { code: '%CI', type: '%CI', cantidad: 3, desc: 'Medios auxiliares' },
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
  it('PEM con K = 4.074,13 € (30,04·114,54·1,13 + 18,5·8,9·1,13, redondeo por partida)', () => {
    expect(pem(TRAZADORA.partidas, 1.13)).toBe(407413);
  });

  it('ejercita ~V/~K/~C/~D/~M/~T con ANSI, K=13 % y la raíz al PEM', () => {
    expect(text.startsWith('~V|Concreta|FIEBDC-3/2016|Concreta Mediciones||ANSI|\r\n')).toBe(true);
    expect(text).toContain(String.raw`~K|\2\2\3\2\2\2\2\EUR\|13|`);
    expect(text).toContain('|4074.13||0|'); // raíz Y capítulo único: PEM con K
    expect(text).toContain(String.raw`~D|OBRA##|C1\1\1\|`);
    expect(text).toContain(String.raw`~D|C1#|DEM010\1\30.04\TRA020\1\18.5\|`);
    expect(text).toContain(String.raw`~M|C1#\DEM010|1\1\|30.04|`);
    expect(text).toContain(String.raw`~M|C1#\TRA020|1\2\|18.5||`); // sin med: 0 líneas, ancla el índice
    expect(text).toContain('~T|DEM010|');
    // %CI como fracción (3 % → 0.03) y el porcentaje en el precio del concepto %;
    // su descripción REAL viaja (medios auxiliares, no «Costes indirectos»).
    expect(text).toContain(String.raw`~D|DEM010|mo001\1\0.45\mt001\1\1.05\%CI\1\0.03\|`);
    expect(text).toContain('~C|%CI|%|Medios auxiliares|3||0|');
  });

  it('precio manual (TRA020) → precio cerrado SIN ~D, que Presto respeta', () => {
    expect(text).toContain('~C|TRA020|m³|');
    expect(text).not.toContain('~D|TRA020');
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

  it('round-trip: el ~K (13 %) se hornea como línea «Costes indirectos», K→1, sobre los medios auxiliares', () => {
    const { data, report } = bc3ToObra(bytes);
    expect(report.chapters).toBe(1);
    expect(report.partidas).toBe(2);
    expect(Object.keys(data.recursos).sort()).toEqual(['mo001', 'mt001']);
    // El CI del ~K ya NO es coefK: viaja como línea %CI; K queda en 1.
    expect(data.rates.coefK).toBe(1);
    expect(report.ciPct).toBe(13);
    const [p1, p2] = Object.values(data.partidas).flat();
    if (!p1 || !p2) throw new Error('faltan partidas en el reimport');
    expect(partidaCantidad(p1)).toBe(30.04);
    expect(p1.med.map((l) => l.comment)).toEqual(['Salón y cocina', 'A deducir hueco de puerta', 'Pasillo']);
    // Dos líneas % DISTINTAS: medios auxiliares (3 %, del archivo) y costes
    // indirectos (13 %, del ~K), cada una con su nombre — el modelo ya no las
    // confunde. El CI anida sobre (directos + medios aux): 111,20 → 114,54 → 129,43.
    expect(p1.items.map((it) => [it.code, it.cantidad, it.desc])).toEqual([
      ['mo001', 0.45, undefined],
      ['mt001', 1.05, undefined],
      ['%CI', 3, 'Medios auxiliares'],
      ['%CI', 13, 'Costes indirectos'],
    ]);
    expect(p1.precio).toBe(129.43);
    // p2 (alzada, precio cerrado): el CI escala su precio (8,90 → 10,06).
    expect(p2.precio).toBe(10.06);
    expect(partidaCantidad(p2)).toBe(18.5);
    expect(p2.med).toHaveLength(0);
    // PEM conservado salvo el redondeo del unitario (raíz 4.074,13 → 4.074,19).
    expect(Math.abs(report.deltaCents!)).toBeLessThan(50);
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

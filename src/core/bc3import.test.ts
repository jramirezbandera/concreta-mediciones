import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bc3ToObra, Bc3ImportError } from './bc3import';
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

  it('lee el coeficiente K del ~K (+13% → 1,13)', () => {
    expect(report.coefK).toBe(1.13);
    expect(data.rates.coefK).toBe(1.13);
  });

  it('el PEM (motor, céntimos) cuadra con el precio raíz del .bc3 (rounding noise < 1 €)', () => {
    // El precio NO se pre-multiplica: el K es una tasa que el motor aplica al
    // calcular (PEM = Σ(cant·precio·K)). La desviación frente a la raíz es ruido
    // de redondeo (orden del redondeo del precio unitario × K); el cuadre exacto
    // al céntimo exigiría recalcular cada precio desde su descomposición a plena
    // precisión. Sobre ~491.298 € son ~0,11 € → estructura/K correctos.
    expect(report.rootPriceCents).not.toBeNull();
    expect(Math.abs(report.deltaCents!)).toBeLessThan(100); // < 1 €
    // y el motor recalcula el mismo PEM que el report.
    expect(pemOf(data.partidas, data.rates.coefK)).toBe(report.pemCents);
    // sanity: ~491.298 €
    expect(toEur(report.pemCents)).toBeGreaterThan(490_000);
    expect(toEur(report.pemCents)).toBeLessThan(492_000);
  });

  it('importa el banco de recursos y las líneas de medición de algunas partidas', () => {
    expect(report.recursos).toBeGreaterThan(100);
    expect(report.medVisible).toBeGreaterThan(0);
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
});

describe('bc3ToObra — errores', () => {
  it('lanza Bc3ImportError ante un archivo no .bc3', () => {
    const bytes = new TextEncoder().encode('esto no es un fichero FIEBDC');
    expect(() => bc3ToObra(bytes)).toThrow(Bc3ImportError);
  });
});

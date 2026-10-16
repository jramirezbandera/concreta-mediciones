/* ===========================================================================
   Estudio de residuos con obras reales (plan, «Validación con obras reales»).

   Importa el presupuesto de una obra hecha con el Generador de precios de CYPE
   (con su `~R`) y comprueba que, confirmando las propuestas del banco, la
   estimación por código es la del estudio de residuos que CYPE imprimió para
   esa misma obra. Tolerancia: la del redondeo de CYPE (lo imprime a 3
   decimales, después de redondear por partida).

   Los .bc3 y las cifras esperadas son de obras reales (datos de cliente): viven
   en `ejemplos pdf/Gestion de residuos/bc3/`, fuera de git. Cada `X.bc3` con un
   `X.esperado.json` al lado es un caso; sin la carpeta la prueba se salta.
   =========================================================================== */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bc3ToObra } from '../bc3import';
import { calcularEstudioRcd } from './calculo';
import { estudioVacio } from './datos';
import type { TipoObraRcd } from './tipos';

const CARPETA = resolve(__dirname, '../../..', 'ejemplos pdf/Gestion de residuos/bc3');

interface Esperado {
  fecha: string;
  tipos: TipoObraRcd[];
  /** Ids de aviso que el estudio debe dar. */
  avisos?: string[];
  /** Tabla por código del estudio de CYPE: [código, t, m³ aparentes]. */
  porCodigo: Array<[string, number, number]>;
}

const casos = existsSync(CARPETA)
  ? readdirSync(CARPETA)
      .filter((f) => f.endsWith('.esperado.json'))
      .map((f) => ({ nombre: f.replace(/\.esperado\.json$/, ''), json: resolve(CARPETA, f) }))
      .filter((c) => existsSync(resolve(CARPETA, `${c.nombre}.bc3`)))
  : [];

describe.skipIf(!casos.length)('residuos con obras reales hechas con CYPE (ejemplos pdf/)', () => {
  it.each(casos)('$nombre: el ~R del presupuesto da la misma tabla por código que el estudio de CYPE', ({ nombre, json }) => {
    const esp = JSON.parse(readFileSync(json, 'utf8')) as Esperado;
    const { data, report } = bc3ToObra(new Uint8Array(readFileSync(resolve(CARPETA, `${nombre}.bc3`))));
    expect(report.residuos).toBeGreaterThan(0);
    for (const ps of Object.values(data.partidas)) for (const p of ps) if (p.rcd) p.rcd.estado = 'confirmada';
    const r = calcularEstudioRcd({
      chapters: data.chapters,
      partidas: data.partidas,
      rates: data.rates,
      obra: data.obra,
      estudio: estudioVacio({ tipos: esp.tipos, fecha: esp.fecha }),
      hoy: esp.fecha,
    });
    const por = new Map(r.porCodigo.map((f) => [f.ler, f]));
    expect([...por.keys()].sort()).toEqual(esp.porCodigo.map(([c]) => c).sort());
    // Tolerancia: el redondeo de CYPE a 3 decimales, y un 0,01 % por la cantidad de
    // cada partida, que aquí es la del presupuesto (redondeada a 2 decimales,
    // como la mide la app) y en CYPE la de su cálculo sin redondear.
    for (const [codigo, t, m3] of esp.porCodigo) {
      const f = por.get(codigo)!;
      expect(Math.abs(f.t - t), `${codigo} t: ${f.t} frente a ${t}`).toBeLessThanOrEqual(Math.max(0.0015, 1e-4 * t));
      expect(Math.abs((f.m3Aparente ?? 0) - m3), `${codigo} m³: ${f.m3Aparente} frente a ${m3}`).toBeLessThanOrEqual(Math.max(0.0025, 1e-4 * m3));
    }
    // Un código fuera del capítulo 17 (CYPE usa uno de minería): se avisa, no se cambia.
    for (const id of esp.avisos ?? []) expect(r.avisos.some((a) => a.id === id), id).toBe(true);
  });
});

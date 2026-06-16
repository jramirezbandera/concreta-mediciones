import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bc3ToRefCopyItems } from './bc3ToPartidas';

/** Lee el .bc3 de muestra (export FIE BDC real de CYPE) como bytes crudos. */
function sampleBytes(name: string): Uint8Array {
  const path = join(process.cwd(), 'docs/spike/samples', name);
  return new Uint8Array(readFileSync(path));
}

const REC010 = 'REC010_0_2_16_10_0_0_0_5_0_0_0_0.bc3';

describe('bc3ToRefCopyItems — export FIE BDC de CYPE', () => {
  it('extrae UNA partida del sample REC010 con su precio, unidad y descripción', () => {
    const { items, error, report } = bc3ToRefCopyItems(sampleBytes(REC010));
    expect(error).toBeUndefined();
    expect(items).toHaveLength(1);

    const p = items[0]!.partida;
    expect(p.code).toBe('REC010');
    expect(p.ud).toBe('Ud');
    // El ~C de REC010 trae precio 0 (convención CYPE): el precio = costes directos
    // (8 recursos + 2% complementarios), SIN el CI global del ~K. Cuadra con CYPE: 902,50.
    expect(p.precio).toBeCloseTo(902.5, 1);
    // Texto largo del ~T sin mojibake (el sample viene en ANSI/windows-1252).
    expect(p.desc).toContain('Revestimiento de escalera');
    expect(p.desc).toContain('peldaños'); // acento decodificado
    // Procedencia CYPE en sourceName.
    expect(items[0]!.sourceName).toBe('CYPE GP (.bc3)');
    expect(report?.charset).toBe('windows-1252');
  });

  it('hidrata la descomposición (8 recursos básicos + líneas %CI con desc)', () => {
    const { items } = bc3ToRefCopyItems(sampleBytes(REC010));
    const its = items[0]!.partida.items;
    const basicos = its.filter((i) => i.type !== '%CI');
    const ci = its.filter((i) => i.type === '%CI');
    // 8 recursos de la ~D de REC010 (mt09mor010c…mo061).
    expect(basicos).toHaveLength(8);
    // Recursos hidratados: desc/ud/precio vienen del banco parseado.
    expect(basicos.every((i) => i.desc && i.ud)).toBe(true);
    expect(basicos.find((i) => i.code === 'mo023')?.type).toBe('MO');
    // Al menos una línea %CI con descripción (no se pierde al adaptar).
    expect(ci.length).toBeGreaterThanOrEqual(1);
    expect(ci.every((i) => typeof i.desc === 'string' && i.desc.length > 0)).toBe(true);
  });

  it('marca el CI del ~K por partida (ciPct) y la autoridad del precio (precioManual)', () => {
    const { items, report } = bc3ToRefCopyItems(sampleBytes(REC010));
    const p = items[0]!.partida;
    // El badge de CI usa el ~K global (REC010: 3%); debe coincidir con el report.
    expect(p.ciPct).toBe(report?.ciPct);
    expect(p.ciPct).toBe(3);
    // Precio de base congelado: autoridad de la fuente, no se resincroniza al editar.
    expect(p.precioManual).toBe(true);
  });

  it('un .bc3 sin estructura/partidas devuelve error accionable, no lanza', () => {
    const empty = new TextEncoder().encode('~V|x|FIEBDC-3/2016|prog||ANSI||2||||\n');
    const { items, error } = bc3ToRefCopyItems(empty);
    expect(items).toHaveLength(0);
    expect(error).toBeTruthy();
  });
});

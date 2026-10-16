import { describe, expect, it } from 'vitest';
import excel from '../../test/fixtures/rcd/ecoeficiencia-excel.json';
import { estimarEcoBasico, estimarEcoDetallado, opcionesEco, plantasEco, type FilaEco } from './ecoeficiencia';
import type { GrupoOpcionEco, SuperficieEco, TipoObraEcoBasico } from './tipos';

/** Suma por código (varias filas de la hoja comparten 17 05 04). */
function porCodigo(filas: Array<{ ler: string; m3: number; t: number | null }>): Map<string, { m3: number; t: number }> {
  const m = new Map<string, { m3: number; t: number }>();
  for (const f of filas) {
    const a = m.get(f.ler) ?? { m3: 0, t: 0 };
    a.m3 += f.m3;
    a.t += f.t ?? 0;
    m.set(f.ler, a);
  }
  return m;
}
const nuestras = (fs: FilaEco[]) => porCodigo(fs.map((f) => ({ ler: f.ler, m3: f.m3Aparente, t: f.t })));

describe('ECO-eficiencia: igual que la hoja en Excel', () => {
  for (const caso of excel.casos) {
    it(caso.id, () => {
      let filas: FilaEco[];
      if (caso.nivel === 'detallado') {
        const e = caso.entrada as {
          superficieConstruida: number;
          superficieSolar: number;
          superficieOcupacion: number;
          plantasBajoRasante: number;
          opciones: Record<GrupoOpcionEco, string>;
          superficies: Record<SuperficieEco, number>;
        };
        filas = estimarEcoDetallado(e);
      } else {
        const e = caso.entrada as { tipo: TipoObraEcoBasico; superficie: number; plantas: string; estructuraHormigon: boolean };
        filas = estimarEcoBasico(e.tipo, e.superficie, e.plantas, e.estructuraHormigon);
      }
      const esperado = porCodigo(caso.filas);
      const obtenido = nuestras(filas);
      expect([...obtenido.keys()].sort()).toEqual([...esperado.keys()].sort());
      for (const [ler, v] of esperado) {
        expect(obtenido.get(ler)!.m3, `${ler} m³`).toBeCloseTo(v.m3, 9);
        expect(obtenido.get(ler)!.t, `${ler} t`).toBeCloseTo(v.t, 9);
      }
    });
  }
});

describe('ECO-eficiencia: entradas', () => {
  it('cada grupo tiene sus opciones en el orden de la hoja', () => {
    expect(opcionesEco('tipologia').map((o) => o.id)).toEqual([
      'plurifamiliarExento',
      'plurifamiliarEntreMedianeras',
      'unifamiliarExento',
      'unifamiliarEntreMedianeras',
      'unifamiliarPareado',
    ]);
    expect(opcionesEco('fachada')).toHaveLength(6);
  });

  it('plantas sobre rasante → opción', () => {
    expect([1, 2, 3, 4, 5, 6, 8, 9].map(plantasEco)).toEqual(['1', '2-3', '2-3', '4-5', '4-5', '6-8', '6-8', '>8']);
  });

  it('sin superficie no estima nada; sin tierras no saca 17 05 04 de excavación', () => {
    expect(estimarEcoDetallado({ superficieConstruida: 0 })).toEqual([]);
    const sin = estimarEcoDetallado({ superficieConstruida: 100, superficieSolar: 300, superficieOcupacion: 80, incluirTierras: false });
    expect(sin.some((f) => f.grupo === 'tierras')).toBe(false);
  });

  it('la cuenta se lee: superficie, ratio, m³, densidad y t', () => {
    const [f] = estimarEcoDetallado({ superficieConstruida: 100 });
    expect(f!.formula).toMatch(/^100 m² construidos × [\d,]+ m³\/m² = [\d,]+ m³ × [\d,]+ t\/m³ = [\d,]+ t$/);
  });
});

import { describe, expect, it } from 'vitest';
import { partidaImporte } from './medicion';
import { toEur } from './money';
import { CHAPTERS, DEFAULT_RATES, PARTIDAS } from './seed';
import {
  chapterTotal,
  chapterTotals,
  ciMayoritario,
  coefKParaObjetivo,
  costesDirectos,
  costesIndirectos,
  pec,
  pem,
  totalConIva,
} from './totales';

// Localiza una partida por id en el seed.
const find = (id: string) =>
  Object.values(PARTIDAS)
    .flat()
    .find((p) => p.id === id)!;

describe('importes de partida del seed (réplica del prototipo)', () => {
  it('p111 excavación zanjas = 2.296,05 €', () => {
    expect(toEur(partidaImporte(find('p111')))).toBe(2296.05);
  });
  it('p122 arena 0/5 (dimensión vacía = factor 1) = 161,88 €', () => {
    expect(toEur(partidaImporte(find('p122')))).toBe(161.88);
  });
  it('p411 forjado = 10.837,60 €', () => {
    expect(toEur(partidaImporte(find('p411')))).toBe(10837.6);
  });
});

describe('totales del presupuesto seed', () => {
  it('importe por capítulo (céntimos)', () => {
    const ct = chapterTotals(PARTIDAS);
    expect(toEur(ct['01']!)).toBe(6615.61);
    expect(toEur(ct['02']!)).toBe(7371.73);
    expect(toEur(ct['03']!)).toBe(1466.97);
    expect(toEur(ct['04']!)).toBe(10837.6);
    expect(ct['05']).toBe(0);
  });

  it('PEM = Σ partidas, SIN BASE_PEM (§0 decisión 3)', () => {
    // El seed real suma 26.291,91 €. (El comentario de data.js decía 26.196,66,
    // pero no cuadra con los datos: las partidas suman 26.291,91. Fuente de
    // verdad = los datos, no el comentario.)
    expect(toEur(costesDirectos(PARTIDAS))).toBe(26291.91);
  });

  it('PEC s/IVA = round2(PEM · 1,19)', () => {
    const p = costesDirectos(PARTIDAS);
    expect(toEur(pec(p, DEFAULT_RATES))).toBe(31287.37);
  });

  it('Total con IVA (10% reforma) = round2((PEM + GG+BI) · 1,10)', () => {
    const p = costesDirectos(PARTIDAS);
    expect(toEur(totalConIva(p, DEFAULT_RATES))).toBe(34416.11);
  });

  it('el coeficiente K escala el PEM', () => {
    const base = costesDirectos(PARTIDAS);
    const conK = costesDirectos(PARTIDAS, 1.13);
    expect(toEur(conK)).toBeGreaterThan(toEur(base));
  });
});

describe('costes indirectos de obra (RGLCAP art. 130)', () => {
  const cd = costesDirectos(PARTIDAS); // 26.291,91 €
  const conCI = { ...DEFAULT_RATES, ci: 0.03 };

  it('sin CI el PEM ES la suma de capítulos (el defecto y todas las obras < v5)', () => {
    expect(DEFAULT_RATES.ci).toBe(0);
    expect(costesIndirectos(cd, DEFAULT_RATES)).toBe(0);
    expect(pem(cd, DEFAULT_RATES)).toBe(cd);
  });

  it('CI = round2(costes directos · ci) y PEM = directos + indirectos', () => {
    expect(toEur(costesIndirectos(cd, conCI))).toBe(788.76); // 26.291,91 · 3%
    expect(toEur(pem(cd, conCI))).toBe(27080.67);
  });

  it('GG y BI van sobre el PEM, o sea DESPUÉS del CI (no sobre los directos)', () => {
    // 27.080,67 · 13% = 3.520,49 · · · 27.080,67 · 6% = 1.624,84
    expect(toEur(pec(pem(cd, conCI), conCI))).toBe(32226.0);
    // Sin el CI el PEC sería 31.287,37: el 3% arrastra también a GG/BI.
    expect(toEur(pec(cd, DEFAULT_RATES))).toBe(31287.37);
  });

  it('el CI no mueve el K que cuadra un PEM objetivo (se va en la razón)', () => {
    const objetivo = 3_000_000;
    expect(coefKParaObjetivo(pem(cd, conCI), objetivo)).not.toBe(
      coefKParaObjetivo(pem(cd, DEFAULT_RATES), objetivo),
    );
    // …pero el K sigue siendo objetivo/base: la base es la que declara el PEM.
    expect(coefKParaObjetivo(pem(cd, conCI), objetivo)).toBe(
      Math.round((objetivo / pem(cd, conCI)) * 1e6) / 1e6,
    );
  });
});

describe('ciMayoritario (propuesta de CI de las partidas importadas)', () => {
  const p = (id: string, ciPct?: number) => ({ ...find('p111'), id, ciPct });

  it('sin partidas con CI declarado no propone nada', () => {
    expect(ciMayoritario(PARTIDAS)).toBeUndefined();
    expect(ciMayoritario({ '01': [p('a')] })).toBeUndefined();
  });

  it('propone el % que más partidas declaran', () => {
    expect(ciMayoritario({ '01': [p('a', 3), p('b', 3), p('c', 2)] })).toBe(3);
    expect(ciMayoritario({ '01': [p('a', 2)], '02': [p('b', 2), p('c', 6)] })).toBe(2);
  });

  it('a igualdad de partidas gana el mayor (no infra-presupuestar)', () => {
    expect(ciMayoritario({ '01': [p('a', 2), p('b', 6)] })).toBe(6);
  });

  it('ignora las partidas sin CI y los ceros', () => {
    expect(ciMayoritario({ '01': [p('a'), p('b', 0), p('c', 3)] })).toBe(3);
  });
});

describe('coefKParaObjetivo (ajuste de K a un PEM objetivo)', () => {
  const base = costesDirectos(PARTIDAS); // 26.291,91 € a K=1

  it('razón directa objetivo/base, a 6 decimales', () => {
    // objetivo 30.000 € sobre base 26.291,91 € → 1,141035…
    expect(coefKParaObjetivo(base, 3_000_000)).toBe(1.141035);
  });

  it('el K resultante cuadra el PEM con el objetivo dentro de la tolerancia (<1 €)', () => {
    const target = 3_000_000; // 30.000,00 €
    const k = coefKParaObjetivo(base, target);
    expect(Math.abs(costesDirectos(PARTIDAS, k) - target)).toBeLessThan(100); // <1 € (redondeo por partida)
  });

  it('objetivo = base → K = 1 (a 6 decimales)', () => {
    expect(coefKParaObjetivo(base, base)).toBe(1);
  });

  it('protege contra base/objetivo no positivos (no se puede escalar 0)', () => {
    expect(coefKParaObjetivo(0, 3_000_000)).toBe(1);
    expect(coefKParaObjetivo(base, 0)).toBe(1);
    expect(coefKParaObjetivo(base, -100)).toBe(1);
  });
});

describe('estructura del seed', () => {
  it('8 capítulos, 9 partidas, sin cubos ocultos', () => {
    expect(CHAPTERS).toHaveLength(8);
    expect(Object.values(PARTIDAS).flat()).toHaveLength(9);
  });

  it('chapterTotal de un capítulo vacío = 0', () => {
    expect(chapterTotal(PARTIDAS['07']!)).toBe(0);
  });
});

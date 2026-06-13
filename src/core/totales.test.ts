import { describe, expect, it } from 'vitest';
import { partidaImporte } from './medicion';
import { toEur } from './money';
import { CHAPTERS, DEFAULT_RATES, PARTIDAS } from './seed';
import { chapterTotal, chapterTotals, coefKParaObjetivo, pec, pem, totalConIva } from './totales';

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
    expect(toEur(pem(PARTIDAS))).toBe(26291.91);
  });

  it('PEC s/IVA = round2(PEM · 1,19)', () => {
    const p = pem(PARTIDAS);
    expect(toEur(pec(p, DEFAULT_RATES))).toBe(31287.37);
  });

  it('Total con IVA (10% reforma) = round2((PEM + GG+BI) · 1,10)', () => {
    const p = pem(PARTIDAS);
    expect(toEur(totalConIva(p, DEFAULT_RATES))).toBe(34416.11);
  });

  it('el coeficiente K escala el PEM', () => {
    const base = pem(PARTIDAS);
    const conK = pem(PARTIDAS, 1.13);
    expect(toEur(conK)).toBeGreaterThan(toEur(base));
  });
});

describe('coefKParaObjetivo (ajuste de K a un PEM objetivo)', () => {
  const base = pem(PARTIDAS); // 26.291,91 € a K=1

  it('razón directa objetivo/base, a 6 decimales', () => {
    // objetivo 30.000 € sobre base 26.291,91 € → 1,141035…
    expect(coefKParaObjetivo(base, 3_000_000)).toBe(1.141035);
  });

  it('el K resultante cuadra el PEM con el objetivo dentro de la tolerancia (<1 €)', () => {
    const target = 3_000_000; // 30.000,00 €
    const k = coefKParaObjetivo(base, target);
    expect(Math.abs(pem(PARTIDAS, k) - target)).toBeLessThan(100); // <1 € (redondeo por partida)
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

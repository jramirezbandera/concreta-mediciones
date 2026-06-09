import { beforeEach, describe, expect, it } from 'vitest';
import { certTotals, estaCertToOrigen, prevDataOf } from '../core/certificacion';
import { toEur } from '../core/money';
import { DEFAULT_RATES, PARTIDAS } from '../core/seed';
import {
  ALL,
  seedObraData,
  selectChapterTotals,
  selectCounts,
  selectPec,
  selectPem,
  selectTotalConIva,
  useObraStore,
} from './index';

// El store es un singleton de módulo; resembrar antes de cada test para aislar.
beforeEach(() => {
  useObraStore.getState().reset();
});

const state = () => useObraStore.getState();
const allPartidas = () => Object.values(state().partidas).flat();

describe('estado sembrado', () => {
  it('siembra dominio desde core/seed (8 cap · 9 partidas · banco · 3 certs)', () => {
    const s = state();
    expect(s.chapters).toHaveLength(8);
    expect(allPartidas()).toHaveLength(9);
    expect(s.certs).toHaveLength(3);
    // banco derivado de buildRecursos: el recurso compartido mo001 con su precio.
    expect(s.recursos['mo001']?.precio).toBe(17.52);
    expect(s.rates).toEqual(DEFAULT_RATES);
    expect(s.obra.denominacion).toContain('C/ Mayor 14');
  });

  it('estado de UI inicial: presupuesto · capítulo 01 · curCert = última', () => {
    const s = state();
    expect(s.view).toBe('presupuesto');
    expect(s.active).toBe('01');
    expect(s.expanded).toEqual({ '01': true });
    expect(s.curCert).toBe(2); // 3 certs → índice 2
  });

  it('clona el seed (cada siembra es independiente, no comparte referencias)', () => {
    const a = seedObraData();
    const b = seedObraData();
    // mismo contenido…
    expect(a.partidas['01']![0]!.precio).toBe(b.partidas['01']![0]!.precio);
    // …pero referencias distintas: mutar una no toca la otra ni el seed importado.
    expect(a.partidas).not.toBe(b.partidas);
    expect(a.partidas['01']).not.toBe(PARTIDAS['01']);
    a.partidas['01']![0]!.precio = 999;
    expect(b.partidas['01']![0]!.precio).toBe(18.42);
    expect(PARTIDAS['01']![0]!.precio).toBe(18.42);
  });
});

describe('selectores derivados (mismos números que core/)', () => {
  it('PEM seed = 26.291,91 € (§0 decisión 3, sin BASE_PEM)', () => {
    expect(toEur(selectPem(state()))).toBe(26291.91);
  });

  it('importe por capítulo coincide con el prototipo', () => {
    const ct = selectChapterTotals(state());
    expect(toEur(ct['01']!)).toBe(6615.61);
    expect(toEur(ct['02']!)).toBe(7371.73);
    expect(toEur(ct['03']!)).toBe(1466.97);
    expect(toEur(ct['04']!)).toBe(10837.6);
    expect(ct['05']).toBe(0);
  });

  it('PEC s/IVA y Total con IVA', () => {
    expect(toEur(selectPec(state()))).toBe(31287.37);
    expect(toEur(selectTotalConIva(state()))).toBe(34416.11);
  });

  it('conteos: 8 capítulos · 9 partidas · 19 líneas de medición', () => {
    expect(selectCounts(state())).toEqual({ chapters: 8, partidas: 9, lineas: 19 });
  });
});

describe('memoización de selectores', () => {
  it('devuelve la MISMA referencia mientras el estado no cambia', () => {
    const s = state();
    expect(selectChapterTotals(s)).toBe(selectChapterTotals(s));
    expect(selectCounts(s)).toBe(selectCounts(s));
  });

  it('recalcula (nueva referencia) cuando cambian sus entradas', () => {
    const before = selectChapterTotals(state());
    useObraStore.getState().setRates({ coefK: 1.13 });
    const after = selectChapterTotals(state());
    expect(after).not.toBe(before);
  });
});

describe('acciones de UI', () => {
  it('setView / setActive', () => {
    const { setView, setActive } = state();
    setView('certificaciones');
    setActive(ALL);
    expect(state().view).toBe('certificaciones');
    expect(state().active).toBe(ALL);
  });

  it('setView no toca el resto del dominio', () => {
    const partidasRef = state().partidas;
    state().setView('resumen');
    expect(state().partidas).toBe(partidasRef);
  });
});

describe('setRates (tasas como estado, no globals)', () => {
  it('coefK escala el PEM hacia arriba', () => {
    const base = selectPem(state());
    state().setRates({ coefK: 2 });
    expect(toEur(selectPem(state()))).toBeGreaterThan(toEur(base));
    expect(state().rates.coefK).toBe(2);
  });

  it('cambiar el IVA recalcula el total con IVA y conserva el resto de tasas', () => {
    const base = selectTotalConIva(state());
    state().setRates({ iva: 0.21 });
    expect(toEur(selectTotalConIva(state()))).toBeGreaterThan(toEur(base));
    expect(state().rates.gg).toBe(DEFAULT_RATES.gg); // patch parcial
    expect(state().rates.bi).toBe(DEFAULT_RATES.bi);
  });
});

describe('onCertEdit', () => {
  it('modo origen: guarda la cantidad a origen (clamp ≥ 0)', () => {
    const p = allPartidas()[0]!;
    state().onCertEdit(p.id, 12.34, 'origen');
    expect(state().certs[state().curCert]!.data[p.id]).toBe(12.34);
    state().onCertEdit(p.id, -5, 'origen');
    expect(state().certs[state().curCert]!.data[p.id]).toBe(0);
  });

  it('modo esta: convierte a origen con estaCertToOrigen(anterior + v)', () => {
    const s = state();
    const p = allPartidas()[0]!;
    const prev = prevDataOf(s.certs, s.curCert)[p.id] ?? 0;
    s.onCertEdit(p.id, 5, 'esta');
    expect(state().certs[state().curCert]!.data[p.id]).toBe(estaCertToOrigen(prev, 5));
  });

  it('no peta si el índice de cert es inválido', () => {
    state().setCurCert(99);
    expect(() => state().onCertEdit('p111', 1, 'origen')).not.toThrow();
  });
});

describe('cableado con el motor de certificación', () => {
  it('el budgetPEM de la cert en curso coincide con el PEM del presupuesto', () => {
    const s = state();
    const cur = s.certs[s.curCert]!;
    const prev = prevDataOf(s.certs, s.curCert);
    const t = certTotals(allPartidas(), cur.data, prev, s.rates, cur.retencion, s.rates.coefK);
    expect(t.budgetPEM).toBe(selectPem(s));
    expect(toEur(t.liquido)).toBeGreaterThan(0);
  });
});

describe('reset', () => {
  it('restaura datos y UI tras editar', () => {
    const s = state();
    s.setView('resumen');
    s.setActive(ALL);
    s.setRates({ coefK: 5 });
    s.onCertEdit('p111', 1, 'origen');
    useObraStore.getState().reset();
    const r = state();
    expect(r.view).toBe('presupuesto');
    expect(r.active).toBe('01');
    expect(r.rates).toEqual(DEFAULT_RATES);
    expect(toEur(selectPem(r))).toBe(26291.91);
  });
});

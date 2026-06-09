import { beforeEach, describe, expect, it } from 'vitest';
import { certTotals, estaCertToOrigen, prevDataOf } from '../core/certificacion';
import { partidaCantidad } from '../core/medicion';
import { toEur } from '../core/money';
import { precioCuadraDescompuesto, precioSegunModo } from '../core/banco';
import { DEFAULT_RATES, PARTIDAS } from '../core/seed';
import {
  ALL,
  SCHEMA_VERSION,
  fromSerializable,
  seedObraData,
  selectChapterTotals,
  selectCounts,
  selectPec,
  selectPem,
  selectTotalConIva,
  toSerializable,
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

  it('marca precioManual en seed donde precio≠descompUnit (autoridad de fuente)', () => {
    const p111 = state().partidas['01']!.find((p) => p.id === 'p111')!;
    // p111: precio 18,42 con descompuesto 9,27 → override, precio fijo y seguro.
    expect(precioCuadraDescompuesto(p111, state().recursos)).toBe(false);
    expect(p111.precioManual).toBe(true);
    // precioSegunModo NO lo colapsa al descompuesto (el sync de F2 sería seguro).
    expect(precioSegunModo(p111, state().recursos)).toBe(18.42);
    // y el PEM sigue cuadrando exacto.
    expect(toEur(selectPem(state()))).toBe(26291.91);
  });

  it('NO marca precioManual en partidas sin descomposición (items vacíos)', () => {
    const p122 = state().partidas['01']!.find((p) => p.id === 'p122')!; // items: []
    expect(p122.items).toHaveLength(0);
    expect(p122.precioManual).toBeUndefined();
  });
});

describe('shape serializable (§0 decisión 4)', () => {
  it('el estado sembrado nace versionado', () => {
    expect(state().schemaVersion).toBe(SCHEMA_VERSION);
    expect(seedObraData().schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('toSerializable → fromSerializable conserva el PEM', () => {
    const data = fromSerializable(toSerializable(state()));
    expect(data.schemaVersion).toBe(SCHEMA_VERSION);
    expect(toEur(selectPem({ ...state(), ...data }))).toBe(26291.91);
  });

  it('fromSerializable rechaza una versión no soportada', () => {
    expect(() => fromSerializable({ ...toSerializable(state()), schemaVersion: 99 })).toThrow();
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

  it('ignora valores no finitos y fuera de rango (no envenena los totales)', () => {
    state().setRates({ iva: NaN }); // NaN ignorado
    expect(state().rates.iva).toBe(DEFAULT_RATES.iva);
    state().setRates({ gg: -0.5 }); // negativo ignorado
    expect(state().rates.gg).toBe(DEFAULT_RATES.gg);
    state().setRates({ coefK: 0 }); // coefK debe ser > 0
    expect(state().rates.coefK).toBe(DEFAULT_RATES.coefK);
    state().setRates({ coefK: -1 });
    expect(state().rates.coefK).toBe(DEFAULT_RATES.coefK);
    // el PEM sigue siendo un número válido tras los intentos basura
    expect(Number.isFinite(toEur(selectPem(state())))).toBe(true);
    // un valor válido sí entra
    state().setRates({ coefK: 1.13 });
    expect(state().rates.coefK).toBe(1.13);
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

  it('setCurCert clampa al rango y la edición va a esa cert', () => {
    state().setCurCert(0);
    expect(state().curCert).toBe(0);
    state().onCertEdit('p111', 7, 'origen');
    expect(state().certs[0]!.data.p111).toBe(7);
    state().setCurCert(99); // fuera de rango → clampa a la última (2)
    expect(state().curCert).toBe(2);
    state().setCurCert(-5); // negativo → clampa a 0
    expect(state().curCert).toBe(0);
  });

  it('sólo muta la cert en curso, no las demás (aislamiento estructural)', () => {
    const s = state(); // curCert = 2 por defecto
    const otraAntes = s.certs[0]!.data.p111;
    s.onCertEdit('p111', 12345, 'origen');
    expect(state().certs[2]!.data.p111).toBe(12345);
    expect(state().certs[0]!.data.p111).toBe(otraAntes); // cert 0 intacta
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

describe('acciones F2 (edición in-situ)', () => {
  const p111 = () => state().partidas['01']!.find((p) => p.id === 'p111')!;

  it('editPartidaField cambia el campo y limpia el chip BASE', () => {
    useObraStore.setState((s) => {
      s.partidas['01']!.find((p) => p.id === 'p111')!.fromBase = true;
    });
    state().editPartidaField('01', 'p111', 'title', 'Excavación revisada');
    expect(p111().title).toBe('Excavación revisada');
    expect(p111().fromBase).toBe(false);
  });

  it('setPrecio fija precio + precioManual y recalcula el PEM en vivo', () => {
    const before = selectPem(state());
    state().setPrecio('01', 'p111', 100);
    expect(p111().precio).toBe(100);
    expect(p111().precioManual).toBe(true);
    expect(p111().fromBase).toBe(false);
    expect(selectPem(state())).not.toBe(before); // cadena precio→importe→PEM viva
  });

  it('setPrecio ignora valores no finitos o negativos', () => {
    state().setPrecio('01', 'p111', 100);
    state().setPrecio('01', 'p111', NaN);
    expect(p111().precio).toBe(100);
    state().setPrecio('01', 'p111', -5);
    expect(p111().precio).toBe(100);
  });

  it('add/edit/deleteMedLine recalculan la cantidad y limpian BASE', () => {
    // p111 arranca con 2 líneas → cantidad 124,65.
    expect(partidaCantidad(p111())).toBe(124.65);
    const i = p111().med.length;
    state().addMedLine('01', 'p111');
    expect(p111().med).toHaveLength(i + 1);
    expect(p111().fromBase).toBe(false);
    // nueva línea: uds 2 × largo 3 (ancho/alto vacíos = factor 1) → parcial 6.
    state().editMedLine('01', 'p111', i, 'uds', 2);
    state().editMedLine('01', 'p111', i, 'largo', 3);
    expect(partidaCantidad(p111())).toBe(130.65); // 124,65 + 6
    state().deleteMedLine('01', 'p111', i);
    expect(p111().med).toHaveLength(i);
    expect(partidaCantidad(p111())).toBe(124.65);
  });

  it('las acciones no rompen si la partida o el índice no existen', () => {
    expect(() => state().editPartidaField('99', 'nope', 'title', 'x')).not.toThrow();
    expect(() => state().deleteMedLine('01', 'p111', 99)).not.toThrow();
    expect(p111().med).toHaveLength(2);
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

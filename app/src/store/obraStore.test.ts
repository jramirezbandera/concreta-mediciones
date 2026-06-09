import { beforeEach, describe, expect, it } from 'vitest';
import { certTotals, estaCertToOrigen, prevDataOf } from '../core/certificacion';
import { partidaCantidad } from '../core/medicion';
import { toEur } from '../core/money';
import { descompUnit, precioCuadraDescompuesto, precioSegunModo } from '../core/banco';
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

describe('acciones F2.3 (banco compartido / justificación, T9)', () => {
  const p111 = () => state().partidas['01']!.find((p) => p.id === 'p111')!;
  const p112 = () => state().partidas['01']!.find((p) => p.id === 'p112')!;

  /** Quita el override de una partida y sincroniza su precio al descompuesto. */
  function makeSynced(id: string) {
    useObraStore.setState((s) => {
      const p = s.partidas['01']!.find((x) => x.id === id)!;
      p.precioManual = false;
      p.precio = descompUnit(p.items, s.recursos);
    });
  }

  it('editRecurso(precio) recalcula TODAS las partidas sin override + el PEM (T9)', () => {
    makeSynced('p111'); // ambas comparten mo001 (Peón ordinario)
    makeSynced('p112');
    expect(p111().precio).toBe(9.27); // descompuesto original
    const pem0 = selectPem(state());

    state().editRecurso('mo001', 'precio', 50); // 17,52 → 50

    // p111: base round2(0,25·50)+round2(0,12·38,5)=12,5+4,62=17,12; %CI 3%→0,51 ⇒ 17,63
    expect(p111().precio).toBe(17.63);
    expect(p111().precio).toBe(descompUnit(p111().items, state().recursos)); // sigue cuadrando
    expect(p112().precio).not.toBe(9.27); // la OTRA partida que lo comparte también cambia
    expect(selectPem(state())).not.toBe(pem0); // cadena recurso→importe→PEM
    expect(state().recursos['mo001']!.precio).toBe(50);
  });

  it('editRecurso(precio) NO toca las partidas con override (precio fijo)', () => {
    // seed: p111 es override (precioManual, 18,42 ≠ descompuesto).
    expect(p111().precioManual).toBe(true);
    state().editRecurso('mo001', 'precio', 50);
    expect(p111().precio).toBe(18.42); // el override aguanta
    // pero su descompuesto informativo sí refleja el recurso nuevo.
    expect(descompUnit(p111().items, state().recursos)).toBe(17.63);
  });

  it('editRecurso(desc/ud) cambia el banco sin tocar precios', () => {
    const pem0 = selectPem(state());
    state().editRecurso('mo001', 'desc', 'Peón especialista');
    expect(state().recursos['mo001']!.desc).toBe('Peón especialista');
    expect(selectPem(state())).toBe(pem0); // desc no altera el descompuesto
  });

  it('editItemCantidad (rendimiento) resincroniza el precio sin override', () => {
    makeSynced('p111');
    state().editItemCantidad('01', 'p111', 0, 0.5); // mo001 0,25 → 0,5
    // base round2(0,5·17,52)+4,62=8,76+4,62=13,38; %CI 3%→0,40 ⇒ 13,78
    expect(p111().precio).toBe(13.78);
    expect(p111().fromBase).toBe(false);
  });

  it('addItem añade concepto al banco y a la partida; deleteItem lo quita', () => {
    const n = p111().items.length;
    state().addItem('01', 'p111');
    expect(p111().items).toHaveLength(n + 1);
    const nuevo = p111().items[n]!;
    expect(nuevo.type).toBe('MAT');
    expect(state().recursos[nuevo.code]).toBeDefined(); // entró en el banco
    expect(p111().fromBase).toBe(false);
    state().deleteItem('01', 'p111', n);
    expect(p111().items).toHaveLength(n);
  });

  it('guardas: ignora precio no finito/negativo, índices fuera de rango y códigos inexistentes', () => {
    makeSynced('p111');
    const precio = p111().precio;
    state().editRecurso('mo001', 'precio', NaN);
    state().editRecurso('mo001', 'precio', -1);
    state().editRecurso('zzz', 'precio', 5); // recurso inexistente
    expect(p111().precio).toBe(precio);
    expect(() => state().editItemCantidad('01', 'p111', 99, 1)).not.toThrow();
    expect(() => state().deleteItem('01', 'p111', 99)).not.toThrow();
  });
});

describe('acciones F2.4 (CRUD estructural + renumeración)', () => {
  const ch01 = () => state().partidas['01']!;
  const findP = (id: string) => allPartidas().find((p) => p.id === id);

  it('addChapter: código max+1, id con padding, queda activo en Presupuesto', () => {
    state().setView('resumen');
    state().addChapter('Acabados');
    const s = state();
    expect(s.chapters).toHaveLength(9);
    const nuevo = s.chapters.at(-1)!;
    expect(nuevo.code).toBe('9');
    expect(nuevo.id).toBe('09');
    expect(s.partidas['09']).toEqual([]);
    expect(s.active).toBe('09');
    expect(s.view).toBe('presupuesto');
  });

  it('addSubchapter: código <cap>.<n> y despliega el padre', () => {
    state().addSubchapter('02', 'Losas'); // cap 02 no tenía subcapítulos
    const c2 = state().chapters.find((c) => c.id === '02')!;
    expect(c2.children).toHaveLength(1);
    expect(c2.children![0]).toMatchObject({ id: '02.01', code: '2.1', title: 'Losas' });
    expect(state().expanded['02']).toBe(true);
    // en un capítulo con subs existentes, sigue la serie (01.01..01.03 → 1.4).
    state().addSubchapter('01', 'Entibaciones');
    const c1 = state().chapters.find((c) => c.id === '01')!;
    expect(c1.children!.at(-1)).toMatchObject({ id: '01.04', code: '1.4' });
  });

  it('addPartida: pos correlativa, en capítulo vacío y en subcapítulo', () => {
    state().addPartida('05', null); // capítulo sin partidas
    expect(state().partidas['05']).toHaveLength(1);
    expect(state().partidas['05']![0]!.pos).toBe('5.1');
    state().addPartida('01', '01.01'); // sub con 3 partidas → la 4ª
    const nueva = ch01().find((p) => p.sub === '01.01' && p.pos === '1.1.4');
    expect(nueva).toBeDefined();
  });

  it('deletePartida renumera el resto del capítulo', () => {
    state().deletePartida('01', 'p111'); // era 1.1.1
    expect(ch01()).toHaveLength(4);
    expect(findP('p112')!.pos).toBe('1.1.1'); // sube
    expect(findP('p113')!.pos).toBe('1.1.2');
  });

  it('movePartida mueve, renumera origen y destino y conserva el PEM', () => {
    const pem0 = toEur(selectPem(state()));
    const ct0 = selectChapterTotals(state());
    state().movePartida('01', 'p111', '02', null);
    const s = state();
    expect(s.partidas['01']!.some((p) => p.id === 'p111')).toBe(false);
    expect(s.partidas['02']!.some((p) => p.id === 'p111')).toBe(true);
    expect(findP('p111')!.sub).toBeUndefined();
    expect(findP('p112')!.pos).toBe('1.1.1'); // origen renumerado
    expect(s.expanded['02']).toBe(true);
    // el importe sólo cambia de capítulo: el PEM total se conserva.
    expect(toEur(selectPem(s))).toBe(pem0);
    expect(selectChapterTotals(s)['01']).toBeLessThan(ct0['01']!);
    expect(selectChapterTotals(s)['02']).toBeGreaterThan(ct0['02']!);
  });

  it('deleteChapter borra capítulo + partidas; si estaba activo, salta a "Toda la obra"', () => {
    state().setActive('01');
    state().deleteChapter('01');
    const s = state();
    expect(s.chapters.some((c) => c.id === '01')).toBe(false);
    expect(s.partidas['01']).toBeUndefined();
    expect(s.active).toBe(ALL);
  });

  it('deleteSubchapter sube las partidas al capítulo (renumeradas) y reubica el activo', () => {
    state().setActive('01.01');
    state().deleteSubchapter('01', '01.01');
    const c1 = state().chapters.find((c) => c.id === '01')!;
    expect(c1.children!.some((sc) => sc.id === '01.01')).toBe(false);
    // p111/p112/p113 pierden el sub y renumeran bajo el código del capítulo.
    expect(findP('p111')!.sub).toBeUndefined();
    expect(findP('p111')!.pos).toBe('1.1');
    expect(state().active).toBe('01'); // el sub activo salta a su capítulo
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

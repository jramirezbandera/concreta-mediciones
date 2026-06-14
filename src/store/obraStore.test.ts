import { beforeEach, describe, expect, it } from 'vitest';
import {
  certCalc,
  certSnapshotOf,
  certTotals,
  estaCertToOrigen,
  prevDataOf,
} from '../core/certificacion';
import { partidaCantidad } from '../core/medicion';
import { toEur } from '../core/money';
import { descompUnit, precioCuadraDescompuesto, precioSegunModo } from '../core/banco';
// Bases demo: ya no se cargan en la app (REF_SOURCES vacío), pero siguen como
// fixture para ejercitar la copia desde una fuente de referencia.
import { DEMO_REF_SOURCES as REF_SOURCES, type RefCopyItem } from '../core/refdata';
import { DEFAULT_RATES, PARTIDAS } from '../core/seed';
import {
  ALL,
  SCHEMA_VERSION,
  copyTargetOf,
  fromSerializable,
  seedObraData,
  selectCertTotals,
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
    expect(s.expanded).toEqual({}); // árbol colapsado por defecto
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

describe('setObraPath (datos de obra, F6.2)', () => {
  it('edita un campo plano (lo lee el breadcrumb)', () => {
    state().setObraPath('denominacion', 'Casa de campo');
    expect(state().obra.denominacion).toBe('Casa de campo');
  });

  it('crea los objetos intermedios de una ruta anidada', () => {
    state().setObraPath('promotor.nif', 'B12345678');
    expect((state().obra.promotor as { nif: string }).nif).toBe('B12345678');
  });

  it('escribe varios campos del mismo objeto anidado sin pisarse', () => {
    state().setObraPath('constructor.nombre', 'Obras SL');
    state().setObraPath('constructor.cif', 'A1');
    // `constructor` colisiona con Object.prototype.constructor en el tipo → cast doble.
    const c = state().obra.constructor as unknown as { nombre: string; cif: string };
    expect(c).toEqual({ nombre: 'Obras SL', cif: 'A1' });
  });

  it('ignora valores que no son string', () => {
    state().setObraPath('localidad', 42 as unknown as string);
    expect(state().obra.localidad).toBe('Madrid');
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

describe('jerarquía N niveles — endurecimiento Fase 1 (eng-review 2026-06-12)', () => {
  const ch01 = () => state().partidas['01']!;
  const findP = (id: string) =>
    Object.values(state().partidas)
      .flat()
      .find((p) => p.id === id);

  /** Anida un sub-sub bajo 01.01 directamente en el modelo (sin pasar por las
   *  acciones: este bloque prueba el ENDURECIMIENTO, no la edición de T-17). */
  function nestSubSub(): void {
    useObraStore.setState((s) => {
      const c1 = s.chapters.find((c) => c.id === '01')!;
      c1.children![0]!.children = [{ id: '01.01.01', code: '1.1.1', title: 'Profundo' }];
    });
  }

  it('addPartida con subId INEXISTENTE en el capítulo → no-op (sin huérfanas)', () => {
    const before = ch01().length;
    state().addPartida('01', 'no-existe');
    expect(ch01()).toHaveLength(before);
  });

  it('addPartida a un sub PROFUNDO existente funciona (pos con ruta completa)', () => {
    nestSubSub();
    state().addPartida('01', '01.01.01');
    const nueva = ch01().find((p) => p.sub === '01.01.01');
    expect(nueva).toBeDefined();
    expect(nueva!.pos).toBe('1.1.1.1');
  });

  it('movePartida con destino inexistente → RECHAZADA (la partida no se mueve)', () => {
    state().movePartida('01', 'p111', '02', 'sub-fantasma');
    expect(findP('p111')!.sub).toBe('01.01'); // sigue donde estaba
    expect(state().partidas['02']!.some((p) => p.id === 'p111')).toBe(false);
  });

  it('copyTargetOf resuelve un sub profundo activo a su capítulo y subId', () => {
    nestSubSub();
    const t = copyTargetOf(state().chapters, '01.01.01');
    expect(t).toMatchObject({ chId: '01', subId: '01.01.01' });
    expect(t.label).toContain('1.1.1');
  });
});

describe('jerarquía N niveles — Fase 2: edición a profundidad (T-17)', () => {
  const ch01 = () => state().partidas['01']!;
  const c = (id: string) => state().chapters.find((x) => x.id === id)!;
  const findP = (id: string) => allPartidas().find((p) => p.id === id);

  /** Anida un sub-sub bajo 01.01 directamente en el modelo (como un .bc3). */
  function nestSubSub(): void {
    useObraStore.setState((s) => {
      const c1 = s.chapters.find((x) => x.id === '01')!;
      c1.children![0]!.children = [{ id: '01.01.01', code: '1.1.1', title: 'Profundo' }];
    });
  }

  it('addSubchapter bajo un sub: código <padre>.<n>, recursivo, y despliega el capítulo dueño', () => {
    state().addSubchapter('01.01', 'Nivel 3');
    const s11 = c('01').children![0]!;
    expect(s11.children).toHaveLength(1);
    expect(s11.children![0]).toMatchObject({ id: '01.01.01', code: '1.1.1', title: 'Nivel 3' });
    expect(state().expanded['01']).toBe(true);
    // …y bajo el nuevo nivel, otro más (recursivo de verdad).
    state().addSubchapter('01.01.01', 'Nivel 4');
    expect(c('01').children![0]!.children![0]!.children![0]).toMatchObject({
      id: '01.01.01.01',
      code: '1.1.1.1',
    });
  });

  it('addSubchapter con padre inexistente → no-op', () => {
    const antes = JSON.stringify(state().chapters);
    state().addSubchapter('no-existe', 'Huérfano');
    expect(JSON.stringify(state().chapters)).toBe(antes);
  });

  it('deleteSubchapter CON hijos → PROMUEVE: ramas al final con código libre, partidas al padre', () => {
    nestSubSub();
    state().setActive('01.01');
    state().deleteSubchapter('01', '01.01');
    const c1 = c('01');
    expect(c1.children!.some((sc) => sc.id === '01.01')).toBe(false);
    // El nieto sube al final de los hermanos con el siguiente código libre
    // (1.2/1.3 siguen; política de huecos: el 1.1 no se rellena).
    const promoted = c1.children!.at(-1)!;
    expect(promoted).toMatchObject({ id: '01.01.01', code: '1.4' });
    // Las partidas directas del borrado suben al capítulo, renumeradas.
    expect(findP('p111')!.sub).toBeUndefined();
    expect(findP('p111')!.pos).toBe('1.1');
    expect(state().active).toBe('01'); // el activo salta al padre
  });

  it('deleteSubchapter de un sub PROFUNDO: sus partidas suben a su PADRE, no al capítulo', () => {
    nestSubSub();
    state().addPartida('01', '01.01.01');
    state().setActive('01.01.01');
    state().deleteSubchapter('01', '01.01.01');
    const nueva = ch01().find((p) => p.code === '——')!;
    expect(nueva.sub).toBe('01.01'); // al padre 01.01, no a undefined
    expect(nueva.pos).toBe('1.1.4'); // detrás de p111-p113
    expect(state().active).toBe('01.01');
  });

  it('moveSubtree entre capítulos: rama recodificada, partidas de bucket y PEM conservado', () => {
    nestSubSub();
    const pem0 = toEur(selectPem(state()));
    state().moveSubtree('01.01', '02'); // cap 02 no tiene subcapítulos
    const s = state();
    expect(c('01').children!.some((sc) => sc.id === '01.01')).toBe(false);
    const moved = c('02').children!.find((sc) => sc.id === '01.01')!;
    expect(moved.code).toBe('2.1'); // recodificado bajo el nuevo padre…
    expect(moved.children![0]).toMatchObject({ id: '01.01.01', code: '2.1.1' }); // …con su rama
    // Las partidas del subárbol cambian de bucket SIN cambiar id ni sub.
    expect(s.partidas['01']!.some((p) => p.id === 'p111')).toBe(false);
    const p111 = s.partidas['02']!.find((p) => p.id === 'p111')!;
    expect(p111.sub).toBe('01.01');
    expect(p111.pos).toBe('2.1.1'); // renumerada bajo la ruta nueva
    expect(toEur(selectPem(s))).toBe(pem0); // mover no crea ni destruye importe
    expect(s.expanded['02']).toBe(true);
  });

  it('moveSubtree DENTRO del mismo capítulo (reparent): recodifica sin tocar el bucket', () => {
    nestSubSub();
    const n0 = ch01().length;
    state().moveSubtree('01.01.01', '01.02');
    const s102 = c('01').children!.find((sc) => sc.id === '01.02')!;
    expect(s102.children![0]).toMatchObject({ id: '01.01.01', code: '1.2.1' });
    expect(ch01()).toHaveLength(n0); // mismas partidas en el mismo bucket
  });

  it('moveSubtree rechaza: destino en el propio subárbol, inexistente, capítulos y el padre actual', () => {
    nestSubSub();
    const antes = JSON.stringify(state().chapters);
    state().moveSubtree('01.01', '01.01.01'); // dentro de su propio subárbol (ciclo)
    state().moveSubtree('01.01', 'no-existe'); // destino fantasma
    state().moveSubtree('01', '02'); // los capítulos no se mueven
    state().moveSubtree('01.01', '01'); // ya cuelga de ahí ("actual")
    expect(JSON.stringify(state().chapters)).toBe(antes);
  });

  it('moveSubtree conserva el dato de certificación (indexado por id de partida)', () => {
    const certData0 = JSON.stringify(state().certs.map((x) => x.data));
    state().moveSubtree('01.01', '02');
    expect(JSON.stringify(state().certs.map((x) => x.data))).toBe(certData0);
  });
});

describe('acciones F4 (certificaciones)', () => {
  it('addCert añade al final, hereda data/retención de la última y queda en curso', () => {
    const s = state();
    const n0 = s.certs.length; // 3 sembradas
    const last = s.certs[n0 - 1]!;
    state().addCert();
    const r = state();
    expect(r.certs).toHaveLength(n0 + 1);
    expect(r.curCert).toBe(n0); // la nueva, en curso
    const nueva = r.certs[n0]!;
    expect(nueva.num).toBe(last.num + 1);
    expect(nueva.period).toBe('');
    expect(nueva.retencion).toBe(last.retencion);
    expect(nueva.data).toEqual(last.data); // hereda a-origen…
  });

  it('la cert nueva es un clon independiente (no comparte data con la previa)', () => {
    const s = state();
    const prevIdx = s.certs.length - 1;
    state().addCert();
    const antes = state().certs[prevIdx]!.data.p111;
    state().onCertEdit('p111', 999, 'origen'); // edita la nueva (en curso)
    expect(state().certs[state().curCert]!.data.p111).toBe(999);
    expect(state().certs[prevIdx]!.data.p111).toBe(antes); // la previa intacta
  });

  it('setCertLine marca líneas: data = Σ lineQty a-origen (dogfood #3)', () => {
    state().setCurCert(0);
    state().setCertLine('p111', 'p111-m1', 61.2); // 1×85×0,6×1,2
    expect(state().certs[0]!.lineQty!.p111!['p111-m1']).toBe(61.2);
    expect(state().certs[0]!.data.p111).toBe(61.2);
    state().setCertLine('p111', 'p111-m2', 63.45); // 1×70,5×0,5×1,8
    expect(state().certs[0]!.data.p111).toBe(124.65); // Σ de las dos
  });

  it('setCertLine: desmarcar la última línea limpia lineQty y data de la partida', () => {
    state().setCurCert(0);
    state().setCertLine('p111', 'p111-m1', 61.2);
    state().setCertLine('p111', 'p111-m1', null);
    expect(state().certs[0]!.lineQty?.p111).toBeUndefined();
    expect(state().certs[0]!.data.p111).toBeUndefined();
  });

  it('onCertEdit (teclear cantidad) hace override y borra lineQty de la partida (§8a)', () => {
    state().setCurCert(0);
    state().setCertLine('p111', 'p111-m1', 61.2);
    expect(state().certs[0]!.lineQty?.p111).toBeDefined();
    state().onCertEdit('p111', 30, 'origen');
    expect(state().certs[0]!.data.p111).toBe(30);
    expect(state().certs[0]!.lineQty?.p111).toBeUndefined();
  });

  it('setCertLine sólo muta la cert en curso (aislamiento)', () => {
    state().setCurCert(0);
    state().setCertLine('p111', 'p111-m1', 61.2);
    expect(state().certs[1]!.lineQty?.p111).toBeUndefined();
    expect(state().certs[2]!.lineQty?.p111).toBeUndefined();
  });

  it('setCertField edita periodo y clampa la retención a [0,1]', () => {
    state().setCertField('period', 'Julio 2026');
    expect(state().certs[state().curCert]!.period).toBe('Julio 2026');
    state().setCertField('retencion', 0.05);
    expect(state().certs[state().curCert]!.retencion).toBe(0.05);
    state().setCertField('retencion', 2); // > 1 → clamp
    expect(state().certs[state().curCert]!.retencion).toBe(1);
    state().setCertField('retencion', -0.5); // < 0 → clamp
    expect(state().certs[state().curCert]!.retencion).toBe(0);
  });

  it('addContradictorio cuelga una línea P.C. del capítulo en la cert en curso', () => {
    state().setCurCert(0);
    state().addContradictorio('01');
    state().addContradictorio('01');
    state().addContradictorio('02');
    const extras = state().certs[0]!.extras!;
    expect(extras).toHaveLength(3);
    expect(extras.filter((e) => e.chapterId === '01').map((e) => e.pos)).toEqual(['C1', 'C2']);
    expect(extras.find((e) => e.chapterId === '02')!.pos).toBe('C1'); // pos por capítulo
  });

  it('editContradictorio edita campos y clampa cantidad/precio a ≥ 0', () => {
    state().setCurCert(0);
    state().addContradictorio('01');
    const id = state().certs[0]!.extras![0]!.id;
    state().editContradictorio(id, 'title', 'Refuerzo de zapata');
    state().editContradictorio(id, 'cantidad', 4);
    state().editContradictorio(id, 'precio', -5); // negativo → 0
    const e = state().certs[0]!.extras![0]!;
    expect(e.title).toBe('Refuerzo de zapata');
    expect(e.cantidad).toBe(4);
    expect(e.precio).toBe(0);
  });

  it('deleteContradictorio elimina la línea y limpia extras si queda vacío', () => {
    state().setCurCert(0);
    state().addContradictorio('01');
    const id = state().certs[0]!.extras![0]!.id;
    state().deleteContradictorio(id);
    expect(state().certs[0]!.extras).toBeUndefined();
  });

  it('addCert hereda los contradictorios a-origen como clon independiente', () => {
    // addCert hereda de la ÚLTIMA cronológica → operamos sobre la última.
    state().setCurCert(state().certs.length - 1);
    const prevIdx = state().certs.length - 1;
    state().addContradictorio('01');
    const id = state().certs[prevIdx]!.extras![0]!.id;
    state().editContradictorio(id, 'cantidad', 4);
    state().addCert();
    const nueva = state().certs.at(-1)!;
    expect(nueva.extras).toHaveLength(1);
    expect(nueva.extras![0]!.id).toBe(id); // mismo id → "anterior" cuadra
    expect(nueva.extras![0]!.cantidad).toBe(4);
    // editar la nueva (en curso) no toca la cert previa (clon independiente)
    state().editContradictorio(id, 'cantidad', 9);
    expect(state().certs[prevIdx]!.extras![0]!.cantidad).toBe(4);
  });
});

describe('snapshot de precios al certificar (F7.0, residuo de precio de T-2)', () => {
  it('addCert nace congelada: editar recurso/precio/K NO cambia su certPEM ni el líquido', () => {
    state().addCert(); // la nueva (en curso) congela TODOS los precios vivos
    const antes = selectCertTotals(state());
    expect(antes.certPEM).toBeGreaterThan(0); // hereda data de la última seed
    state().setPrecio('01', 'p111', 99); // precio a mano
    state().editRecurso('mo001', 'precio', 50); // recurso compartido
    state().setRates({ coefK: 1.5 }); // K global
    const despues = selectCertTotals(state());
    expect(despues.certPEM).toBe(antes.certPEM); // congelado
    expect(despues.liquido).toBe(antes.liquido);
    expect(despues.budgetPEM).not.toBe(antes.budgetPEM); // el presupuesto sí vive
  });

  it('cert legada (seed, sin snapshot) sigue valorándose en vivo', () => {
    expect(state().certs[2]!.priceSnapshot).toBeUndefined();
    const antes = selectCertTotals(state()); // curCert = 2 (seed)
    state().setPrecio('01', 'p111', 99);
    expect(selectCertTotals(state()).certPEM).not.toBe(antes.certPEM);
  });

  it('addCert congela el K vivo y la siguiente lo HEREDA (no re-congela)', () => {
    state().setRates({ coefK: 1.13 });
    state().addCert();
    expect(state().certs.at(-1)!.coefK).toBe(1.13);
    expect(state().certs.at(-1)!.snapshotAt).toBeTruthy();
    state().setRates({ coefK: 1.5 });
    state().addCert();
    expect(state().certs.at(-1)!.coefK).toBe(1.13); // heredado de la anterior
  });

  it('addCert hereda los precios congelados y congela al vivo los que falten', () => {
    state().addCert(); // cert A congela p111 a su precio vivo (18,42)
    expect(state().certs.at(-1)!.priceSnapshot!.p111).toBe(18.42);
    state().setPrecio('01', 'p111', 99); // el vivo cambia DESPUÉS de congelar
    state().addPartida('01', null); // partida nueva: no estaba en el snapshot de A
    const nueva = state().partidas['01']!.at(-1)!;
    state().setPrecio('01', nueva.id, 5);
    state().addCert(); // cert B
    const snapB = state().certs.at(-1)!.priceSnapshot!;
    expect(snapB.p111).toBe(18.42); // heredado (el "anterior" reproduce lo certificado)
    expect(snapB[nueva.id]).toBe(5); // congelado al precio vivo actual
  });

  it('onCertEdit congela esa partida en una cert legada (y sólo la primera vez)', () => {
    state().setCurCert(0);
    expect(state().certs[0]!.priceSnapshot).toBeUndefined();
    state().onCertEdit('p111', 10, 'origen');
    const c = state().certs[0]!;
    expect(c.priceSnapshot).toEqual({ p111: 18.42 });
    expect(c.coefK).toBe(1); // K vivo congelado junto al primer precio
    expect(c.snapshotAt).toBeTruthy();
    // editar el presupuesto después no mueve la valoración de esa partida…
    state().setPrecio('01', 'p111', 99);
    const p = state().partidas['01']!.find((x) => x.id === 'p111')!;
    const snap = certSnapshotOf(state().certs[0]!, state().rates.coefK);
    expect(toEur(certCalc(p, state().certs[0]!.data, {}, 1, snap).aOrigen)).toBe(184.2); // 10 × 18,42
    // …y re-certificarla NO re-congela (el primer precio queda).
    state().onCertEdit('p111', 20, 'origen');
    expect(state().certs[0]!.priceSnapshot!.p111).toBe(18.42);
  });

  it('setCertLine (marcar línea) también congela el precio de la partida', () => {
    state().setCurCert(0);
    state().setCertLine('p111', 'p111-m1', 61.2);
    expect(state().certs[0]!.priceSnapshot!.p111).toBe(18.42);
  });
});

describe('acciones F5 (panel Referencia · copiar)', () => {
  const bdt = REF_SOURCES.find((s) => s.id === 'base-bdt')!;
  const pADE = bdt.partidas.A!.find((p) => p.code === 'ADE010')!; // items: mo113, mq01ret020, %CI
  const item = (): RefCopyItem => ({ sourceName: bdt.name, partida: pADE });

  it('integra recursos nuevos en el banco SIN pisar los homónimos existentes', () => {
    // mq01ret020 ya está en el banco (seed p111) con su desc propia; mo113 es nuevo.
    const before = state().recursos['mq01ret020']!.desc;
    expect(before).toBe('Retrocargadora neumáticos 75 CV');
    state().copyRefPartidas([item()], null, false);
    const r = state();
    expect(r.recursos['mo113']?.desc).toBe('Peón ordinario construcción'); // nuevo
    expect(r.recursos['mq01ret020']!.desc).toBe(before); // NO pisado por refdata
    expect(r.recursos['%CI']).toBeUndefined(); // %CI no entra al banco
  });

  it('crea la partida con med:[], items por código, chip BASE y baseSource', () => {
    state().copyRefPartidas([item()], null, false); // destino = activo (cap 01)
    const list = state().partidas['01']!;
    const nueva = list.at(-1)!;
    expect(nueva.code).toBe('ADE010');
    expect(nueva.fromBase).toBe(true);
    expect(nueva.contradictorio).toBeUndefined();
    expect(nueva.baseSource).toBe(bdt.name);
    expect(nueva.med).toEqual([]);
    expect(nueva.desc).toContain('Excavación'); // REF_DESC copiada
    // items mapeados a {code,type,cantidad}; el %CI sin precio
    expect(nueva.items.map((i) => i.code)).toEqual(['mo113', 'mq01ret020', '%CI']);
    expect(nueva.items.find((i) => i.code === '%CI')!.precio).toBeUndefined();
    expect(state().expanded['01']).toBe(true);
  });

  it('como contradictorio marca P.C. (no BASE)', () => {
    state().copyRefPartidas([item()], null, true);
    const nueva = state().partidas['01']!.at(-1)!;
    expect(nueva.contradictorio).toBe(true);
    expect(nueva.fromBase).toBeFalsy();
  });

  it('respeta el destino explícito (capítulo distinto del activo)', () => {
    const n02 = state().partidas['02']?.length ?? 0;
    state().copyRefPartidas([item()], { chId: '02', subId: null }, false);
    expect(state().partidas['02']).toHaveLength(n02 + 1);
  });

  it('copiar varias crea una partida por cada una con pos correlativa', () => {
    const list0 = state().partidas['01']!.length;
    const dos = bdt.partidas.A!.slice(0, 2).map((p) => ({ sourceName: bdt.name, partida: p }));
    state().copyRefPartidas(dos, null, false);
    expect(state().partidas['01']).toHaveLength(list0 + 2);
  });

  it('setRefOpen alterna, setRefSource cambia fuente, setRefWidth clampa 320–640', () => {
    expect(state().refOpen).toBe(false);
    state().setRefOpen();
    expect(state().refOpen).toBe(true);
    state().setRefOpen(false);
    expect(state().refOpen).toBe(false);
    state().setRefSource('cype-gp');
    expect(state().refSourceId).toBe('cype-gp');
    state().setRefWidth(9999);
    expect(state().refWidth).toBe(640);
    state().setRefWidth(10);
    expect(state().refWidth).toBe(320);
  });
});

describe('ids únicos tras recargar (regresión F6.1 — el landmine de los contadores)', () => {
  it('crear partidas → "recargar" (loadObra) → crear más NO colisiona ids', () => {
    // Sesión 1: crea partidas; recoge sus ids.
    state().addPartida('01', null);
    state().addPartida('01', null);
    const session1 = new Set(allPartidas().map((p) => p.id));
    expect(session1.size).toBeGreaterThan(0);
    // "Recarga": carga la obra serializada (lo que hace la hidratación de F6).
    const serialized = toSerializable(state());
    state().loadObra(serialized);
    // Sesión 2: crea más. Con ids únicos (UUID) el nuevo id NO está entre los previos.
    state().addPartida('01', null);
    const nuevo = state().partidas['01']!.at(-1)!.id;
    expect(session1.has(nuevo)).toBe(false);
    // Invariante global: todos los ids de partida siguen siendo únicos.
    const todos = allPartidas().map((p) => p.id);
    expect(new Set(todos).size).toBe(todos.length);
  });

  it('los generadores devuelven ids únicos por construcción (sin contadores de sesión)', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      state().addPartida('02', null);
      state().addContradictorio('02');
    }
    for (const p of state().partidas['02'] ?? []) ids.add(p.id);
    for (const e of state().certs[state().curCert]?.extras ?? []) ids.add(e.id);
    // 50 partidas + 50 contradictorios, todos distintos.
    expect(ids.size).toBeGreaterThanOrEqual(100);
  });
});

describe('loadObra (importar .bc3, F5.3)', () => {
  it('reemplaza la obra, estampa esquema y deja la vista en presupuesto', () => {
    state().loadObra({
      chapters: [{ id: '01', code: '1', title: 'Cap importado' }],
      partidas: { '01': [] },
      recursos: { r1: { type: 'MAT', desc: 'X', ud: 'm', precio: 5 } },
      certs: [{ id: 'c1', num: 1, period: 'Certificación nº 1', retencion: 0.05, data: {} }],
      rates: { ...DEFAULT_RATES, coefK: 1.13 },
      obra: { denominacion: 'Obra X', direccion: '', localidad: '' },
    });
    const s = state();
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.chapters).toHaveLength(1);
    expect(s.partidas['01']).toEqual([]);
    expect(s.rates.coefK).toBe(1.13);
    expect(s.obra.denominacion).toBe('Obra X');
    expect(s.view).toBe('presupuesto');
    expect(s.active).toBe('01');
    expect(s.expanded).toEqual({}); // una obra importada se explora colapsada
    expect(s.curCert).toBe(0);
    expect(s.refOpen).toBe(false);
  });
});

describe('selección/despliegue de partida (openPartidaId, single-open)', () => {
  it('togglePartida abre/cierra; abrir otra cierra la anterior (single-open)', () => {
    const [a, b] = allPartidas();
    state().togglePartida(a!.id);
    expect(state().openPartidaId).toBe(a!.id);
    state().togglePartida(b!.id); // abrir otra
    expect(state().openPartidaId).toBe(b!.id); // la anterior se cerró
    state().togglePartida(b!.id); // volver a pulsar la abierta
    expect(state().openPartidaId).toBeNull(); // se cierra/deselecciona
  });

  it('cambiar de vista o de capítulo activo deselecciona', () => {
    const a = allPartidas()[0]!.id;
    state().togglePartida(a);
    state().setActive('02');
    expect(state().openPartidaId).toBeNull();
    state().togglePartida(a);
    state().setView('resumen');
    expect(state().openPartidaId).toBeNull();
  });

  it('borrar la partida seleccionada limpia la selección (no queda fantasma)', () => {
    const p = state().partidas['01']![0]!;
    state().togglePartida(p.id);
    state().deletePartida('01', p.id);
    expect(state().openPartidaId).toBeNull();
  });

  it('loadObra resetea la selección', () => {
    state().togglePartida('p111');
    state().loadObra(toSerializable(state()));
    expect(state().openPartidaId).toBeNull();
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

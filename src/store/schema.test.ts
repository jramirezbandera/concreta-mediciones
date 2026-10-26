/* Esquema v6 (medir sobre planos PDF): migración, carga sin herencia, validar
   sin destruir y topes. Especificación · Etapa A, §1. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apartarIlegibles, escalaDe, escalaLegible, excedeTopes, origenLegible, planoLegible } from '../core/planoDatos';
import type { PlanoMeta } from '../core/types';
import { isObraData } from '../persist/persist';
import { ImportError, buildExportText, parseObraJson } from '../persist/transfer';
import a0 from '../test/fixtures/planos/obra-v6-a0.json';
import a1 from '../test/fixtures/planos/obra-v6-a1.json';
import { SCHEMA_VERSION, blankObraData, fromSerializable, toSerializable, type ObraData } from './schema';
import { useObraStore } from './obraStore';

const A0 = a0 as unknown as ObraData;
const A1 = a1 as unknown as ObraData;
const clon = <T,>(x: T): T => structuredClone(x);

beforeEach(() => {
  useObraStore.getState().reset();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('v5 → v6', () => {
  it('estrena `planos: []` y sube la versión', () => {
    const v5 = { ...blankObraData(), schemaVersion: 5 } as Partial<ObraData>;
    delete v5.planos;
    const d = fromSerializable(v5 as ObraData);
    expect(d.schemaVersion).toBe(SCHEMA_VERSION);
    expect(d.planos).toEqual([]);
  });
});

describe('v6 → v7 (estudio de residuos)', () => {
  it('solo sube la versión: sin estudio ni residuos en las partidas', () => {
    const v6 = { ...blankObraData(), schemaVersion: 6 } as ObraData;
    delete v6.estudioRcd;
    const d = fromSerializable(clon(v6));
    expect(d).toEqual({ ...v6, schemaVersion: SCHEMA_VERSION });
    expect(d.estudioRcd).toBeUndefined();
  });

  it('un `rcd` o un `estudioRcd` ilegible se aparta a `_ilegible` sin romper la obra', () => {
    const d0 = blankObraData();
    d0.chapters = [{ id: 'c', code: '1', title: 'C' }];
    d0.partidas = {
      c: [
        { id: 'p1', pos: '1', code: 'A', title: 'A', ud: 'm²', precio: 1, desc: '', med: [], items: [], rcd: { estado: 'raro' } as never },
        { id: 'p2', pos: '2', code: 'B', title: 'B', ud: 'm²', precio: 1, desc: '', med: [], items: [],
          rcd: { estado: 'propuesta', origen: { tipo: 'regla', motivo: 'x' }, componentes: [] } },
      ],
    };
    (d0 as { estudioRcd?: unknown }).estudioRcd = { version: 9 };
    const d = fromSerializable(clon(d0));
    expect(d.partidas.c![0]!.rcd).toBeUndefined();
    expect(d.partidas.c![1]!.rcd!.estado).toBe('propuesta');
    expect(d.estudioRcd).toBeUndefined();
    expect(d._ilegible!.map((x) => x.donde)).toEqual(['partidas/c/p1/rcd', 'estudioRcd']);
  });

  it('isObraData: una v5 sin `planos` es válida; una v6 sin `planos`, no', () => {
    const v5 = { ...blankObraData(), schemaVersion: 5 } as Partial<ObraData>;
    delete v5.planos;
    expect(isObraData(v5)).toBe(true);
    const v6 = { ...blankObraData() } as Partial<ObraData>;
    delete v6.planos;
    expect(isObraData(v6)).toBe(false);
    expect(isObraData({ ...blankObraData(), planos: [null, 3] })).toBe(true); // un plano malo no la tumba
  });
});

describe('v7 → v8 (plan de control de calidad)', () => {
  it('solo sube la versión: sin plan ni control en las partidas', () => {
    const v7 = { ...blankObraData(), schemaVersion: 7 } as ObraData;
    delete v7.planCalidad;
    const d = fromSerializable(clon(v7));
    expect(SCHEMA_VERSION).toBe(8);
    expect(d).toEqual({ ...v7, schemaVersion: 8 });
    expect(d.planCalidad).toBeUndefined();
  });

  it('un `pcc` o un `planCalidad` ilegible se aparta a `_ilegible` sin romper la obra', () => {
    const d0 = blankObraData();
    d0.chapters = [{ id: 'c', code: '1', title: 'C' }];
    d0.partidas = {
      c: [
        { id: 'p1', pos: '1', code: 'A', title: 'A', ud: 'm³', precio: 1, desc: '', med: [], items: [], pcc: { estado: 'otro' } as never },
        { id: 'p2', pos: '2', code: 'B', title: 'B', ud: 'm³', precio: 1, desc: '', med: [], items: [],
          pcc: { estado: 'propuesta', origen: { tipo: 'regla', motivo: 'x' }, familia: 'fabrica-ladrillo' } },
        { id: 'p3', pos: '3', code: 'C', title: 'C', ud: 'm³', precio: 1, desc: '', med: [], items: [],
          pcc: { estado: 'confirmada', origen: { tipo: 'regla', motivo: 'x' }, hormigon: { designacion: 'HA-25' } } as never },
      ],
    };
    (d0 as { planCalidad?: unknown }).planCalidad = { version: 1, precios: [] };
    const d = fromSerializable(clon(d0));
    expect(d.partidas.c![0]!.pcc).toBeUndefined();
    expect(d.partidas.c![1]!.pcc!.familia).toBe('fabrica-ladrillo');
    expect(d.partidas.c![2]!.pcc).toBeUndefined();
    expect(d.planCalidad).toBeUndefined();
    expect(d._ilegible!.map((x) => x.donde)).toEqual(['partidas/c/p1/pcc', 'partidas/c/p3/pcc', 'planCalidad']);
  });

  it('toSerializable lleva `planCalidad` solo si hay plan', () => {
    expect('planCalidad' in toSerializable(blankObraData())).toBe(false);
    expect(toSerializable({ ...blankObraData(), planCalidad: { version: 1 } }).planCalidad).toEqual({ version: 1 });
  });
});

describe('carga sin herencia', () => {
  it('loadObra de un .bc3 tras una obra con planos no los arrastra', () => {
    useObraStore.getState().loadObra(fromSerializable(clon(A0)));
    expect(useObraStore.getState().planos).toHaveLength(1);
    const { schemaVersion: _v, bajas: _b, planos: _p, ...bc3 } = blankObraData('Importada');
    void _v;
    void _b;
    void _p;
    useObraStore.getState().loadObra(bc3);
    expect(useObraStore.getState().planos).toEqual([]);
    expect(useObraStore.getState()._ilegible).toBeUndefined();
  });

  it('toSerializable incluye `planos` y `_ilegible` (solo si hay)', () => {
    const d = toSerializable({ ...blankObraData(), planos: A0.planos });
    expect(d.planos).toBe(A0.planos);
    expect('_ilegible' in d).toBe(false);
    const i = toSerializable({ ...blankObraData(), _ilegible: [{ donde: 'planos/0', valor: null }] });
    expect(i._ilegible).toEqual([{ donde: 'planos/0', valor: null }]);
  });
});

describe('validar sin destruir (§1.4)', () => {
  it('`planos: [null]`, una escala 0 y un `origen` con NaN cargan la obra', () => {
    const d = clon(A0);
    (d.planos as unknown[]).push(null);
    d.planos[0]!.escalas[1]!.mPorUnidad = 0;
    const l = d.partidas.c01![0]!.med[0]!;
    (l.origen as unknown as Record<string, unknown>).puntos = [[NaN, 1]];
    expect(isObraData(d)).toBe(true);
    const r = fromSerializable(d);
    // la escala 0 se queda en su sitio, opaca: la página cuenta como sin calibrar
    expect(escalaLegible(r.planos[0]!.escalas[1])).toBe(false);
    expect(escalaDe(r.planos[0]!, 1)).toBeNull();
    // el origen con NaN se conserva tal cual (marcador «procedencia ilegible»)
    expect(origenLegible(r.partidas.c01![0]!.med[0]!.origen)).toBe(false);
    expect(r.partidas.c01![0]!.med[0]!.largo).toBe(9.45); // la línea sigue con sus números
    // lo que rompería el render (el `null`) va a `_ilegible` con su ruta
    expect(r.planos).toHaveLength(1);
    expect(r._ilegible).toEqual([{ donde: 'planos/1', valor: null }]);
  });

  it('`origen`, `escalas` o `etiquetas` que no son un objeto se apartan con su ruta', () => {
    const d = clon(A0);
    d.planos[0]!.escalas = 'rota' as unknown as PlanoMeta['escalas'];
    d.planos[0]!.etiquetas = 7 as unknown as PlanoMeta['etiquetas'];
    (d.partidas.c01![0]!.med[0] as unknown as { origen: unknown }).origen = 'x';
    const r = apartarIlegibles(d);
    expect(r._ilegible).toEqual([
      { donde: 'planos/0/escalas', valor: 'rota' },
      { donde: 'planos/0/etiquetas', valor: 7 },
      { donde: 'partidas/c01/p-tabique/med/l-tabique/origen', valor: 'x' },
    ]);
    expect(r.planos[0]!.escalas).toEqual({});
    expect('etiquetas' in r.planos[0]!).toBe(false);
    expect('origen' in r.partidas.c01![0]!.med[0]!).toBe(false);
    expect(planoLegible(r.planos[0])).toBe(true);
  });

  it('apartar no guarda: la obra en el store cambia solo al cargar, y lo apartado viaja en el siguiente guardado', () => {
    const d = clon(A0);
    (d.planos as unknown[]).push(42);
    const saves: unknown[] = [];
    const unsub = useObraStore.subscribe((s) => s.planos, (p) => saves.push(p));
    useObraStore.getState().loadObra(fromSerializable(d));
    unsub();
    expect(useObraStore.getState()._ilegible).toEqual([{ donde: 'planos/1', valor: 42 }]);
    expect(toSerializable(useObraStore.getState())._ilegible).toEqual([{ donde: 'planos/1', valor: 42 }]);
  });

  it('las guardas aceptan todo lo de los fixtures', () => {
    for (const o of [A0, A1]) {
      for (const p of o.planos) {
        expect(planoLegible(p)).toBe(true);
        for (const e of Object.values(p.escalas)) expect(escalaLegible(e)).toBe(true);
      }
      for (const ps of Object.values(o.partidas))
        for (const p of ps) for (const l of p.med) expect(origenLegible(l.origen), l.id).toBe(true);
    }
  });

  it('el lector A0 ante `obra-v6-a1.json` conserva lo que no entiende y lo devuelve igual al guardar', () => {
    const r = toSerializable(fromSerializable(clon(A1)));
    // Solo cambia la versión (la v7 no toca los planos).
    expect(JSON.parse(JSON.stringify(r))).toEqual({ ...A1, schemaVersion: SCHEMA_VERSION });
  });
});

describe('copia .json', () => {
  it('claves de página de ida y vuelta: llegan como texto y se leen como página', () => {
    useObraStore.getState().loadObra(fromSerializable(clon(A0)));
    const texto = buildExportText();
    const vuelta = parseObraJson(texto);
    expect(Object.keys(vuelta.planos[0]!.escalas)).toEqual(['1']);
    expect(escalaDe(vuelta.planos[0]!, 1)?.rev).toBe('cal-p1-1');
    expect(vuelta.partidas.c01![0]!.med[0]!.origen).toEqual(A0.partidas.c01![0]!.med[0]!.origen);
  });

  it('topes al importar: más de 200 planos o 2 000 puntos por forma → «demasiado grande»', () => {
    const muchos = clon(A0);
    muchos.planos = Array.from({ length: 201 }, (_, i) => ({ ...A0.planos[0]!, id: `p${i}` }));
    expect(excedeTopes(muchos)).toBe('planos');
    expect(() => parseObraJson(JSON.stringify(muchos))).toThrow(ImportError);
    try {
      parseObraJson(JSON.stringify(muchos));
    } catch (e) {
      expect((e as ImportError).kind).toBe('demasiado-grande');
    }
    const puntos = clon(A0);
    (puntos.partidas.c01![0]!.med[0]!.origen as { puntos: unknown[] }).puntos = Array.from({ length: 2001 }, (_, i) => [i, 0]);
    expect(excedeTopes(puntos)).toBe('puntosPorOrigen');
    const paginas = clon(A0);
    paginas.planos[0]!.paginas = 2001;
    expect(excedeTopes(paginas)).toBe('paginasPorPlano');
    expect(excedeTopes(A0)).toBeNull();
  });
});

/* «Liberar espacio» (§9.4, A1): qué PDF se ofrecen, cuáles se conservan y por
   qué. Espía de `registry` para simular una obra que no se puede leer. */
import 'fake-indexeddb/auto';
import { clear, set } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock(import('./registry'), { spy: true });
import * as registry from './registry';
import type { PlanoMeta } from '../core/types';
import a0 from '../test/fixtures/planos/obra-v6-a0.json';
import { FakeLockManager } from '../test/fakeLocks';
import { blankObraData, fromSerializable, useObraStore, type ObraData } from '../store';
import { usePlanoUiStore } from '../store/planoUiStore';
import { __resetHistoryForTests, initHistory } from '../store/temporal';
import { __setCanalForTests, buscarPdfSinUso, escucharPreguntasDeHuellas, liberarPdf } from './liberar';
import { obraKey } from './persist';
import { __resetPlanosForTests, guardarPlano, leerMetaPlano, tienePlano } from './planos';
import { CANDADO_PLANOS } from './planos';
import { __setLockManagerForTests, conCandado } from './tabLock';

const DIA = 86_400_000;
const st = () => useObraStore.getState();
const hA = 'a'.repeat(64);
const hB = 'b'.repeat(64);
const bytes = (n: number) => new Uint8Array(n).fill(7).buffer;
const luego = () => ({ ahora: Date.now() + 2 * DIA, esperaMs: 0 });

/* Un «BroadcastChannel» entre pestañas simuladas. */
type Canal = { postMessage(m: unknown): void; onmessage: ((e: MessageEvent) => void) | null; close(): void };
const bus = new Set<Canal>();
function canal(): Canal {
  const c: Canal = {
    onmessage: null,
    postMessage(m) {
      for (const o of bus) if (o !== c) queueMicrotask(() => o.onmessage?.({ data: structuredClone(m) } as MessageEvent));
    },
    close() {
      bus.delete(c);
    },
  };
  bus.add(c);
  return c;
}
/** Otra pestaña que contesta que usa `huellas`. */
function otraPestana(huellas: string[]) {
  const c = canal();
  c.onmessage = (e) => {
    const m = e.data as { t: string; id: string };
    if (m.t === 'pregunta') c.postMessage({ t: 'respuesta', id: m.id, huellas });
  };
}

const conPlano = (h: string): ObraData => ({
  ...blankObraData('Otra'),
  planos: [{ id: 'pl', tipo: 'pdf', nombre: 'P', archivo: 'otra.pdf', tamano: 3, huella: h, paginas: 1, escalas: {} }],
});

beforeEach(async () => {
  vi.clearAllMocks();
  await clear();
  await __resetPlanosForTests();
  __resetHistoryForTests();
  st().reset();
  usePlanoUiStore.getState().reset();
  bus.clear();
  __setCanalForTests(canal);
});
afterEach(() => {
  __setCanalForTests(null);
  __setLockManagerForTests(null);
});

describe('buscar los PDF sin uso', () => {
  it('ofrece el que no usa ninguna obra y conserva el que usa otra guardada; liberar lo borra', async () => {
    await guardarPlano(hA, bytes(3), 'application/pdf', 'usado.pdf');
    await guardarPlano(hB, bytes(5), 'application/pdf', 'suelto.pdf');
    await registry.createObra(conPlano(hA));
    const r = await buscarPdfSinUso(luego());
    expect(r).toMatchObject({ kind: 'ok', libres: [{ huella: hB, tamano: 5, nombre: 'suelto.pdf' }], historial: [], recientes: 0 });
    expect((await leerMetaPlano(hB))!.sinReferenciaDesde).toBeTruthy();
    expect(await leerMetaPlano(hA)).not.toHaveProperty('sinReferenciaDesde');
    if (r.kind !== 'ok') return;
    const l = await liberarPdf(r.libres, { esperaMs: 0 });
    expect(l).toEqual({ kind: 'ok', liberados: 1, bytes: 5, conservados: 0 });
    expect(await tienePlano(hB)).toBe(false);
    expect(await tienePlano(hA)).toBe(true);
    expect(usePlanoUiStore.getState().disponibles[hB]).toBe(false);
  });

  it('nunca ofrece uno tocado hace menos de 24 h', async () => {
    await guardarPlano(hB, bytes(5), 'application/pdf');
    expect(await buscarPdfSinUso({ esperaMs: 0 })).toEqual({ kind: 'ok', libres: [], historial: [], recientes: 1 });
  });

  it('la obra en memoria, aún sin guardar, cuenta', async () => {
    await guardarPlano(hB, bytes(5), 'application/pdf');
    st().loadObra(conPlano(hB));
    expect(await buscarPdfSinUso(luego())).toMatchObject({ kind: 'ok', libres: [] });
  });

  it('otra pestaña que lo usa (en memoria o en su historial) lo conserva', async () => {
    await guardarPlano(hB, bytes(5), 'application/pdf');
    otraPestana([hB]);
    expect(await buscarPdfSinUso({ ahora: Date.now() + 2 * DIA, esperaMs: 20 })).toMatchObject({ kind: 'ok', libres: [] });
  });

  it('esta pestaña contesta a las demás con su memoria y su historial', async () => {
    st().loadObra(conPlano(hA));
    escucharPreguntasDeHuellas();
    const respuestas: unknown[] = [];
    const yo = canal();
    yo.onmessage = (e) => respuestas.push(e.data);
    yo.postMessage({ t: 'pregunta', id: 'x' });
    await vi.waitFor(() => expect(respuestas).toEqual([{ t: 'respuesta', id: 'x', huellas: [hA] }]));
  });

  it('su propio oyente no le contesta (su historial no cuenta como «otra pestaña»)', async () => {
    const data = JSON.parse(JSON.stringify(a0).split((a0 as unknown as { planos: PlanoMeta[] }).planos[0]!.huella).join(hB));
    await guardarPlano(hB, bytes(5), 'application/pdf');
    st().loadObra(fromSerializable(data));
    initHistory(useObraStore);
    st().removePlano({ planoId: 'pl-p1', expect: { docToken: st().docToken } });
    escucharPreguntasDeHuellas();
    const r = await buscarPdfSinUso({ ahora: Date.now() + 2 * DIA, esperaMs: 20 });
    expect(r).toMatchObject({ kind: 'ok', historial: [{ huella: hB }] });
  });

  it('un sobre dañado que el índice no lista cuenta en crudo', async () => {
    await guardarPlano(hB, bytes(5), 'application/pdf');
    await set(obraKey('rota'), { cualquier: { cosa: [hB] } });
    expect(await buscarPdfSinUso(luego())).toMatchObject({ kind: 'ok', libres: [] });
  });

  it('una obra que no se puede leer detiene la limpieza', async () => {
    await guardarPlano(hB, bytes(5), 'application/pdf');
    await registry.createObra(blankObraData('Ilegible'));
    vi.mocked(registry.huellasDeObraGuardada).mockResolvedValueOnce(null);
    expect(await buscarPdfSinUso(luego())).toEqual({
      kind: 'detenida',
      motivo: 'Limpieza detenida: no se pudo leer la obra «Ilegible». Para no borrar un PDF que use, no se borra nada.',
    });
    expect(await leerMetaPlano(hB)).not.toHaveProperty('sinReferenciaDesde'); // ni marca
  });
});

describe('el plano quitado que Deshacer aún recupera', () => {
  it('va aparte con sus líneas y solo se libera si se pide expresamente', async () => {
    const data = JSON.parse(JSON.stringify(a0).split((a0 as unknown as { planos: PlanoMeta[] }).planos[0]!.huella).join(hB));
    await guardarPlano(hB, bytes(5), 'application/pdf');
    st().loadObra(fromSerializable(data));
    initHistory(useObraStore);
    st().removePlano({ planoId: 'pl-p1', expect: { docToken: st().docToken } });
    const r = await buscarPdfSinUso(luego());
    expect(r).toMatchObject({ kind: 'ok', libres: [], historial: [{ huella: hB, lineas: 7 }] });
    if (r.kind !== 'ok') return;
    expect(await liberarPdf(r.historial, { esperaMs: 0 })).toMatchObject({ liberados: 0, conservados: 1 });
    expect(await liberarPdf(r.historial.map((p) => ({ ...p, delHistorial: true })), { esperaMs: 0 })).toMatchObject({
      liberados: 1,
    });
    expect(await tienePlano(hB)).toBe(false);
  });
});

describe('entre listar y borrar', () => {
  it('adjuntarlo otra vez quita la marca: se conserva', async () => {
    await guardarPlano(hB, bytes(5), 'application/pdf');
    const r = await buscarPdfSinUso(luego());
    if (r.kind !== 'ok') throw new Error('detenida');
    await guardarPlano(hB, bytes(5), 'application/pdf'); // otra pestaña lo adjunta
    expect(await liberarPdf(r.libres, { esperaMs: 0 })).toEqual({ kind: 'ok', liberados: 0, bytes: 0, conservados: 1 });
    expect(await tienePlano(hB)).toBe(true);
  });

  it('adjuntar en B y liberar en A antes de que B guarde: A espera al candado y lo conserva', async () => {
    __setLockManagerForTests(new FakeLockManager());
    await guardarPlano(hB, bytes(5), 'application/pdf');
    const r = await buscarPdfSinUso(luego());
    if (r.kind !== 'ok') throw new Error('detenida');
    // B: candado compartido mientras publica y guarda su obra (la marca sigue igual).
    let soltarB!: () => void;
    const b = conCandado(CANDADO_PLANOS, 'shared', () => new Promise<void>((res) => (soltarB = res)));
    const a = liberarPdf(r.libres, { esperaMs: 0 });
    await registry.createObra(conPlano(hB)); // B guarda su obra con el plano
    soltarB();
    await b;
    expect(await a).toEqual({ kind: 'ok', liberados: 0, bytes: 0, conservados: 1 });
    expect(await tienePlano(hB)).toBe(true);
  });
});

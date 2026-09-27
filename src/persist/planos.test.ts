import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetPlanosForTests,
  espacioNavegador,
  esCuotaLlena,
  guardarPlano,
  leerBytes,
  leerMetaPlano,
  tienePlano,
} from './planos';

const bytes = (n: number, v = 7) => new Uint8Array(n).fill(v).buffer;

beforeEach(async () => {
  await __resetPlanosForTests();
});
afterEach(() => vi.unstubAllGlobals());

describe('almacén de planos (concreta-planos)', () => {
  it('adjuntar y leer por huella', async () => {
    expect(await tienePlano('h1')).toBe(false);
    await guardarPlano('h1', bytes(10), 'application/pdf');
    expect(await tienePlano('h1')).toBe(true);
    expect(new Uint8Array((await leerBytes('h1'))!)).toEqual(new Uint8Array(bytes(10)));
    expect(await leerMetaPlano('h1')).toMatchObject({ tamano: 10, tipo: 'application/pdf' });
    expect(await leerBytes('otra')).toBeUndefined();
  });

  it('la misma huella dos veces guarda los bytes una vez y renueva `tocadoEn`', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-26T10:00:00.000Z'));
    await guardarPlano('h1', bytes(10, 1), 'application/pdf');
    vi.setSystemTime(new Date('2026-09-27T10:00:00.000Z'));
    // otra llamada con bytes distintos bajo la misma huella: no reescribe `bytes`
    await guardarPlano('h1', bytes(10, 2), 'application/pdf');
    vi.useRealTimers();
    expect(new Uint8Array((await leerBytes('h1'))!)[0]).toBe(1);
    expect((await leerMetaPlano('h1'))!.tocadoEn).toBe('2026-09-27T10:00:00.000Z');
  });

  it('el `update` de `meta` quita la marca de sin referencia [A1] y conserva lo demás', async () => {
    await guardarPlano('h1', bytes(4), 'application/pdf');
    // lo que dejaría «Liberar espacio» [A1]
    const req = indexedDB.open('concreta-planos', 1);
    await new Promise<void>((resolve) => {
      req.onsuccess = () => {
        const tx = req.result.transaction('meta', 'readwrite');
        tx.objectStore('meta').put({ tamano: 4, tipo: 'application/pdf', tocadoEn: 'x', sinReferenciaDesde: 'y', restauracion: 'r1' }, 'h1');
        tx.oncomplete = () => {
          req.result.close();
          resolve();
        };
      };
    });
    await guardarPlano('h1', bytes(4), 'application/pdf');
    const m = await leerMetaPlano('h1');
    expect(m).not.toHaveProperty('sinReferenciaDesde');
    expect(m!.restauracion).toBe('r1');
  });

  it('cuota llena: la escritura rechaza con un error reconocible', async () => {
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === 'bytes') throw new DOMException('Cuota llena', 'QuotaExceededError');
      return put.apply(this, args as Parameters<typeof put>);
    });
    await expect(guardarPlano('h2', bytes(8), 'application/pdf')).rejects.toSatisfy(esCuotaLlena);
    vi.restoreAllMocks();
    expect(await tienePlano('h2')).toBe(false);
    expect(await leerMetaPlano('h2')).toBeUndefined(); // ni meta: todo o nada
  });

  it('espacio del navegador: protegido si `estimate` no existe o falla', async () => {
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({ usage: 10, quota: 100 }) } });
    expect(await espacioNavegador()).toEqual({ usado: 10, cuota: 100 });
    vi.stubGlobal('navigator', { storage: { estimate: async () => Promise.reject(new Error('no')) } });
    expect(await espacioNavegador()).toBeNull();
    vi.stubGlobal('navigator', {});
    expect(await espacioNavegador()).toBeNull();
  });
});

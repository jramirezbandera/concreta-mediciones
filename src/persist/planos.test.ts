import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetPlanosForTests,
  borrarSinReferencia,
  sincronizarMarcas,
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

  it('el `update` de `meta` quita la marca de sin referencia y el token de restauración [A1]', async () => {
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
    // adjuntarlo lo ADOPTA: una restauración que no termina ya no lo retira
    expect(m).not.toHaveProperty('restauracion');
    expect(m).toMatchObject({ tamano: 4, tipo: 'application/pdf' });
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

describe('[A1] marcas de «sin referencia» y borrado (§9.4)', () => {
  it('marcar y desmarcar solo toca `meta`; borrar exige la marca que se vio', async () => {
    await guardarPlano('h1', bytes(10, 1), 'application/pdf', 'uno.pdf');
    await guardarPlano('h2', bytes(10, 2), 'application/pdf');
    const metas = await sincronizarMarcas(new Set(['h1']), '2026-09-29T10:00:00.000Z');
    expect(metas.get('h1')).not.toHaveProperty('sinReferenciaDesde');
    expect(metas.get('h1')).toMatchObject({ nombre: 'uno.pdf' });
    expect(metas.get('h2')).toMatchObject({ sinReferenciaDesde: '2026-09-29T10:00:00.000Z' });
    // una segunda pasada no cambia una marca ya puesta; volver a usarlo la quita
    await sincronizarMarcas(new Set(), '2026-09-30T10:00:00.000Z');
    expect((await leerMetaPlano('h2'))!.sinReferenciaDesde).toBe('2026-09-29T10:00:00.000Z');
    await sincronizarMarcas(new Set(['h1', 'h2']), 'x');
    expect(await leerMetaPlano('h2')).not.toHaveProperty('sinReferenciaDesde');
    expect(new Uint8Array((await leerBytes('h2'))!)[0]).toBe(2);

    await sincronizarMarcas(new Set(), '2026-10-01T00:00:00.000Z');
    expect(await borrarSinReferencia('h2', 'otra marca')).toBe(false);
    expect(await tienePlano('h2')).toBe(true);
    expect(await borrarSinReferencia('h2', '2026-10-01T00:00:00.000Z')).toBe(true);
    expect(await tienePlano('h2')).toBe(false);
    expect(await leerMetaPlano('h2')).toBeUndefined();
  });
});

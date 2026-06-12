import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toSerializable, useObraStore } from '../store';
import {
  ImportError,
  buildExportText,
  exportObraJson,
  parseObraJson,
  readFileText,
} from './transfer';

const state = () => useObraStore.getState();

beforeEach(() => {
  state().reset();
});

describe('parseObraJson (F6.3)', () => {
  it('round-trip: lo exportado se vuelve a parsear a un ObraData equivalente', () => {
    state().setRates({ coefK: 1.42 });
    const data = parseObraJson(buildExportText());
    expect(data.rates.coefK).toBe(1.42);
    expect(data).toEqual(toSerializable(state()));
  });

  it('acepta un ObraData plano (sin sobre)', () => {
    const bare = JSON.stringify(toSerializable(state()));
    expect(parseObraJson(bare).obra.denominacion).toContain('C/ Mayor 14');
  });

  it('acepta un sobre de guardado/recuperación (campo .data)', () => {
    const enveloped = JSON.stringify({ schemaVersion: 1, savedAt: 'x', data: toSerializable(state()) });
    expect(parseObraJson(enveloped).chapters.length).toBeGreaterThan(0);
  });

  it('JSON inválido → ImportError "malformado"', () => {
    expect(() => parseObraJson('{ no es json')).toThrow(ImportError);
    try {
      parseObraJson('{ no es json');
    } catch (e) {
      expect((e as ImportError).kind).toBe('malformado');
    }
  });

  it('JSON válido pero sin forma de ObraData → "malformado"', () => {
    try {
      parseObraJson(JSON.stringify({ hola: 'mundo' }));
      throw new Error('debería haber lanzado');
    } catch (e) {
      expect((e as ImportError).kind).toBe('malformado');
    }
  });

  it('schemaVersion futura → "version-desconocida"', () => {
    const future = { ...toSerializable(state()), schemaVersion: 99 };
    try {
      parseObraJson(JSON.stringify(future));
      throw new Error('debería haber lanzado');
    } catch (e) {
      expect((e as ImportError).kind).toBe('version-desconocida');
    }
  });

  it('una obra v1 (2 niveles) MIGRA a v2 en el import .json (cadena identidad)', () => {
    // Backup real anterior a la jerarquía N niveles: schemaVersion 1, subs planos.
    const v1 = { ...toSerializable(state()), schemaVersion: 1 };
    const data = parseObraJson(JSON.stringify(v1));
    expect(data.schemaVersion).toBe(2);
    expect(data.chapters.length).toBeGreaterThan(0);
    // El árbol degenerado (2 niveles) sobrevive intacto.
    expect(data.chapters[0]!.children?.length).toBeGreaterThan(0);
  });
});

describe('exportObraJson (descarga)', () => {
  it('genera un blob y dispara la descarga del .json', () => {
    const createURL = vi.fn((_blob: Blob) => 'blob:x');
    const revokeURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: createURL, revokeObjectURL: revokeURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    exportObraJson('mi-obra.json');

    expect(createURL).toHaveBeenCalledTimes(1);
    expect(createURL.mock.calls[0]![0]).toBeInstanceOf(Blob);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeURL).toHaveBeenCalledTimes(1);

    click.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe('readFileText', () => {
  it('lee un File como texto', async () => {
    const file = new File(['{"a":1}'], 'x.json', { type: 'application/json' });
    expect(await readFileText(file)).toBe('{"a":1}');
  });
});

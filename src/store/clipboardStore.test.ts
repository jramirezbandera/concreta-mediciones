import { beforeEach, describe, expect, it } from 'vitest';
import { useClipboardStore } from './clipboardStore';
import { useObraStore, blankObraData } from './obraStore';
import type { RefCopyItem } from '../core/refdata';

const item = (code: string): RefCopyItem => ({
  sourceName: 'Obra A',
  partida: { id: 'p1', pos: '1.1', code, title: 'X', ud: 'm²', precio: 10, items: [] },
});

beforeEach(() => {
  useClipboardStore.getState().clear();
  useObraStore.getState().reset();
});

describe('clipboardStore', () => {
  it('setClip guarda items + origen; clear lo vacía', () => {
    useClipboardStore.getState().setClip([item('A1')], 'Obra A');
    expect(useClipboardStore.getState().items).toHaveLength(1);
    expect(useClipboardStore.getState().sourceObraName).toBe('Obra A');
    useClipboardStore.getState().clear();
    expect(useClipboardStore.getState().items).toBeNull();
    expect(useClipboardStore.getState().sourceObraName).toBe('');
  });

  it('copyTick sube en CADA copia (dispara el aviso aunque se recopie lo mismo)', () => {
    const t0 = useClipboardStore.getState().copyTick;
    useClipboardStore.getState().setClip([item('A1')], 'Obra A');
    useClipboardStore.getState().setClip([item('A1')], 'Obra A'); // misma partida otra vez
    expect(useClipboardStore.getState().copyTick).toBe(t0 + 2);
  });

  it('SOBREVIVE un cambio de obra (loadObra resetea obraStore pero NO el portapapeles)', () => {
    useClipboardStore.getState().setClip([item('A1')], 'Obra A');
    // Conmutar de obra = loadObra: borra el estado de UI de obraStore.
    useObraStore.getState().loadObra(blankObraData('Obra B'));
    // El portapapeles, al vivir fuera, sigue intacto: por eso se puede pegar en B.
    expect(useClipboardStore.getState().items).toHaveLength(1);
    expect(useClipboardStore.getState().items?.[0]?.partida.code).toBe('A1');
  });
});

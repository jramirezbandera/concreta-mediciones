import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetAiSettingsForTests,
  resolveActiveKey,
  selectActiveKey,
  useAiSettings,
} from './settingsStore';

const STORAGE_KEY = 'concreta.ai.settings';

beforeEach(() => {
  __resetAiSettingsForTests();
});

describe('resolveActiveKey (precedencia BYOK > compartida)', () => {
  it('la key propia SIEMPRE gana, aunque haya compartida', () => {
    const r = resolveActiveKey('gemini', { gemini: 'MINE' }, 'SHARED');
    expect(r.activeKey).toBe('MINE');
    expect(r.usingSharedKey).toBe(false);
  });

  it('sin key propia, cae a la compartida', () => {
    const r = resolveActiveKey('gemini', {}, 'SHARED');
    expect(r.activeKey).toBe('SHARED');
    expect(r.usingSharedKey).toBe(true);
  });

  it('sin propia y sin compartida → null, no usa compartida', () => {
    const r = resolveActiveKey('gemini', {}, null);
    expect(r.activeKey).toBeNull();
    expect(r.usingSharedKey).toBe(false);
  });

  it('una key propia en blanco cuenta como ausente y cae a la compartida', () => {
    const r = resolveActiveKey('gemini', { gemini: '   ' }, 'SHARED');
    expect(r.activeKey).toBe('SHARED');
    expect(r.usingSharedKey).toBe(true);
  });

  it('la compartida es por-proveedor: openai no la hereda de gemini', () => {
    // sharedKeyFor solo devuelve algo para gemini; aquí se pasa null explícito.
    const r = resolveActiveKey('openai', {}, null);
    expect(r.activeKey).toBeNull();
  });
});

describe('useAiSettings (store + persistencia)', () => {
  it('setKey guarda, recorta y persiste en localStorage', () => {
    useAiSettings.getState().setKey('gemini', '  MYKEY  ');
    expect(useAiSettings.getState().keys.gemini).toBe('MYKEY');
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).keys.gemini).toBe('MYKEY');
  });

  it('setKey con cadena vacía borra la key (equivale a clearKey)', () => {
    useAiSettings.getState().setKey('gemini', 'MYKEY');
    useAiSettings.getState().setKey('gemini', '   ');
    expect(useAiSettings.getState().keys.gemini).toBeUndefined();
  });

  it('clearKey elimina solo la del proveedor indicado', () => {
    useAiSettings.getState().setKey('gemini', 'G');
    useAiSettings.getState().setKey('openai', 'O');
    useAiSettings.getState().clearKey('gemini');
    expect(useAiSettings.getState().keys.gemini).toBeUndefined();
    expect(useAiSettings.getState().keys.openai).toBe('O');
  });

  it('setProvider cambia el proveedor activo y lo persiste', () => {
    useAiSettings.getState().setProvider('openai');
    expect(useAiSettings.getState().provider).toBe('openai');
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(JSON.parse(raw as string).provider).toBe('openai');
  });

  it('el default es gemini y sin key propia la activa es null en tests (sin compartida)', () => {
    // En tests no se define VITE_AI_SHARED_GEMINI_KEY → sharedKeyFor devuelve null.
    expect(useAiSettings.getState().provider).toBe('gemini');
    expect(selectActiveKey().activeKey).toBeNull();
  });

  it('selectActiveKey refleja la key propia del proveedor activo', () => {
    useAiSettings.getState().setKey('gemini', 'MINE');
    const r = selectActiveKey();
    expect(r.activeKey).toBe('MINE');
    expect(r.usingSharedKey).toBe(false);
  });

  it('sincroniza entre pestañas al recibir un evento storage', () => {
    const payload = JSON.stringify({ provider: 'openai', keys: { openai: 'FROM_OTHER_TAB' } });
    window.localStorage.setItem(STORAGE_KEY, payload);
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: payload }));
    expect(useAiSettings.getState().provider).toBe('openai');
    expect(useAiSettings.getState().keys.openai).toBe('FROM_OTHER_TAB');
  });
});

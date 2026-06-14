import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useClipboardHotkeys, usePartidaClipboard } from './usePartidaClipboard';
import { ALL, useObraStore } from '../store';
import { useClipboardStore } from '../store/clipboardStore';

beforeEach(() => {
  useObraStore.getState().reset();
  useClipboardStore.getState().clear();
});

describe('usePartidaClipboard', () => {
  it('copy guarda un snapshot de la partida en el portapapeles', () => {
    const p = useObraStore.getState().partidas['01']![0]!;
    const { result } = renderHook(() => usePartidaClipboard());
    expect(result.current.hasClip).toBe(false);
    act(() => result.current.copy(p));
    expect(useClipboardStore.getState().items?.[0]?.partida.code).toBe(p.code);
  });

  it('paste vuelca la copia en el destino dado como partida LIMPIA (sin BASE) e id nuevo', () => {
    const p = useObraStore.getState().partidas['01']![0]!;
    const { result } = renderHook(() => usePartidaClipboard());
    act(() => result.current.copy(p));
    const before = useObraStore.getState().partidas['02']?.length ?? 0;
    act(() => result.current.paste({ chId: '02', subId: null }));
    const list = useObraStore.getState().partidas['02']!;
    expect(list.length).toBe(before + 1);
    const nueva = list.at(-1)!;
    expect(nueva.code).toBe(p.code);
    expect(nueva.fromBase).toBeUndefined(); // portapapeles → sin chip BASE
    expect(nueva.baseSource).toBeUndefined();
    expect(nueva.id).not.toBe(p.id); // id nuevo → no contamina certs del destino
  });

  it('paste no hace nada si el portapapeles está vacío', () => {
    const { result } = renderHook(() => usePartidaClipboard());
    const before = useObraStore.getState().partidas['01']!.length;
    act(() => result.current.paste({ chId: '01', subId: null }));
    expect(useObraStore.getState().partidas['01']!.length).toBe(before);
  });
});

const press = (key: string) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true }));
  });

describe('useClipboardHotkeys', () => {
  it('Ctrl+C copia la partida seleccionada; Ctrl+V pega en el capítulo activo', () => {
    renderHook(() => useClipboardHotkeys());
    const p = useObraStore.getState().partidas['01']![0]!;
    act(() => useObraStore.getState().togglePartida(p.id));
    press('c');
    expect(useClipboardStore.getState().items?.[0]?.partida.code).toBe(p.code);
    const before = useObraStore.getState().partidas['01']!.length;
    press('v'); // activo por defecto = '01'
    expect(useObraStore.getState().partidas['01']!.length).toBe(before + 1);
  });

  it('ignora Ctrl+C cuando el foco está en un input (portapapeles del navegador)', () => {
    renderHook(() => useClipboardHotkeys());
    const p = useObraStore.getState().partidas['01']![0]!;
    act(() => useObraStore.getState().togglePartida(p.id));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    press('c');
    expect(useClipboardStore.getState().items).toBeNull();
    input.remove();
  });

  it('Ctrl+V es no-op en la vista "todos los capítulos" (active=ALL)', () => {
    renderHook(() => useClipboardHotkeys());
    const p = useObraStore.getState().partidas['01']![0]!;
    act(() => useObraStore.getState().togglePartida(p.id));
    press('c');
    act(() => useObraStore.getState().setActive(ALL));
    const before = useObraStore.getState().partidas['01']!.length;
    press('v');
    expect(useObraStore.getState().partidas['01']!.length).toBe(before);
  });
});

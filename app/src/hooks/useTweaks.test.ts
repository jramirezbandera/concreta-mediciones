import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTweaks } from './useTweaks';

const KEY = 'concreta.test-tweaks';

beforeEach(() => localStorage.clear());

describe('useTweaks', () => {
  it('usa los defaults cuando no hay nada persistido', () => {
    const { result } = renderHook(() => useTweaks(KEY, { dotGrid: false, density: 'regular' }));
    expect(result.current[0]).toEqual({ dotGrid: false, density: 'regular' });
  });

  it('setTweak(clave, valor) actualiza y persiste', () => {
    const { result } = renderHook(() => useTweaks(KEY, { dotGrid: false }));
    act(() => result.current[1]('dotGrid', true));
    expect(result.current[0].dotGrid).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ dotGrid: true });
  });

  it('setTweak(objeto) fusiona varias claves', () => {
    const { result } = renderHook(() =>
      useTweaks(KEY, { dotGrid: false, density: 'regular' as string }),
    );
    act(() => result.current[1]({ dotGrid: true, density: 'compact' }));
    expect(result.current[0]).toEqual({ dotGrid: true, density: 'compact' });
  });

  it('rehidrata desde localStorage fusionando con los defaults', () => {
    localStorage.setItem(KEY, JSON.stringify({ dotGrid: true }));
    const { result } = renderHook(() => useTweaks(KEY, { dotGrid: false, density: 'regular' }));
    expect(result.current[0]).toEqual({ dotGrid: true, density: 'regular' });
  });
});

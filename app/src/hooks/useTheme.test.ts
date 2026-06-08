import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTheme } from './useTheme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.removeProperty('--accent');
});

describe('useTheme', () => {
  it('arranca en oscuro y lo aplica a <html>', () => {
    renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggleTheme alterna y persiste', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('concreta.theme')).toBe('light');
  });

  it('respeta el tema persistido al iniciar', () => {
    localStorage.setItem('concreta.theme', 'light');
    document.documentElement.removeAttribute('data-theme');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('setAccent aplica y persiste la variable --accent', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setAccent('#0d9488'));
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#0d9488');
    expect(localStorage.getItem('concreta.accent')).toBe('#0d9488');
  });

  it('setAccent(null) elimina el override', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setAccent('#0d9488'));
    act(() => result.current.setAccent(null));
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('');
    expect(localStorage.getItem('concreta.accent')).toBeNull();
  });
});

/* Portapapeles del SISTEMA simulado para jsdom (que no lo trae): reproduce lo
   que hace el navegador tras Ctrl+C/X/V — un evento `copy`/`cut`/`paste` con su
   `clipboardData` — y un `navigator.clipboard.writeText` opcional. */
import { fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

export interface FakeSystemClipboard {
  /** Tipos → datos, como los guardaría el sistema. */
  data: Map<string, string>;
  /** El navegador dispara `copy` tras Ctrl+C (o un `execCommand('copy')`). */
  copy: (el: Element | Document) => void;
  cut: (el: Element | Document) => void;
  /** El navegador dispara `paste` tras Ctrl+V con lo que haya en el sistema. */
  paste: (el: Element | Document) => void;
  /** Otra aplicación (Excel) deja texto en el sistema. */
  setText: (text: string) => void;
  /** `navigator.clipboard.writeText` (respaldo cuando no llega el evento). */
  writeText: ReturnType<typeof vi.fn>;
}

function transfer(data: Map<string, string>) {
  return {
    setData: (type: string, value: string) => void data.set(type, value),
    getData: (type: string) => data.get(type) ?? '',
    get types() {
      return [...data.keys()];
    },
  };
}

/**
 * Crea el portapapeles simulado. `writeText`: `'ok'` (https/localhost),
 * `'reject'` (sin permiso) o `'none'` (http: no existe).
 */
export function fakeSystemClipboard(writeText: 'ok' | 'reject' | 'none' = 'ok'): FakeSystemClipboard {
  const data = new Map<string, string>();
  const write = vi.fn(async (text: string) => {
    if (writeText === 'reject') throw new Error('NotAllowedError');
    data.clear();
    data.set('text/plain', text);
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText === 'none' ? undefined : { writeText: write },
  });
  const copyLike = (type: 'copy' | 'cut') => (el: Element | Document) => {
    // Un copy nuevo reemplaza lo que hubiera: el manejador escribe con setData.
    const next = new Map<string, string>();
    fireEvent[type](el, { clipboardData: transfer(next) });
    if (next.size) {
      data.clear();
      for (const [k, v] of next) data.set(k, v);
    }
  };
  return {
    data,
    copy: copyLike('copy'),
    cut: copyLike('cut'),
    paste: (el) => void fireEvent.paste(el, { clipboardData: transfer(data) }),
    setText: (text) => {
      data.clear();
      data.set('text/plain', text);
    },
    writeText: write,
  };
}

/** Deshace el `navigator.clipboard` simulado. */
export function restoreSystemClipboard(): void {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
}

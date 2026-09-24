import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Bc3Dropzone } from '../features/importar/importShared';
import { AyudaCenter } from '../layout/AyudaCenter';
import { isTouchOnly } from './touchOnly';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** matchMedia que responde «solo táctil» a la consulta de puntero (jsdom no lo trae). */
function stubTouch(touch: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('pointer: coarse') ? touch : false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('isTouchOnly — textos de teclado/arrastre fuera del táctil', () => {
  it('sin matchMedia (jsdom) es false: se quedan los textos de escritorio', () => {
    expect(isTouchOnly()).toBe(false);
  });

  it('sigue a la consulta (hover: none) and (pointer: coarse)', () => {
    stubTouch(true);
    expect(isTouchOnly()).toBe(true);
    stubTouch(false);
    expect(isTouchOnly()).toBe(false);
  });

  it('la zona de importación no pide «soltar» ni «hacer clic» en táctil', () => {
    stubTouch(true);
    render(<Bc3Dropzone busy={false} onFile={() => {}} />);
    expect(screen.getByText('Elige un archivo .bc3')).toBeInTheDocument();
    expect(screen.getByText('Toca para buscarlo en el dispositivo')).toBeInTheDocument();
    expect(screen.queryByText(/Suelta/)).toBeNull();
  });

  it('con ratón la zona de importación mantiene «Suelta el .bc3 aquí»', () => {
    stubTouch(false);
    render(<Bc3Dropzone busy={false} onFile={() => {}} />);
    expect(screen.getByText('Suelta el .bc3 aquí')).toBeInTheDocument();
  });

  it('la ayuda en móvil táctil omite la chuleta de atajos', () => {
    stubTouch(true);
    render(<AyudaCenter open compact onClose={() => {}} onNavigate={() => {}} />);
    expect(screen.queryByText('Atajos')).toBeNull();
    expect(screen.getByText('Funcionalidades')).toBeInTheDocument();
  });
});

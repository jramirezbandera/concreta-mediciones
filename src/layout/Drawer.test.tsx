import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Drawer } from './Drawer';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** matchMedia con preferencia de movimiento configurable (jsdom no lo trae). */
function stubMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion') ? reduce : false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('Drawer (F8.1 — cierre animado + reduced-motion)', () => {
  it('abierto renderiza overlay + panel; clic en el overlay cierra', () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose}>
        <span>contenido</span>
      </Drawer>,
    );
    expect(screen.getByText('contenido')).toBeInTheDocument();
    fireEvent.click(document.querySelector('.drawer-overlay')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('Esc cierra', () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose}>
        x
      </Drawer>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('sin matchMedia (o con reduced-motion) el cierre desmonta AL INSTANTE', () => {
    // jsdom no implementa matchMedia → reducedMotion() es true: sin animación.
    const { rerender } = render(
      <Drawer open onClose={() => {}}>
        x
      </Drawer>,
    );
    rerender(
      <Drawer open={false} onClose={() => {}}>
        x
      </Drawer>,
    );
    expect(document.querySelector('.drawer-panel')).toBeNull();
  });

  it('con movimiento permitido, el cierre mantiene el panel con `.closing` hasta animationend', () => {
    stubMotion(false);
    const { rerender } = render(
      <Drawer open onClose={() => {}}>
        x
      </Drawer>,
    );
    rerender(
      <Drawer open={false} onClose={() => {}}>
        x
      </Drawer>,
    );
    const panel = document.querySelector('.drawer-panel')!;
    expect(panel.classList.contains('closing')).toBe(true);
    fireEvent.animationEnd(panel);
    expect(document.querySelector('.drawer-panel')).toBeNull();
  });

  it('reabrir durante el cierre cancela la salida (el panel se queda)', () => {
    stubMotion(false);
    const { rerender } = render(
      <Drawer open onClose={() => {}}>
        x
      </Drawer>,
    );
    rerender(
      <Drawer open={false} onClose={() => {}}>
        x
      </Drawer>,
    );
    rerender(
      <Drawer open onClose={() => {}}>
        x
      </Drawer>,
    );
    const panel = document.querySelector('.drawer-panel')!;
    expect(panel.classList.contains('closing')).toBe(false);
  });
});

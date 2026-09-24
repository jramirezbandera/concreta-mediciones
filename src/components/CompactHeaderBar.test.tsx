import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompactHeaderBar } from './CompactHeaderBar';

/** IntersectionObserver controlable (jsdom no lo trae): guarda el último callback. */
let fire: (isIntersecting: boolean) => void = () => {};
let observed: Element | null = null;
function stubIO() {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        fire = (isIntersecting) => cb([{ isIntersecting }]);
      }
      observe(el: Element) {
        observed = el;
      }
      disconnect() {}
    },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  observed = null;
});

function renderInScroller() {
  render(
    <div data-testid="scroller" style={{ overflowY: 'auto' }}>
      <header data-testid="big">Cabecera grande</header>
      <CompactHeaderBar title="1 DEMOLICIONES" value="657,00 €" />
      <p>contenido</p>
    </div>,
  );
  // Oculta (visibility:hidden) su nombre accesible calculado es '' (accname 2A):
  // se busca por el atributo aria-label.
  return screen.getByLabelText('Volver arriba');
}

describe('CompactHeaderBar — cabecera de una línea al hacer scroll (móvil)', () => {
  it('observa la cabecera grande (su hermano anterior) y arranca oculta', () => {
    stubIO();
    const bar = renderInScroller();
    expect(observed).toBe(screen.getByTestId('big'));
    expect(bar).toHaveAttribute('aria-hidden', 'true');
    expect(bar).toHaveAttribute('tabindex', '-1');
  });

  it('aparece cuando la cabecera sale por arriba y se va al volver', () => {
    stubIO();
    const bar = renderInScroller();
    act(() => fire(false));
    expect(bar).toHaveAttribute('aria-hidden', 'false');
    expect(bar).toHaveTextContent('1 DEMOLICIONES');
    expect(bar).toHaveTextContent('657,00 €');
    act(() => fire(true));
    expect(bar).toHaveAttribute('aria-hidden', 'true');
  });

  it('tocarla vuelve arriba del contenedor con scroll', () => {
    stubIO();
    const bar = renderInScroller();
    const scroller = screen.getByTestId('scroller');
    scroller.scrollTo = vi.fn();
    act(() => fire(false));
    fireEvent.click(bar);
    expect(scroller.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });

  it('sin IntersectionObserver no rompe: se queda oculta', () => {
    const bar = renderInScroller();
    expect(bar).toHaveAttribute('aria-hidden', 'true');
  });
});

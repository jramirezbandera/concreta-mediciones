import { useEffect, useState, type RefObject } from 'react';

/**
 * Ancho (px) de un elemento, reactivo vía `ResizeObserver`. Lo usa el presupuesto
 * para decidir tabla vs. tarjetas por ANCHO ÚTIL del área principal (no por el
 * viewport): con la sidebar fija, el contenido puede ser estrecho aunque la
 * ventana sea ancha (prototipo: `budgetCompact = bp.isMobile || mainW < 780`).
 * Devuelve 0 hasta la primera medición (usar un fallback mientras tanto).
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setWidth(cr.width);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

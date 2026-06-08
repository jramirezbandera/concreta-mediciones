import { useEffect, useState } from 'react';

export interface Breakpoint {
  /** Ancho actual de la ventana en px. */
  w: number;
  /** < 760: tarjetas, barra inferior, drawer. */
  isMobile: boolean;
  /** 760–1023: tablet (sidebar en drawer). */
  isTablet: boolean;
  /** ≥ 1024: sidebar fija. */
  isDesktop: boolean;
  /** < 1024: chrome compacto (móvil o tablet). */
  isCompact: boolean;
}

function read(): Breakpoint {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
  return {
    w,
    isMobile: w < 760,
    isTablet: w >= 760 && w < 1024,
    isDesktop: w >= 1024,
    isCompact: w < 1024,
  };
}

/**
 * Breakpoint reactivo (coalescido por requestAnimationFrame), portado del
 * prototipo. Fuente única de los umbrales responsive del chrome.
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(read);

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setBp(read()));
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return bp;
}

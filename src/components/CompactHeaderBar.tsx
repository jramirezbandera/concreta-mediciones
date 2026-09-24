import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './CompactHeaderBar.module.css';

/** Alto de la barra (px). Coincide con `.bar` en el CSS. */
const BAR_H = 40;

/** Contenedor con scroll más cercano (la raíz del IntersectionObserver). */
function scrollParent(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement;
  while (p && !/(auto|scroll)/.test(getComputedStyle(p).overflowY)) p = p.parentElement;
  return p;
}

/**
 * Barra de una línea (título + importe) que aparece pegada arriba cuando la
 * cabecera grande de la vista sale por arriba al hacer scroll, y se va al volver.
 * Pensada para móvil: las cabeceras fijas se comían ~30% de la pantalla (la de
 * Certificaciones, ~200px) y la del capítulo, al no ser fija, se perdía del todo.
 *
 * Mide 0px en el flujo (ancla `sticky` de altura 0 y la barra superpuesta): nunca
 * empuja el contenido, así que aparecer/desaparecer no provoca saltos de scroll.
 * Observa a su hermano ANTERIOR (la cabecera grande), así que se coloca justo
 * detrás de ella, como hija directa del contenedor con scroll. Tocarla vuelve
 * arriba (convención de la barra de título en iOS).
 *
 * `watch`: cambia cuando la cabecera se sustituye (otro capítulo, otra vista),
 * para volver a observar el nodo nuevo.
 */
export function CompactHeaderBar({
  title,
  sub,
  value,
  watch,
}: {
  title: ReactNode;
  /** Dato secundario tras el título (p.ej. «A origen»). */
  sub?: ReactNode;
  /** Cifra a la derecha (importe ya formateado). */
  value: ReactNode;
  watch?: unknown;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const header = anchorRef.current?.previousElementSibling;
    if (!(header instanceof HTMLElement) || typeof IntersectionObserver === 'undefined') return;
    // Se muestra cuando la cabecera ya no asoma bajo la franja que ocupa la barra.
    const io = new IntersectionObserver(([e]) => setShown(!!e && !e.isIntersecting), {
      root: scrollParent(header),
      rootMargin: `-${BAR_H}px 0px 0px 0px`,
    });
    io.observe(header);
    return () => io.disconnect();
  }, [watch]);

  const toTop = () => {
    const root = anchorRef.current && scrollParent(anchorRef.current);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    root?.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div ref={anchorRef} className={`no-print ${styles.anchor}`}>
      <button
        type="button"
        className={`${styles.bar} ${shown ? styles.shown : ''}`}
        onClick={toTop}
        tabIndex={shown ? 0 : -1}
        aria-hidden={!shown}
        aria-label="Volver arriba"
      >
        <span className={styles.title}>{title}</span>
        {sub != null && <span className={styles.sub}>{sub}</span>}
        <span className={`mono ${styles.value}`}>{value}</span>
      </button>
    </div>
  );
}

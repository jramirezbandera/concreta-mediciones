import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';
import styles from './InfoTip.module.css';

/** Margen mínimo entre la burbuja y el borde de la pantalla / del área con scroll. */
const EDGE = 8;

/**
 * Ayuda contextual de un concepto económico (PEM, CI, GG, BI, IVA…): un ⓘ
 * discreto que al hover —o al foco por teclado, o al TOCARLO— explica QUÉ es y
 * sobre qué se calcula. La hoja Resumen encadena cinco porcentajes que el usuario
 * edita a mano; sin esto hay que saberse el RGLCAP de memoria para no confundir
 * los costes indirectos (de la obra, dentro del PEM) con los gastos generales (de
 * la empresa, sobre el PEM).
 *
 * En táctil no hay hover ni foco visible: el toque alterna la burbuja (fija) y un
 * toque fuera, Esc o hacer scroll la cierran. Antes el clic se cancelaba y en el
 * móvil el ⓘ no hacía nada. Al mostrarse, la burbuja se desplaza para no salirse
 * por los lados y se abre hacia abajo si arriba no cabe.
 *
 * `title` nativo aparte de la burbuja, para quien la burbuja no le llegue.
 * `align="end"` ancla a la derecha cuando el icono va pegado al borde del papel.
 *
 * El `term` NO se repite dentro de la burbuja: sale justo al lado de su etiqueta,
 * y duplicarlo metía un segundo nodo con ese texto en el DOM (una consulta por
 * texto de la etiqueta encontraba dos).
 */
export function InfoTip({
  term,
  children,
  align = 'center',
}: {
  /** Nombre del concepto (encabeza la burbuja). */
  term: string;
  /** La explicación. */
  children: string;
  align?: 'center' | 'end';
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);

  // Coloca la burbuja dentro de lo visible. Se mide aunque esté oculta
  // (visibility:hidden conserva la caja), así que vale antes del hover/foco/toque.
  const place = () => {
    const b = bubbleRef.current;
    const btn = btnRef.current;
    if (!b || !btn) return;
    b.style.setProperty('--tip-dx', '0px');
    delete b.dataset.below;
    const r = b.getBoundingClientRect();
    const maxRight = window.innerWidth - EDGE;
    const dx = r.left < EDGE ? EDGE - r.left : r.right > maxRight ? maxRight - r.right : 0;
    b.style.setProperty('--tip-dx', `${Math.round(dx)}px`);
    // Techo = borde superior del contenedor con scroll (bajo el TopBar / cabeceras).
    let scroller = btn.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    const top = (scroller?.getBoundingClientRect().top ?? 0) + EDGE;
    if (r.top < top) b.dataset.below = '';
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!btnRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    document.addEventListener('scroll', onScroll, true); // captura: el scroll no burbujea
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return (
    <button
      ref={btnRef}
      type="button"
      className={`tap-target ${styles.wrap} ${align === 'end' ? styles.end : ''} ${open ? styles.open : ''}`}
      aria-label={`Qué es ${term}`}
      aria-describedby={id}
      title={`${term}: ${children}`}
      onPointerEnter={place}
      onFocus={place}
      onClick={(e) => {
        // Es ayuda, no una acción: nunca envía formularios; solo fija/suelta la burbuja.
        e.preventDefault();
        place();
        setOpen((o) => !o);
      }}
    >
      <Icon name="help" size={13} sw={1.6} />
      <span ref={bubbleRef} className={styles.bubble} id={id} role="tooltip">
        {children}
      </span>
    </button>
  );
}

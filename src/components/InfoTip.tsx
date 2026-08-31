import { useId } from 'react';
import { Icon } from './Icon';
import styles from './InfoTip.module.css';

/**
 * Ayuda contextual de un concepto económico (PEM, CI, GG, BI, IVA…): un ⓘ
 * discreto que al hover —o al foco por teclado— explica QUÉ es y sobre qué se
 * calcula. La hoja Resumen encadena cinco porcentajes que el usuario edita a
 * mano; sin esto hay que saberse el RGLCAP de memoria para no confundir los
 * costes indirectos (de la obra, dentro del PEM) con los gastos generales (de la
 * empresa, sobre el PEM).
 *
 * `title` nativo aparte de la burbuja: cubre el táctil (mantener pulsado) y a
 * quien la burbuja no le llegue. `align="end"` ancla a la derecha cuando el
 * icono va pegado al borde del papel y la burbuja centrada se saldría.
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
  return (
    <button
      type="button"
      className={`${styles.wrap} ${align === 'end' ? styles.end : ''}`}
      aria-label={`Qué es ${term}`}
      aria-describedby={id}
      title={`${term}: ${children}`}
      // Es ayuda, no una acción: el clic no debe hacer nada (ni enviar formularios).
      onClick={(e) => e.preventDefault()}
    >
      <Icon name="help" size={13} sw={1.6} />
      <span className={styles.bubble} id={id} role="tooltip">
        {children}
      </span>
    </button>
  );
}

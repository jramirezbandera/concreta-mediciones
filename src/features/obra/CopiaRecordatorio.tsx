import { Icon } from '../../components/Icon';
import { descargarCopia } from '../../persist';
import { useEstadoCopia } from './recordatorioCopia';
import styles from './CopiaRecordatorio.module.css';

export interface CopiaRecordatorioProps {
  /** `bar`: botón-icono de la barra superior (escritorio). `menu`: fila del menú
   *  «Más» (móvil y tablet), con el texto entero; la estiliza el hueco del menu. */
  variant: 'bar' | 'menu';
}

/**
 * Recordatorio de copia FUERA del modal de obra (Etapa 0): «Última copia
 * descargada: hace N días» con el botón que la descarga. Solo aparece cuando
 * hace falta (ver `mostrarRecordatorio`); con la copia vencida, lleva un punto
 * de aviso. La fecha la sella `descargarCopia`.
 */
export function CopiaRecordatorio({ variant }: CopiaRecordatorioProps) {
  const { visible, texto, vencida } = useEstadoCopia();
  if (!visible) return null;
  if (variant === 'menu')
    return (
      <button
        type="button"
        role="menuitem"
        onClick={() => descargarCopia()}
        className={`tcol ${styles.menuRow}`}
      >
        <Icon name="backup" size={16} />
        <span className={styles.menuText}>
          Descargar copia (.json)
          <span className={`${styles.menuSub} ${vencida ? styles.warn : ''}`}>{texto}</span>
        </span>
      </button>
    );
  const label = `${texto}. Descargar copia .json de la obra`;
  return (
    <button
      type="button"
      onClick={() => descargarCopia()}
      title={label}
      aria-label={label}
      className={`tcol icon-btn ${styles.bar} ${vencida ? styles.dot : ''}`}
    >
      <Icon name="backup" size={16} />
    </button>
  );
}

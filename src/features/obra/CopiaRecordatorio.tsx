import { Icon } from '../../components/Icon';
import { planoLegible } from '../../core/planoDatos';
import { descargarCopia, descargarCopiaZip } from '../../persist';
import { useObraStore, useToastStore } from '../../store';
import { textoCopiaHecha } from './copiaTextos';
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
 *
 * [A1] Con planos, la copia es la completa (.zip, §9.2). Si no cabe o falla,
 * descarga la .json y lo dice: los PDF se guardan desde «Datos de la obra».
 */
export function CopiaRecordatorio({ variant }: CopiaRecordatorioProps) {
  const { visible, texto, vencida } = useEstadoCopia();
  const conPlanos = useObraStore((s) => s.planos.some((p) => planoLegible(p) && !p.quitado));
  if (!visible) return null;
  const copiar = async () => {
    if (!conPlanos) return descargarCopia();
    const toast = useToastStore.getState();
    toast.show('Preparando la copia completa…');
    const r = await descargarCopiaZip();
    if (r.kind === 'ok') return toast.show(textoCopiaHecha(r));
    descargarCopia();
    toast.show(
      `${r.kind === 'no-cabe' ? r.motivo : 'No se pudo hacer la copia completa.'} Se ha descargado el presupuesto (.json); guarda los PDF desde «Datos de la obra».`,
    );
  };
  if (variant === 'menu')
    return (
      <button
        type="button"
        role="menuitem"
        onClick={() => void copiar()}
        className={`tcol ${styles.menuRow}`}
      >
        <Icon name="backup" size={16} />
        <span className={styles.menuText}>
          {conPlanos ? 'Descargar copia completa (.zip)' : 'Descargar copia (.json)'}
          <span className={`${styles.menuSub} ${vencida ? styles.warn : ''}`}>{texto}</span>
        </span>
      </button>
    );
  const label = `${texto}. ${conPlanos ? 'Descargar copia completa de la obra, con sus planos (.zip)' : 'Descargar copia .json de la obra'}`;
  return (
    <button
      type="button"
      onClick={() => void copiar()}
      title={label}
      aria-label={label}
      className={`tcol icon-btn ${styles.bar} ${vencida ? styles.dot : ''}`}
    >
      <Icon name="backup" size={16} />
    </button>
  );
}

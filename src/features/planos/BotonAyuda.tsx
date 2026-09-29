import { AYUDA_PLANOS, type AnclaAyuda } from '../../layout/ayudaContent';
import { abrirAyudaPlanos } from './textos';
import styles from './Planos.module.css';

/** «?» de los mensajes de calibración, «no encaja» y «PDF no idéntico» (§7.2):
 *  abre la ayuda de «Medir sobre planos» en su sección. */
export function BotonAyuda({ seccion }: { seccion: AnclaAyuda }) {
  const titulo = AYUDA_PLANOS.find((s) => s.id === seccion)?.titulo ?? 'Medir sobre planos';
  return (
    <button
      type="button"
      className={styles.ayuda}
      aria-label={`Ayuda: ${titulo}`}
      title={`Ayuda: ${titulo}`}
      onClick={() => abrirAyudaPlanos(seccion)}
    >
      ?
    </button>
  );
}

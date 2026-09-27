import { abrirAyudaPlanos } from './textos';
import styles from './Planos.module.css';

/** «?» de los mensajes de calibración, «no encaja» y «PDF no idéntico» (§7.2):
 *  abre la ayuda de «Medir sobre planos». */
export function BotonAyuda() {
  return (
    <button type="button" className={styles.ayuda} aria-label="Ayuda: medir sobre planos" title="Ayuda" onClick={abrirAyudaPlanos}>
      ?
    </button>
  );
}

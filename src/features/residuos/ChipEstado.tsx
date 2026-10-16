import type { EstadoResiduo } from '../../core/rcd';
import styles from './Residuos.module.css';

const TEXTO: Record<EstadoResiduo | 'sinAsignar', string> = {
  propuesta: 'Por revisar',
  confirmada: 'Confirmada',
  noGenera: 'No genera',
  gestion: 'Gestión',
  sinAsignar: 'Sin asignar',
};

/** Estado de la asignación de residuo de una partida. */
export function ChipEstado({ estado }: { estado: EstadoResiduo | null }) {
  const k = estado ?? 'sinAsignar';
  return <span className={`${styles.chip} ${styles[`chip_${k}`]}`}>{TEXTO[k]}</span>;
}

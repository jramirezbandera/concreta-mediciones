import type { EstadoResiduo } from '../../core/rcd';
import styles from './Residuos.module.css';

/** Estado que se ve: el de la asignación, o «revisar» si la partida cambió tras confirmarla (TD1). */
export type EstadoVisibleRcd = EstadoResiduo | 'revisar';

const TEXTO: Record<EstadoVisibleRcd | 'sinAsignar', string> = {
  propuesta: 'Por revisar',
  revisar: 'Ha cambiado',
  confirmada: 'Confirmada',
  noGenera: 'No genera',
  gestion: 'Gestión',
  sinAsignar: 'Sin asignar',
};

/** Estado de la asignación de residuo de una partida. */
export function ChipEstado({ estado }: { estado: EstadoVisibleRcd | null }) {
  const k = estado ?? 'sinAsignar';
  return <span className={`${styles.chip} ${styles[`chip_${k === 'revisar' ? 'propuesta' : k}`]}`}>{TEXTO[k]}</span>;
}

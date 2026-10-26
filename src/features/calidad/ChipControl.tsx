import type { EstadoChipPcc } from './PccChip';
import r from '../residuos/Residuos.module.css';
import styles from './Calidad.module.css';

const TEXTO: Record<EstadoChipPcc | 'sinAsignar', string> = {
  propuesta: 'Por revisar',
  revisar: 'Ha cambiado',
  confirmada: 'Confirmada',
  sinControl: 'Sin control',
  capituloControl: 'Capítulo de control',
  sinAsignar: 'Sin asignar',
};

const CLASE: Record<EstadoChipPcc | 'sinAsignar', string> = {
  propuesta: r.chip_propuesta!,
  revisar: r.chip_propuesta!,
  confirmada: r.chip_confirmada!,
  sinControl: r.chip_noGenera!,
  capituloControl: styles.chipCapitulo!,
  sinAsignar: r.chip_sinAsignar!,
};

/** Estado del control de una partida («Ha cambiado»: confirmada y editada después, O6). */
export function ChipControl({ estado }: { estado: EstadoChipPcc | null }) {
  const k = estado ?? 'sinAsignar';
  return <span className={`${r.chip} ${CLASE[k]}`}>{TEXTO[k]}</span>;
}

import { useContext } from 'react';
import type { Cents } from '../../core/money';
import { WeightContext } from './weightContext';
import styles from './Presupuesto.module.css';

/**
 * Barra de peso de una partida. Lee el denominador del contexto (su PROPIA
 * dependencia), no de las props de la fila: editar otra partida del capítulo
 * re-renderiza estas barras pero no el cuerpo de cada `PartidaRow` (memoizado).
 */
export function WeightBar({ importe }: { importe: Cents }) {
  const total = useContext(WeightContext);
  const pct = total > 0 ? (importe / total) * 100 : 0;
  return (
    <div className={styles.weightTrack}>
      <div className={styles.weightFill} style={{ width: `${Math.max(3, pct)}%` }} />
    </div>
  );
}

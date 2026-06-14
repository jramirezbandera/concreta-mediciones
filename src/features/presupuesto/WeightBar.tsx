import { createContext, useContext } from 'react';
import type { Cents } from '../../core/money';
import styles from './Presupuesto.module.css';

/**
 * Denominador del peso % de una fila (total del CAPÍTULO o del SUB aislado). Se
 * provee al nivel de la tabla (`PartidasTable`) y lo consume `WeightBar`. Así, al
 * cambiar el total NO se re-renderiza la fila memoizada entera (T1.1): el contexto
 * atraviesa `React.memo` y re-renderiza SOLO las barras (baratas).
 */
export const WeightContext = createContext<Cents>(0);

/**
 * Barra de peso de una partida. Lee el denominador del contexto (su PROPIA
 * dependencia), no de las props de la fila: editar otra partida del capítulo
 * re-renderiza estas barras pero no el cuerpo de cada `PartidaRow`.
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

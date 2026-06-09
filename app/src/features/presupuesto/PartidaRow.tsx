import { Badge, ContraChip } from '../../components';
import { fmtNum, toEur, type Cents } from '../../core/money';
import type { Partida } from '../../core/types';
import { usePartidaRow } from '../../hooks/usePartidaRow';
import styles from './Presupuesto.module.css';

/** Chip "BASE": partida copiada de una base de precios hasta que se edita (F2.2). */
function BaseChip({ source }: { source?: string }) {
  return (
    <span className={styles.baseChip} title={`Copiada de ${source || 'una base'} · edítala para confirmarla`}>
      BASE
    </span>
  );
}

/**
 * Fila de partida a nivel resumen (F2.1, SÓLO LECTURA): Nº·Código, descripción
 * (badge + título + chips), Ud, Cantidad, Precio, Importe (+barra de peso).
 * Los derivados salen de `usePartidaRow` (T6); la edición y el detalle llegan
 * en F2.2. La columna ⋮ es un hueco hasta el menú de acciones (F2.4).
 */
export function PartidaRow({ p, chapterTotal }: { p: Partida; chapterTotal: Cents }) {
  const { cantidad, importe, pct } = usePartidaRow(p, chapterTotal);
  return (
    <tr className={`tcol ${styles.row}`}>
      <td className={styles.cNum}>
        <div className={`${styles.numInner}`}>
          <div className={`mono ${styles.pos}`}>{p.pos}</div>
          <div className={`mono ${styles.code}`}>{p.code}</div>
        </div>
      </td>
      <td className={styles.cDesc}>
        <div className={styles.descInner}>
          {p.mainType && <Badge type={p.mainType} />}
          <span className={styles.title}>{p.title}</span>
          {p.fromBase && <BaseChip source={p.baseSource} />}
          {p.contradictorio && <ContraChip />}
        </div>
      </td>
      <td className={`mono ${styles.cUd}`}>{p.ud}</td>
      <td className={`mono ${styles.cQty}`}>
        <span className={styles.qtyNum}>{fmtNum(cantidad)}</span>
      </td>
      <td className={`mono ${styles.cPrice}`}>{fmtNum(p.precio, 2)}</td>
      <td className={styles.cImporte}>
        <div className={`mono ${styles.importeNum}`}>{fmtNum(toEur(importe))}</div>
        <div className={styles.weightTrack}>
          <div className={styles.weightFill} style={{ width: `${Math.max(3, pct)}%` }} />
        </div>
      </td>
      <td className={styles.cMenu} />
    </tr>
  );
}

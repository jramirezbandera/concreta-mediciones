import { Icon } from '../components/Icon';
import { fmtCents, type Cents } from '../core/money';
import styles from './MobileSummaryBar.module.css';

export interface MobileSummaryBarProps {
  /** PEM y Total (con IVA) en céntimos enteros, mismos valores que los selectores. */
  pem: Cents;
  total: Cents;
  /** Abre el drawer (donde viven la tarjeta Resumen y el coeficiente K / Ajusta). */
  onOpen: () => void;
}

/**
 * Franja de resumen en móvil (encima del BottomTabBar): mantiene SIEMPRE visible
 * el número más importante de la app —PEM y Total—, que en móvil desaparecía al
 * sustituir la StatusBar por la barra de pestañas. Al tocarla abre el drawer,
 * donde está la tarjeta Resumen completa con el coeficiente K y "Ajusta".
 */
export function MobileSummaryBar({ pem, total, onOpen }: MobileSummaryBarProps) {
  return (
    <button
      type="button"
      className={`mono no-print ${styles.bar}`}
      onClick={onOpen}
      aria-label="Ver el resumen del presupuesto y ajustar el coeficiente K"
    >
      <span className={styles.item}>
        <span className={`caps ${styles.label}`}>PEM</span>
        {fmtCents(pem)}
      </span>
      <span className={styles.sep}>·</span>
      <span className={styles.item}>
        <span className={`caps ${styles.label}`}>Total</span>
        <span className={styles.total}>{fmtCents(total)}</span>
      </span>
      <Icon name="chevron" size={13} className={styles.chev} />
    </button>
  );
}

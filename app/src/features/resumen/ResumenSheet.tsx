import { EditableNum, IvaSelect } from '../../components';
import type { ResumenListado } from '../../core/listado';
import { fmtCents, fmtNum } from '../../core/money';
import type { Rates } from '../../core/types';
import styles from './Resumen.module.css';

/** % con 1 decimal → fracción a 3 decimales (13,5% → 0,135). Corrección
 *  consciente del prototipo, que hacía round2 y perdía el medio punto. */
function pctToRate(v: number): number {
  return Math.round(Math.max(0, v) * 10) / 1000;
}

/** Fila de porcentaje (GG/BI): % editable (o estático en solo-lectura) + importe. */
function PctRow({
  label,
  rate,
  value,
  color,
  readOnly,
  onRate,
}: {
  label: string;
  rate: number;
  value: number; // céntimos
  color: string;
  readOnly?: boolean;
  onRate?: (rate: number) => void;
}) {
  return (
    <div className={styles.pctRow}>
      <span className={styles.pctLeft}>
        <span className={styles.swatch} style={{ background: color }} />
        <span className={styles.pctLabel}>{label}</span>
      </span>
      {readOnly ? (
        <span className={`mono ${styles.pctStatic}`}>{fmtNum(rate * 100, 1)} %</span>
      ) : (
        <span className={styles.pctEdit}>
          <span className={styles.pctEditNum}>
            <EditableNum
              value={rate * 100}
              dec={1}
              accent
              ariaLabel={label}
              onCommit={(v) => onRate?.(pctToRate(v))}
            />
          </span>
          <span className={`mono ${styles.pctUnit}`}>%</span>
        </span>
      )}
      <span className={`mono ${styles.pctVal}`}>{fmtCents(value)}</span>
    </div>
  );
}

/**
 * Hoja resumen (F7.1): desglose por capítulos + PEM → GG → BI → PEC → IVA →
 * Presupuesto base de licitación. La COMPARTEN la vista Resumen (editable:
 * GG/BI inline + selector de IVA — único hogar de edición de GG/BI) y el doc
 * de impresión (`readOnly`, mismos números del mismo selector).
 */
export function ResumenSheet({
  data,
  readOnly,
  onRates,
}: {
  data: ResumenListado;
  readOnly?: boolean;
  /** Edición de tasas (gg/bi/iva); ignorado en solo-lectura. */
  onRates?: (patch: Partial<Rates>) => void;
}) {
  const { rows, pem, gg, bi, pec, iva, total, rates } = data;
  return (
    <div className={styles.sheet}>
      <div className="sec-head" style={{ marginBottom: 4 }}>
        Desglose por capítulos
      </div>
      <div>
        {rows.map((r) => (
          <div key={r.id} className={styles.chapRow}>
            <span className={`mono ${styles.chapCode}`}>{r.code}</span>
            <span className={styles.chapTitle}>{r.title}</span>
            <span className={styles.leader} />
            <span className={`mono ${styles.chapPct}`}>{fmtNum(r.pct, 1)}%</span>
            <span className={`mono ${styles.chapImp}`}>{fmtNum(r.importe / 100)}</span>
          </div>
        ))}
      </div>

      <div className={styles.totals}>
        <div className={styles.pemRow}>
          <span className={styles.pemLabel}>Presupuesto de Ejecución Material (PEM)</span>
          <span className={`mono ${styles.pemVal}`}>{fmtCents(pem)}</span>
        </div>
        <PctRow
          label="Gastos generales"
          rate={rates.gg}
          value={gg}
          color="color-mix(in srgb, var(--accent) 45%, var(--bg-elevated))"
          readOnly={readOnly}
          onRate={(r) => onRates?.({ gg: r })}
        />
        <PctRow
          label="Beneficio industrial"
          rate={rates.bi}
          value={bi}
          color="color-mix(in srgb, var(--accent) 25%, var(--bg-elevated))"
          readOnly={readOnly}
          onRate={(r) => onRates?.({ bi: r })}
        />
        <div className={`${styles.totalRow} ${styles.strong}`}>
          <span className={styles.totalLabel}>Presupuesto de Ejecución por Contrata (s/ IVA)</span>
          <span className={`mono ${styles.totalVal}`}>{fmtCents(pec)}</span>
        </div>
        <div className={styles.pctRow}>
          <span className={styles.pctLeft}>
            <span className={styles.swatch} style={{ background: 'var(--text-disabled)' }} />
            {readOnly ? (
              <span className={styles.pctLabel}>IVA {Math.round(rates.iva * 100)}%</span>
            ) : (
              <IvaSelect rate={rates.iva} onChange={(r) => onRates?.({ iva: r })} />
            )}
          </span>
          <span className={`mono ${styles.pctVal}`}>{fmtCents(iva)}</span>
        </div>
        <div className={styles.bigRow}>
          <span className={styles.bigLabel}>Presupuesto base de licitación</span>
          <span className={`mono ${styles.bigVal}`}>{fmtCents(total)}</span>
        </div>
      </div>
    </div>
  );
}

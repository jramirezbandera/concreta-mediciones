import { EditableNum, IvaSelect } from '../../components';
import type { CertChapterRow, CertTotals } from '../../core/certificacion';
import { fmtCents, fmtNum, round2, toEur, type Cents } from '../../core/money';
import { useObraStore } from '../../store';
import styles from './Certificaciones.module.css';

const GGBI_COLOR = 'color-mix(in srgb, var(--accent) 45%, var(--bg-elevated))';

function Row({
  label,
  value,
  color,
  strong,
  accent,
}: {
  label: string;
  value: Cents;
  color?: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className={styles.sumRow}>
      <span className={`${styles.sumLabel} ${strong ? styles.strong : ''}`}>
        {color && <span className={styles.sumDot} style={{ background: color }} />}
        {label}
      </span>
      <span className={`mono ${styles.sumVal} ${strong ? styles.strong : ''} ${accent ? styles.accent : ''}`}>
        {fmtCents(value)}
      </span>
    </div>
  );
}

/** Resumen económico de la certificación (retención editable + IVA + líquido). */
export function CertSummary({ totals, retencion }: { totals: CertTotals; retencion: number }) {
  const iva = useObraStore((s) => s.rates.iva);
  const gg = useObraStore((s) => s.rates.gg);
  const bi = useObraStore((s) => s.rates.bi);
  const setCertField = useObraStore((s) => s.setCertField);
  const setRates = useObraStore((s) => s.setRates);

  return (
    <div className={styles.summary}>
      <div className={`sec-head ${styles.sumHead}`}>Resumen de la certificación</div>

      <div className={styles.sumGroup}>
        <Row label="PEM presupuesto" value={totals.budgetPEM} />
        <Row label="PEM certificado a origen" value={totals.certPEM} accent />
        <div className={styles.globalBar}>
          <div className={styles.globalBarTrack}>
            <div
              className={styles.globalBarFill}
              style={{ width: `${Math.min(100, totals.pctGlobal)}%` }}
            />
          </div>
          <span className="mono" style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 600 }}>
            {fmtNum(totals.pctGlobal, 1)}%
          </span>
        </div>
      </div>

      <div className={styles.sumDivider} />
      <div className={styles.sumGroup}>
        <Row label={`GG + BI (${Math.round((gg + bi) * 100)}%)`} value={totals.ggbiOrigen} color={GGBI_COLOR} />
        <Row label="PEC a origen" value={totals.pecOrigen} strong />
        <Row label="Certificación anterior" value={totals.pecPrev} color="var(--text-disabled)" />
        <Row label="Importe esta certificación" value={totals.pecEsta} strong />
      </div>

      <div className={styles.sumDivider} />
      <div className={styles.sumGroup}>
        <div className={styles.sumRow}>
          <span className={styles.sumLabel}>
            <span className={styles.sumDot} style={{ background: 'var(--state-warn)' }} />
            Retención garantía
            <span className={styles.retInput}>
              <span className={styles.retInputBox}>
                <EditableNum
                  value={round2(retencion * 100)}
                  dec={1}
                  accent
                  ariaLabel="Retención %"
                  onCommit={(v) => setCertField('retencion', round2(v / 100))}
                />
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-disabled)' }}>
                %
              </span>
            </span>
          </span>
          <span className={`mono ${styles.sumVal} ${styles.warn}`}>− {fmtCents(totals.retencion)}</span>
        </div>
        <Row label="Base imponible" value={totals.base} strong />
        <div className={styles.sumRow}>
          <span className={styles.sumLabel}>
            <span className={styles.sumDot} style={{ background: 'var(--text-disabled)' }} />
            <IvaSelect rate={iva} onChange={(r) => setRates({ iva: r })} />
          </span>
          <span className={`mono ${styles.sumVal}`}>{fmtCents(totals.iva)}</span>
        </div>
      </div>

      <div className={styles.liqFinal}>
        <div>
          <div className={`caps ${styles.liqFinalLabel}`}>Líquido a abonar</div>
          <div className={styles.liqFinalSub}>esta certificación</div>
        </div>
        <span className={`mono ${styles.liqFinalVal}`}>{fmtCents(totals.liquido)}</span>
      </div>
    </div>
  );
}

/** Resumen por capítulos (barras de avance certificado). */
export function CertChapterSummary({ rows }: { rows: CertChapterRow[] }) {
  return (
    <div className={styles.chapSummary}>
      <div className={`sec-head ${styles.chapSumHead}`}>Resumen por capítulos</div>
      {rows.map((r) => {
        const full = r.pct >= 99.5;
        return (
          <div key={r.id} className={styles.chapSumRow}>
            <span className={`mono ${styles.chapSumCode}`}>{r.code}</span>
            <div className={styles.chapSumBody}>
              <div className={styles.chapSumTitle}>{r.title}</div>
              <div className={styles.chapSumTrack}>
                <div
                  className={`${styles.chapSumFill} ${full ? styles.full : ''}`}
                  style={{ width: `${Math.min(100, r.pct)}%` }}
                />
              </div>
            </div>
            <div className={styles.chapSumRight}>
              <div className={`mono ${styles.chapSumCert}`}>{fmtNum(toEur(r.cert))}</div>
              <div className={`mono ${styles.chapSumBudget}`}>de {fmtNum(toEur(r.budget))}</div>
            </div>
            <span className={`mono ${styles.chapSumPct} ${full ? styles.full : ''}`}>
              {fmtNum(r.pct, 0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

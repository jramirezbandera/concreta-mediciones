import { EditableNum, EditableText, Icon, IvaSelect } from '../../components';
import type { CertChapterRow, CertTotals } from '../../core/certificacion';
import { fmtCents, fmtNum, round2, toEur, type Cents } from '../../core/money';
import { useObraStore } from '../../store';
import { certPctState } from './certPctState';
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
  const ajustes = useObraStore((s) => s.certs[s.curCert]?.ajustes);
  const addAjuste = useObraStore((s) => s.addAjuste);
  const editAjuste = useObraStore((s) => s.editAjuste);
  const deleteAjuste = useObraStore((s) => s.deleteAjuste);
  // Importe valorado de cada ajuste (con su etiqueta y signo) por id, desde el motor.
  const importeById = new Map(totals.ajustesRows.map((r) => [r.id, r.importe]));

  return (
    <div className={styles.summary}>
      <div className={`sec-head ${styles.sumHead}`}>Resumen de la certificación</div>

      <div className={styles.sumGroup}>
        <Row label="PEM presupuesto" value={totals.budgetPEM} />
        <Row label="PEM certificado a origen" value={totals.certPEM} accent />
        {(() => {
          const gSt = certPctState(totals.pctGlobal);
          const gCls = gSt === 'over' ? styles.over : gSt === 'full' ? styles.full : '';
          const gColor =
            gSt === 'over' ? 'var(--state-warn)' : gSt === 'full' ? 'var(--state-ok)' : 'var(--accent)';
          return (
            <div
              className={styles.globalBar}
              title={gSt === 'over' ? 'Sobre-certificado: supera el 100 % del presupuesto' : undefined}
            >
              <div className={styles.globalBarTrack}>
                <div
                  className={`${styles.globalBarFill} ${gCls}`}
                  style={{ width: `${Math.min(100, totals.pctGlobal)}%` }}
                />
              </div>
              <span className="mono" style={{ fontSize: 11.5, color: gColor, fontWeight: 600 }}>
                {fmtNum(totals.pctGlobal, 1)}%
              </span>
            </div>
          );
        })()}
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

        {(ajustes ?? []).map((a) => {
          const neg = a.signo < 0;
          const importe = importeById.get(a.id) ?? 0;
          return (
            <div key={a.id} className={styles.ajuste}>
              <div className={styles.ajusteTop}>
                <button
                  type="button"
                  className={`${styles.ajusteSigno} ${neg ? styles.ajNeg : styles.ajPos}`}
                  title={neg ? 'Resta (descuento). Pulsa para sumar' : 'Suma (devolución). Pulsa para restar'}
                  aria-label={neg ? 'Signo: resta' : 'Signo: suma'}
                  onClick={() => editAjuste(a.id, 'signo', neg ? 1 : -1)}
                >
                  {neg ? '−' : '+'}
                </button>
                <span className={styles.ajusteConcepto}>
                  <EditableText
                    value={a.concepto}
                    ariaLabel="Concepto del ajuste"
                    placeholder="Concepto del ajuste…"
                    style={{ fontSize: 12, width: '100%' }}
                    onCommit={(v) => editAjuste(a.id, 'concepto', v)}
                  />
                </span>
                <button
                  type="button"
                  className={styles.ajusteDel}
                  title="Eliminar ajuste"
                  aria-label="Eliminar ajuste"
                  onClick={() => deleteAjuste(a.id)}
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
              <div className={styles.ajusteBot}>
                <div className={styles.ajusteControls}>
                  <span className={styles.ajusteValBox}>
                    <span className={styles.ajusteValInput}>
                      <EditableNum
                        value={a.tipo === 'pct' ? round2(a.valor * 100) : a.valor}
                        dec={a.tipo === 'pct' ? 3 : 2}
                        accent
                        ariaLabel={a.tipo === 'pct' ? 'Porcentaje del ajuste' : 'Importe del ajuste'}
                        onCommit={(v) => editAjuste(a.id, 'valor', a.tipo === 'pct' ? round2(v / 100) : v)}
                      />
                    </span>
                    <button
                      type="button"
                      className={styles.ajusteUnit}
                      title={a.tipo === 'pct' ? 'Porcentaje. Pulsa para importe fijo (€)' : 'Importe fijo. Pulsa para porcentaje (%)'}
                      aria-label={a.tipo === 'pct' ? 'Tipo: porcentaje' : 'Tipo: importe fijo'}
                      onClick={() => editAjuste(a.id, 'tipo', a.tipo === 'pct' ? 'fijo' : 'pct')}
                    >
                      {a.tipo === 'pct' ? '%' : '€'}
                    </button>
                  </span>
                  <label
                    className={`${styles.ajusteRecur} ${a.recurrente ? styles.recOn : ''}`}
                    title="Recurrente: se hereda automáticamente en cada certificación nueva"
                  >
                    <input
                      type="checkbox"
                      checked={a.recurrente}
                      onChange={(e) => editAjuste(a.id, 'recurrente', e.target.checked)}
                    />
                    Recurrente
                  </label>
                </div>
                <span className={`mono ${styles.ajusteImporte} ${neg ? styles.ajNeg : styles.ajPos}`}>
                  {neg ? '−' : '+'} {fmtCents(importe)}
                </span>
              </div>
            </div>
          );
        })}
        <button type="button" className={`tcol ${styles.ajusteAdd}`} onClick={() => addAjuste()}>
          <Icon name="plus" size={13} /> Añadir ajuste
        </button>

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
        const st = certPctState(r.pct);
        const stCls = st === 'over' ? styles.over : st === 'full' ? styles.full : '';
        return (
          <div
            key={r.id}
            className={styles.chapSumRow}
            title={st === 'over' ? 'Sobre-certificado: supera el 100 % del presupuesto' : undefined}
          >
            <span className={`mono ${styles.chapSumCode}`}>{r.code}</span>
            <div className={styles.chapSumBody}>
              <div className={styles.chapSumTitle}>{r.title}</div>
              <div className={styles.chapSumTrack}>
                <div
                  className={`${styles.chapSumFill} ${stCls}`}
                  style={{ width: `${Math.min(100, r.pct)}%` }}
                />
              </div>
            </div>
            <div className={styles.chapSumRight}>
              <div className={`mono ${styles.chapSumCert}`}>{fmtNum(toEur(r.cert))}</div>
              <div className={`mono ${styles.chapSumBudget}`}>de {fmtNum(toEur(r.budget))}</div>
            </div>
            <span className={`mono ${styles.chapSumPct} ${stCls}`}>{fmtNum(r.pct, 0)}%</span>
          </div>
        );
      })}
    </div>
  );
}

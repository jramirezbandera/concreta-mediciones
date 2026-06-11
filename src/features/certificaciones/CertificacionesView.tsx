import { useRef, useState } from 'react';
import { EditableText, EmptyAction, EmptyState, Icon } from '../../components';
import { certCalc, certSnapshotOf, extraCalc, extrasCantidad } from '../../core/certificacion';
import { fmtCents, fmtNum, sumCents, toEur, type Cents } from '../../core/money';
import { useElementWidth } from '../../hooks/useElementWidth';
import {
  selectCertChapterRows,
  selectCertTotals,
  useObraStore,
  type CertMode,
} from '../../store';
import { CertChapterCards } from './CertChapterCards';
import { CertChapterTable, CertHead } from './CertTable';
import { CertChapterSummary, CertSummary } from './CertSummary';
import { CertSelector } from './CertSelector';
import styles from './Certificaciones.module.css';

/** Por debajo de este ancho ÚTIL la tabla conmuta a tarjetas (igual que F2.5). */
const COMPACT_WIDTH = 780;

const MODES: [CertMode, string][] = [
  ['origen', 'A origen'],
  ['esta', 'Esta certificación'],
];

/**
 * Vista de Certificaciones (F4.1): selector de cert + periodo/retención editables,
 * "líquido a abonar" grande, toggle A origen / Esta certificación, tabla por
 * capítulo con la cantidad ejecutada editable, y resúmenes (económico + por
 * capítulos). El cálculo es el motor de F1; el % editable + desplegable (F4.2),
 * marcar líneas (F4.3), contradictorios cert-local (F4.4) y tarjetas móvil (F4.5,
 * conmuta por ancho útil <780, igual que F2.5). F4 completa.
 */
export function CertificacionesView({
  compact: mobile,
  onGoPresupuesto,
}: {
  compact: boolean;
  /** Lleva a la vista Presupuesto (CTA del estado vacío de obra, F8.3). */
  onGoPresupuesto?: () => void;
}) {
  const viewRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(viewRef);
  const compact = mobile || (width > 0 && width < COMPACT_WIDTH);
  const [mode, setMode] = useState<CertMode>('origen');
  const certs = useObraStore((s) => s.certs);
  const curCert = useObraStore((s) => s.curCert);
  const chapters = useObraStore((s) => s.chapters);
  const partidas = useObraStore((s) => s.partidas);
  const coefK = useObraStore((s) => s.rates.coefK);
  const setCertField = useObraStore((s) => s.setCertField);
  const totals = useObraStore(selectCertTotals);
  const chapterRows = useObraStore(selectCertChapterRows);

  const cur = certs[curCert];
  if (!cur) return <div className={styles.view} />;

  // Obra sin partidas: no hay nada que certificar (journey §4 — siguiente paso
  // sutil, sin wizard). El estado vacío manda al presupuesto.
  if (Object.values(partidas).every((ps) => ps.length === 0)) {
    return (
      <div ref={viewRef} className={`${styles.view} ${styles.viewFill}`}>
        <EmptyState
          icon="clipboardCheck"
          title="Nada que certificar todavía"
          text="Cuando el presupuesto tenga partidas medidas, aquí certificarás la obra ejecutada mes a mes y sacarás la relación valorada."
        >
          {onGoPresupuesto && (
            <EmptyAction primary onClick={onGoPresupuesto}>
              Ir al presupuesto
            </EmptyAction>
          )}
        </EmptyState>
      </div>
    );
  }
  const curData = cur.data;
  const prevData = curCert > 0 ? (certs[curCert - 1]?.data ?? {}) : {};
  const extras = cur.extras ?? [];
  const prevExtras = curCert > 0 ? (certs[curCert - 1]?.extras ?? []) : [];
  const prevExtraCant = extrasCantidad(prevExtras);
  // F7.0: precios congelados de la cert (undefined si es legada → en vivo).
  const snap = certSnapshotOf(cur, coefK);

  return (
    <div ref={viewRef} className={`fadeUp ${styles.view}${compact ? ` ${styles.compact}` : ''}`}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            <CertSelector />
            <span className={styles.period}>
              <Icon name="doc" size={14} style={{ color: 'var(--text-disabled)' }} />
              <EditableText
                value={cur.period}
                ariaLabel="Periodo de la certificación"
                placeholder="Periodo…"
                style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}
                onCommit={(v) => setCertField('period', v)}
              />
            </span>
          </div>
          <div>
            <div className={`caps ${styles.liqLabel}`}>Líquido a abonar</div>
            <div className={`mono ${styles.liqVal}`}>{fmtCents(totals.liquido)}</div>
          </div>
        </div>
        <div className={styles.headerBottom}>
          <div className={styles.seg}>
            {MODES.map(([m, label]) => (
              <button
                key={m}
                type="button"
                className={`tcol ${styles.segBtn} ${mode === m ? styles.on : ''}`}
                onClick={() => setMode(m)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className={styles.globalPct}>
            Ejecución global <span className="mono">{fmtNum(totals.pctGlobal, 1)}%</span>
          </span>
        </div>
      </div>

      {!compact && <CertHead mode={mode} />}

      {chapters.map((ch) => {
        const ps = partidas[ch.id] ?? [];
        if (!ps.length) return null;
        const chExtras = extras.filter((e) => e.chapterId === ch.id);
        const totalByMode: Cents = sumCents([
          ...ps.map((p) => {
            const k = certCalc(p, curData, prevData, coefK, snap);
            return mode === 'origen' ? k.aOrigen : k.estaCert;
          }),
          ...chExtras.map((e) => {
            const k = extraCalc(e, prevExtraCant[e.id] ?? 0);
            return mode === 'origen' ? k.aOrigen : k.estaCert;
          }),
        ]);
        const pct = chapterRows.find((r) => r.id === ch.id)?.pct ?? 0;
        const full = pct >= 99.5;
        return (
          <section key={ch.id}>
            <div className={styles.chapBand}>
              <span className={`mono ${styles.chapCode}`}>{ch.code}</span>
              <span className={styles.chapTitle}>{ch.title}</span>
              <div className={styles.chapRight}>
                <span className={`mono ${styles.chapPct} ${full ? styles.full : ''}`}>
                  {fmtNum(pct, 1)}% ejec.
                </span>
                <span className={`mono ${styles.chapImporte}`}>{fmtNum(toEur(totalByMode))}</span>
              </div>
            </div>
            {compact ? (
              <CertChapterCards
                chapter={ch}
                partidas={ps}
                curData={curData}
                prevData={prevData}
                mode={mode}
                coefK={coefK}
                snap={snap}
                extras={extras}
                prevExtras={prevExtras}
              />
            ) : (
              <div className={styles.tableWrap}>
                <CertChapterTable
                  chapter={ch}
                  partidas={ps}
                  curData={curData}
                  prevData={prevData}
                  mode={mode}
                  coefK={coefK}
                  snap={snap}
                  extras={extras}
                  prevExtras={prevExtras}
                />
              </div>
            )}
          </section>
        );
      })}

      <div className={styles.summaryGrid}>
        <CertChapterSummary rows={chapterRows} />
        <CertSummary totals={totals} retencion={cur.retencion} />
      </div>
    </div>
  );
}

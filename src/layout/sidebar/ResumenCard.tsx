/* ---------- Tarjeta Resumen (composición del presupuesto) ----------------- */
import { useMemo, useState } from 'react';
import { EditableNum, Icon, IvaSelect } from '../../components';
import { fmtCents, fmtNum, type Cents } from '../../core/money';
import { pem as pemCore } from '../../core/totales';
import { selectPec, selectPem, selectTotalConIva, useObraStore } from '../../store';
import { AjustaModal } from './AjustaModal';
import styles from '../Sidebar.module.css';

export function ResumenCard({ compact }: { compact: boolean }) {
  const pem = useObraStore(selectPem);
  const pec = useObraStore(selectPec);
  const total = useObraStore(selectTotalConIva);
  const gg = useObraStore((s) => s.rates.gg);
  const bi = useObraStore((s) => s.rates.bi);
  const iva = useObraStore((s) => s.rates.iva);
  const coefK = useObraStore((s) => s.rates.coefK);
  const setRates = useObraStore((s) => s.setRates);
  const partidas = useObraStore((s) => s.partidas);

  // PEM a K=1: base del ajuste por objetivo, independiente del K vigente.
  const baseCents = useMemo(() => pemCore(partidas, 1), [partidas]);
  const [targeting, setTargeting] = useState(false);

  const ggbi: Cents = pec - pem;
  const ivaCents: Cents = total - pec;
  const pemColor = 'var(--accent)';
  const ggbiColor = 'color-mix(in srgb, var(--accent) 45%, var(--bg-elevated))';
  const ivaColor = 'var(--text-disabled)';
  const segs: [Cents, string][] = [
    [pem, pemColor],
    [ggbi, ggbiColor],
    [ivaCents, ivaColor],
  ];

  return (
    <div className={styles.resumen}>
      <div className={styles.resTop}>
        <div className={`sec-head ${styles.resHeadInline}`}>Resumen</div>
        <div className={styles.kBox} title="Coeficiente K global de la obra (1 = sin ajuste)">
          <span className={`caps ${styles.kCap}`}>K</span>
          <span className={styles.kNum}>
            <EditableNum
              value={coefK}
              dec={4}
              ariaLabel="Coeficiente K"
              onCommit={(v) => setRates({ coefK: v })}
            />
          </span>
          <button
            type="button"
            className={styles.kBtn}
            onClick={() => setTargeting(true)}
            disabled={baseCents <= 0}
            title="Ajustar K a un PEM objetivo"
          >
            <Icon name="target" size={11} /> Ajusta
          </button>
        </div>
      </div>
      <div className={styles.compBar}>
        {segs.map(([value, color], i) => (
          <div
            key={i}
            className={styles.compSeg}
            style={{ width: `${total ? (value / total) * 100 : 0}%`, background: color }}
          />
        ))}
      </div>
      <div className={styles.resRows}>
        <div className={styles.resRow}>
          <span className={styles.resLabel}>
            <span className={styles.resDot} style={{ background: pemColor }} />
            PEM
          </span>
          <span className={`mono ${styles.resVal}`}>{fmtCents(pem)}</span>
        </div>
        <div className={styles.resRow}>
          <span className={styles.resLabel}>
            <span className={styles.resDot} style={{ background: ggbiColor }} />
            {/* 1 dec (B-09): Math.round decía «20%» aplicando 19,5 %. */}
            GG + BI ({fmtNum((gg + bi) * 100, 1)}%)
          </span>
          <span className={`mono ${styles.resVal}`}>{fmtCents(ggbi)}</span>
        </div>
        <div className={styles.resRow}>
          <span className={styles.resLabel}>PEC s/ IVA</span>
          <span className={`mono ${styles.resVal} ${styles.strong}`}>{fmtCents(pec)}</span>
        </div>
        <div className={styles.resRow}>
          <span className={styles.resLabel}>
            <span className={styles.resDot} style={{ background: ivaColor }} />
            <IvaSelect rate={iva} onChange={(r) => setRates({ iva: r })} />
          </span>
          <span className={`mono ${styles.resVal}`}>{fmtCents(ivaCents)}</span>
        </div>
      </div>
      <div className={styles.resTotal}>
        <span className={styles.resTotalLabel}>Total</span>
        <span className={`mono ${styles.resTotalVal}`}>{fmtCents(total)}</span>
      </div>

      <AjustaModal
        open={targeting}
        onClose={() => setTargeting(false)}
        baseCents={baseCents}
        currentPem={pem}
        pemAt={(k) => pemCore(partidas, k)}
        onApply={(k) => setRates({ coefK: k })}
        compact={compact}
      />
    </div>
  );
}

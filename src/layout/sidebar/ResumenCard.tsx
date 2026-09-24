/* ---------- Tarjeta Resumen (composición del presupuesto) ----------------- */
import { useMemo, useState } from 'react';
import { EditableNum, Icon, IvaSelect } from '../../components';
import { fmtCents, fmtNum, type Cents } from '../../core/money';
import { costesDirectos as cdCore, pem as pemCore } from '../../core/totales';
import {
  selectCostesDirectos,
  selectCostesIndirectos,
  selectPec,
  selectPem,
  selectTotalConIva,
  useObraStore,
} from '../../store';
import { AjustaModal } from './AjustaModal';
import styles from '../Sidebar.module.css';

export function ResumenCard({ compact }: { compact: boolean }) {
  const cd = useObraStore(selectCostesDirectos);
  const ci = useObraStore(selectCostesIndirectos);
  const pem = useObraStore(selectPem);
  const pec = useObraStore(selectPec);
  const total = useObraStore(selectTotalConIva);
  const rates = useObraStore((s) => s.rates);
  const { gg, bi, iva, coefK } = rates;
  const setRates = useObraStore((s) => s.setRates);
  const partidas = useObraStore((s) => s.partidas);

  // PEM a K=1: base del ajuste por objetivo, independiente del K vigente. Lleva
  // el CI, como el PEM que se teclea como objetivo (el K sale igual: multiplica
  // arriba y abajo de la razón).
  const baseCents = useMemo(() => pemCore(cdCore(partidas, 1), rates), [partidas, rates]);
  const [targeting, setTargeting] = useState(false);

  const ggbi: Cents = pec - pem;
  const ivaCents: Cents = total - pec;
  const pemColor = 'var(--accent)';
  const ciColor = 'color-mix(in srgb, var(--accent) 70%, var(--bg-elevated))';
  const ggbiColor = 'color-mix(in srgb, var(--accent) 45%, var(--bg-elevated))';
  const ivaColor = 'var(--text-disabled)';
  // Con CI la barra separa directos e indirectos (los dos son PEM, pero el
  // usuario acaba de decidir el segundo y quiere verlo pesar).
  const segs: [Cents, string][] = [
    [ci > 0 ? cd : pem, pemColor],
    ...(ci > 0 ? ([[ci, ciColor]] as [Cents, string][]) : []),
    [ggbi, ggbiColor],
    [ivaCents, ivaColor],
  ];
  // Inicio de cada tramo en % de la pista (suma de los anteriores). Sin total,
  // todos empiezan al 100 % (fuera de la vista): barra vacía.
  const segStarts = segs.map((_, i) =>
    total ? (segs.slice(0, i).reduce((a, [v]) => a + v, 0) / total) * 100 : 100,
  );

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
      {/* Cada tramo mide la pista entera y se DESPLAZA hasta su inicio (transform,
          sin recalcular layout al animar); el siguiente tapa su cola. */}
      <div className={styles.compBar}>
        {segs.map(([, color], i) => (
          <div
            key={i}
            className={styles.compSeg}
            style={{ transform: `translateX(${segStarts[i]}%)`, background: color }}
          />
        ))}
      </div>
      <div className={styles.resRows}>
        {ci > 0 && (
          <div className={styles.resRow}>
            <span className={styles.resLabel}>
              <span className={styles.resDot} style={{ background: pemColor }} />
              Costes directos
            </span>
            <span className={`mono ${styles.resVal}`}>{fmtCents(cd)}</span>
          </div>
        )}
        {ci > 0 && (
          <div className={styles.resRow}>
            <span className={styles.resLabel}>
              <span className={styles.resDot} style={{ background: ciColor }} />
              {/* 1 dec, como GG+BI: un «3%» que en realidad es 2,5 % engaña. */}
              Costes indir. ({fmtNum(rates.ci * 100, 1)}%)
            </span>
            <span className={`mono ${styles.resVal}`}>{fmtCents(ci)}</span>
          </div>
        )}
        <div className={styles.resRow}>
          <span className={styles.resLabel}>
            {ci === 0 && <span className={styles.resDot} style={{ background: pemColor }} />}
            PEM
          </span>
          <span className={`mono ${styles.resVal} ${ci > 0 ? styles.strong : ''}`}>
            {fmtCents(pem)}
          </span>
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
        pemAt={(k) => pemCore(cdCore(partidas, k), rates)}
        onApply={(k) => setRates({ coefK: k })}
        compact={compact}
      />
    </div>
  );
}

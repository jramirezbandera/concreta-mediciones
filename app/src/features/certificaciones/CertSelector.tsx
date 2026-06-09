import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components';
import { certTotals, prevDataOf } from '../../core/certificacion';
import { fmtCents, fmtNum } from '../../core/money';
import { useObraStore } from '../../store';
import styles from './Certificaciones.module.css';

/** Selector de certificación: histórico (con % y líquido) + "Nueva certificación". */
export function CertSelector() {
  const certs = useObraStore((s) => s.certs);
  const curCert = useObraStore((s) => s.curCert);
  const partidas = useObraStore((s) => s.partidas);
  const rates = useObraStore((s) => s.rates);
  const setCurCert = useObraStore((s) => s.setCurCert);
  const addCert = useObraStore((s) => s.addCert);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const flat = Object.values(partidas).flat();
  const cur = certs[curCert];

  return (
    <div ref={ref} className={styles.selWrap}>
      <button type="button" className={`tcol ${styles.selBtn}`} onClick={() => setOpen((o) => !o)}>
        <Icon name="clipboardCheck" size={15} style={{ color: 'var(--accent)' }} />
        Certificación nº {cur?.num ?? '—'}
        <Icon name="chevronDown" size={14} style={{ color: 'var(--text-disabled)' }} />
      </button>
      {open && (
        <div className={styles.selPop}>
          <div className={`sec-head ${styles.selHead}`}>Histórico de certificaciones</div>
          {certs.map((c, i) => {
            const tot = certTotals(flat, c.data, prevDataOf(certs, i), rates, c.retencion, rates.coefK);
            const on = i === curCert;
            return (
              <button
                key={c.id}
                type="button"
                className={`tcol ${styles.selItem} ${on ? styles.on : ''}`}
                onClick={() => {
                  setCurCert(i);
                  setOpen(false);
                }}
              >
                <span className={`mono ${styles.selNum}`}>{c.num}</span>
                <span className={styles.selBody}>
                  <span className={styles.selTitle}>Certificación nº {c.num}</span>
                  <span className={styles.selSub}>
                    {c.period || 'sin periodo'} · {fmtNum(tot.pctGlobal, 0)}% ejecución
                  </span>
                </span>
                <span className={`mono ${styles.selLiq}`}>{fmtCents(tot.liquido)}</span>
              </button>
            );
          })}
          <div className={styles.selDivider} />
          <button
            type="button"
            className={`tcol ${styles.selItem} ${styles.selAdd}`}
            onClick={() => {
              addCert();
              setOpen(false);
            }}
          >
            <span className={styles.selNum}>
              <Icon name="plus" size={16} />
            </span>
            <span className={styles.selTitle} style={{ color: 'var(--accent)', fontWeight: 600 }}>
              Nueva certificación
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

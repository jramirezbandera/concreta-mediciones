import { useEffect, useRef, useState } from 'react';
import { EditableNum, EditableText, Icon, IvaSelect } from '../../components';
import { ajusteEsRetencion, type CertChapterRow, type CertTotals } from '../../core/certificacion';
import { fmtCents, fmtNum, pctToRate, round2, toEur, type Cents } from '../../core/money';
import { useObraStore } from '../../store';
import { certPctState } from './certPctState';
import styles from './Certificaciones.module.css';

const GGBI_COLOR = 'color-mix(in srgb, var(--accent) 45%, var(--bg-elevated))';
const CI_COLOR = 'color-mix(in srgb, var(--accent) 70%, var(--bg-elevated))';

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
export function CertSummary({
  totals,
  retencion,
  retenidoAcumulado,
}: {
  totals: CertTotals;
  retencion: number;
  /** Garantía retenida acumulada hasta esta cert (céntimos); `null` = no mostrar. */
  retenidoAcumulado: Cents | null;
}) {
  const iva = useObraStore((s) => s.rates.iva);
  const ci = useObraStore((s) => s.rates.ci);
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

  // Menú de "Añadir ajuste": blanco vs retención de garantía predefinida. Posición
  // FIJA calculada desde el trigger (el resumen puede vivir en un contenedor con
  // scroll que recortaría un popover absoluto), se cierra al pinchar fuera o scroll
  // (mismo patrón que TypeSelect/UdSelect).
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const addRef = useRef<HTMLDivElement>(null);
  // Guarda de doble retención (P3): la obra ya retiene si hay retención legacy o
  // un ajuste-retención → la opción del menú se desactiva.
  const yaRetiene = retencion > 0 || (ajustes ?? []).some(ajusteEsRetencion);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onScroll() {
      setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [menuOpen]);

  function toggleMenu() {
    if (!menuOpen) {
      const r = addRef.current?.getBoundingClientRect();
      if (r) {
        const alto = 132;
        const top = r.bottom + alto > window.innerHeight ? Math.max(8, r.top - alto) : r.bottom + 4;
        setMenuPos({ top, left: Math.min(r.left, window.innerWidth - 244 - 8) });
      }
    }
    setMenuOpen((o) => !o);
  }

  function pick(preset?: 'retencion') {
    addAjuste(preset);
    setMenuOpen(false);
  }

  return (
    <div className={styles.summary}>
      <div className={`sec-head ${styles.sumHead}`}>Resumen de la certificación</div>

      <div className={styles.sumGroup}>
        <Row label="PEM presupuesto" value={totals.budgetPEM} />
        {/* Con CI de obra, lo que suman los capítulos son los costes DIRECTOS
            certificados; el PEM certificado les añade el mismo % que el
            presupuesto (si el contrato lo lleva dentro, lo ejecutado también).
            Sin CI la cadena es la de siempre: una sola fila. */}
        {totals.ciOrigen > 0 && (
          <Row label="Costes directos a origen" value={totals.certCD} />
        )}
        {totals.ciOrigen > 0 && (
          <Row
            label={`Costes indirectos (${fmtNum(ci * 100, 1)}%)`}
            value={totals.ciOrigen}
            color={CI_COLOR}
          />
        )}
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
        {/* fmtNum a 1 dec (B-09): Math.round decía «20%» aplicando 19,5 %. */}
        <Row label={`GG + BI (${fmtNum((gg + bi) * 100, 1)}%)`} value={totals.ggbiOrigen} color={GGBI_COLOR} />
        <Row label="PEC a origen" value={totals.pecOrigen} strong />
        <Row label="Certificación anterior" value={totals.pecPrev} color="var(--text-disabled)" />
        <Row label="Importe esta certificación" value={totals.pecEsta} strong />
      </div>

      <div className={styles.sumDivider} />
      <div className={styles.sumGroup}>
        {/* La retención NO se fuerza por defecto (design): la fila solo aparece si
            la obra tiene retención (>0). Una obra sin retenciones no la ve; se
            añade a voluntad como línea de ajuste (%, recurrente). Las obras que ya
            tenían retención conservan su fila editable (ponerla a 0 la oculta). */}
        {retencion > 0 && (
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
                    // pctToRate, NO round2(v/100): eso cuantizaba a % enteros (B-01).
                    onCommit={(v) => setCertField('retencion', pctToRate(v))}
                  />
                </span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-disabled)' }}>
                  %
                </span>
              </span>
            </span>
            <span className={`mono ${styles.sumVal} ${styles.warn}`}>− {fmtCents(totals.retencion)}</span>
          </div>
        )}

        {(ajustes ?? []).map((a) => {
          const neg = a.signo < 0;
          const importe = importeById.get(a.id) ?? 0;
          return (
            <div key={a.id} className={styles.ajuste}>
              <div className={styles.ajusteTop}>
                <span className={styles.segToggle} role="group" aria-label="Signo del ajuste">
                  <button
                    type="button"
                    className={neg ? `${styles.segOn} ${styles.segNeg}` : ''}
                    title="Resta: descuento sobre la certificación"
                    aria-pressed={neg}
                    onClick={() => editAjuste(a.id, 'signo', -1)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className={neg ? '' : `${styles.segOn} ${styles.segPos}`}
                    title="Suma: devolución o cargo a favor"
                    aria-pressed={!neg}
                    onClick={() => editAjuste(a.id, 'signo', 1)}
                  >
                    +
                  </button>
                </span>
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
                  className={`tap-target ${styles.ajusteDel}`}
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
                        // pct: valor pleno ×100, SIN round2 (perdía el 3er decimal del %);
                        // el commit usa pctToRate(v,3), no round2(v/100), que cuantizaba
                        // a % enteros y hacía imposible el «10,197 %» canónico (B-02).
                        value={a.tipo === 'pct' ? a.valor * 100 : a.valor}
                        dec={a.tipo === 'pct' ? 3 : 2}
                        accent
                        ariaLabel={a.tipo === 'pct' ? 'Porcentaje del ajuste' : 'Importe del ajuste'}
                        onCommit={(v) => editAjuste(a.id, 'valor', a.tipo === 'pct' ? pctToRate(v, 3) : v)}
                      />
                    </span>
                  </span>
                  {/* Toggle segmentado: mostrar ambas opciones es la pista visual de
                      que el tipo es conmutable (antes era texto plano, sin cue). */}
                  <span className={styles.segToggle} role="group" aria-label="Tipo de ajuste">
                    <button
                      type="button"
                      className={a.tipo === 'fijo' ? styles.segOn : ''}
                      title="Importe fijo en euros"
                      aria-pressed={a.tipo === 'fijo'}
                      onClick={() => editAjuste(a.id, 'tipo', 'fijo')}
                    >
                      €
                    </button>
                    <button
                      type="button"
                      className={a.tipo === 'pct' ? styles.segOn : ''}
                      title="Porcentaje sobre la base"
                      aria-pressed={a.tipo === 'pct'}
                      onClick={() => editAjuste(a.id, 'tipo', 'pct')}
                    >
                      %
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
        <div ref={addRef} className={styles.ajusteAddWrap}>
          <button
            type="button"
            className={`tcol ${styles.ajusteAdd}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={toggleMenu}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setMenuOpen(false);
            }}
          >
            <Icon name="plus" size={13} /> Añadir ajuste
            <Icon name="chevronDown" size={11} style={{ color: 'var(--text-disabled)' }} />
          </button>
          {menuOpen && menuPos && (
            <div role="menu" className={styles.ajusteMenu} style={{ top: menuPos.top, left: menuPos.left }}>
              <button
                type="button"
                role="menuitem"
                className={`tcol ${styles.ajusteMenuItem}`}
                onClick={() => pick()}
              >
                <span className={styles.ajusteMenuTitle}>Ajuste en blanco</span>
                <span className={styles.ajusteMenuSub}>Descuento o cargo puntual</span>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={yaRetiene}
                title={yaRetiene ? 'Esta certificación ya tiene retención' : undefined}
                className={`tcol ${styles.ajusteMenuItem}`}
                onClick={() => pick('retencion')}
              >
                <span className={styles.ajusteMenuTitle}>Retención de garantía</span>
                <span className={styles.ajusteMenuSub}>% recurrente que se retiene cada cert</span>
              </button>
            </div>
          )}
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

      {/* Informativa (jerarquía menor, no se descuenta aquí): garantía en poder de
          la propiedad hasta esta cert. Cross-cert, llega por prop. Se muestra en
          cuanto la obra tuvo retención, aunque el neto vuelva a 0 (constancia). */}
      {retenidoAcumulado != null && (
        <div
          className={styles.retAcum}
          title="Garantía retenida hasta esta certificación (retenido − devuelto)"
        >
          <span className={styles.retAcumLabel}>Retenido acumulado (garantía)</span>
          <span className={`mono ${styles.retAcumVal}`}>{fmtCents(retenidoAcumulado)}</span>
        </div>
      )}
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

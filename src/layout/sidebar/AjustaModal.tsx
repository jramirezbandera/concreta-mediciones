/* ---------- Modal "Ajusta": K que cuadra el PEM a un objetivo -------------- */
import { useEffect, useState } from 'react';
import { Icon, Modal } from '../../components';
import {
  fmtCents,
  fmtNum,
  parseEsNumber,
  toCents,
  toDecimalComma,
  toEur,
  type Cents,
} from '../../core/money';
import { coefKParaObjetivo } from '../../core/totales';
import styles from '../Sidebar.module.css';

/**
 * Calcula el coeficiente K que lleva el PEM a la cifra objetivo que teclea el
 * usuario (rebaja/subida del constructor, cuadrar un PEM contractual). La base
 * del cálculo es el PEM a K=1, así que reajustar al mismo objetivo es idempotente.
 * El preview muestra el K resultante y el PEM REAL que saldrá (con el redondeo
 * por partida, que puede dejar una desviación de céntimos respecto al objetivo).
 */
export function AjustaModal({
  open,
  onClose,
  baseCents,
  currentPem,
  pemAt,
  onApply,
  compact,
}: {
  open: boolean;
  onClose: () => void;
  baseCents: Cents; // PEM a K=1 (base de la razón)
  currentPem: Cents; // PEM con el K vigente (semilla del objetivo)
  pemAt: (coefK: number) => Cents; // PEM real con un K dado (redondeo por partida)
  onApply: (coefK: number) => void;
  compact: boolean;
}) {
  const [draft, setDraft] = useState('');
  // Al abrir, precarga el objetivo con el PEM actual: el punto de partida natural.
  useEffect(() => {
    if (open) setDraft(fmtNum(toEur(currentPem), 2).replace(/\./g, ''));
  }, [open, currentPem]);

  const target = parseEsNumber(draft);
  const targetCents = target != null ? toCents(target) : null;
  const valido = targetCents != null && targetCents > 0 && baseCents > 0;
  const k = valido ? coefKParaObjetivo(baseCents, targetCents) : null;
  // PEM real que saldrá al aplicar ese K (redondeo por partida, no escalar el total).
  const resultPem = k != null ? pemAt(k) : null;
  const delta = resultPem != null && targetCents != null ? resultPem - targetCents : null;

  function apply() {
    if (k == null) return;
    onApply(k);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajustar a un PEM objetivo"
      subtitle="Calcula el coeficiente K que cuadra el presupuesto con la cifra que indiques"
      icon="target"
      compact={compact}
      footer={
        <>
          <button type="button" className={styles.ajustaCancel} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={styles.ajustaApply} onClick={apply} disabled={k == null}>
            Aplicar K {k != null ? `×${fmtNum(k, 4)}` : ''}
          </button>
        </>
      }
    >
      <div className={styles.ajustaBody}>
        <label className={styles.ajustaField}>
          <span className={`caps ${styles.ajustaLabel}`}>PEM objetivo</span>
          <span className={styles.ajustaInputWrap}>
            <input
              className={`mono ${styles.ajustaInput}`}
              value={draft}
              inputMode="decimal"
              aria-label="PEM objetivo en euros"
              autoFocus
              onChange={(e) => setDraft(toDecimalComma(e.target.value))} // punto del numpad → coma
              onKeyDown={(e) => {
                if (e.key === 'Enter') apply();
              }}
            />
            <span className={styles.ajustaUnit}>€</span>
          </span>
        </label>

        <div className={styles.ajustaPreview}>
          <div className={styles.ajustaPrevRow}>
            <span className={styles.ajustaPrevLabel}>PEM actual (K ×1)</span>
            <span className="mono">{fmtCents(baseCents)}</span>
          </div>
          <div className={styles.ajustaPrevRow}>
            <span className={styles.ajustaPrevLabel}>Coeficiente K</span>
            <span className={`mono ${styles.ajustaPrevK}`}>{k != null ? `×${fmtNum(k, 4)}` : '—'}</span>
          </div>
          <div className={styles.ajustaPrevRow}>
            <span className={styles.ajustaPrevLabel}>PEM resultante</span>
            <span className={`mono ${styles.ajustaPrevStrong}`}>
              {resultPem != null ? fmtCents(resultPem) : '—'}
            </span>
          </div>
          {delta != null && Math.abs(delta) >= 1 && (
            <div className={styles.ajustaNote}>
              <Icon name="alert" size={12} /> Desvío de {fmtNum(toEur(delta))} € por el redondeo de
              precios por partida (inevitable; queda dentro de la tolerancia habitual).
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

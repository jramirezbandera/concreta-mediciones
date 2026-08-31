import { useState } from 'react';
import { EditableNum, Icon, InfoTip, IvaSelect } from '../../components';
import type { ResumenListado } from '../../core/listado';
import { fmtCents, fmtNum, pctToRate } from '../../core/money';
import type { Rates } from '../../core/types';
import styles from './Resumen.module.css';

/**
 * Qué es cada eslabón de la cadena económica, en el orden del RGLCAP. Vive aquí
 * (no en los documentos) porque es ayuda de EDICIÓN: el usuario teclea cinco
 * porcentajes seguidos y los dos primeros se confunden con facilidad —los costes
 * indirectos son de la OBRA y van dentro del PEM; los gastos generales son de la
 * EMPRESA y van sobre el PEM ya cerrado—.
 */
const AYUDA = {
  ci: 'Gastos de la OBRA que no se pueden imputar a una unidad concreta: caseta, grúa, jefe de obra, agua y luz, imprevistos. Se reparten como % sobre los costes directos y quedan DENTRO del PEM (RGLCAP art. 130). Habitual: 2–6 %; en edificación, 2–3 %.',
  pem: 'Presupuesto de Ejecución Material: costes directos + costes indirectos. Lo que cuesta ejecutar la obra, antes del margen y la estructura de la empresa.',
  gg: 'Gastos de estructura de la EMPRESA —sede, administración, gastos financieros, tasas—, no de esta obra. Se calculan sobre el PEM. RGLCAP art. 131: del 13 % al 17 %; lo habitual es 13 %.',
  bi: 'Margen del contratista, sobre el PEM. RGLCAP art. 131: 6 %.',
  pec: 'Presupuesto de Ejecución por Contrata: PEM + gastos generales + beneficio industrial. Es el precio del contrato, sin IVA.',
  iva: 'Impuesto sobre el PEC. 21 % general; 10 % en obras de renovación y reparación de vivienda que cumplen los requisitos del art. 91 LIVA.',
  licitacion: 'PEC + IVA: la cifra que se publica y la que «asciende» el presupuesto.',
} as const;

/** Fila de porcentaje (CI/GG/BI): % editable + importe, con su ayuda. */
function PctRow({
  label,
  ayuda,
  rate,
  value,
  color,
  onRate,
  children,
}: {
  label: string;
  ayuda: string;
  rate: number;
  value: number; // céntimos
  color: string;
  onRate?: (rate: number) => void;
  /** Aviso bajo la fila (la propuesta de CI de las partidas importadas). */
  children?: React.ReactNode;
}) {
  return (
    <>
      <div className={styles.pctRow}>
        <span className={styles.pctLeft}>
          <span className={styles.swatch} style={{ background: color }} />
          <span className={styles.pctLabel}>{label}</span>
          <InfoTip term={label}>{ayuda}</InfoTip>
        </span>
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
        <span className={`mono ${styles.pctVal}`}>{fmtCents(value)}</span>
      </div>
      {children}
    </>
  );
}

/**
 * Hoja resumen (F7.1) EN PANTALLA: desglose por capítulos + CI → PEM → GG → BI →
 * PEC → IVA → Presupuesto base de licitación, editable (CI/GG/BI inline +
 * selector de IVA — único hogar de edición de esas tasas). Los documentos
 * exportados NO reutilizan esta hoja: tienen su propia jerarquía de papel
 * (`PrintResumen`, `resumenBloques` del DOCX, `buildResumenXlsx`) sobre el MISMO
 * `ResumenListado`.
 *
 * La fila de costes indirectos se ve SIEMPRE, también a 0 %: es aquí donde se
 * ponen, y una fila que solo aparece cuando ya tiene valor no se encuentra nunca.
 * La de «Costes directos» solo cuando hay CI, que es cuando deja de ser el PEM y
 * la cuenta necesita verse. En el papel, en cambio, un 0 % no imprime nada.
 */
export function ResumenSheet({
  data,
  onRates,
  ciPropuesto,
}: {
  data: ResumenListado;
  /** Edición de tasas (ci/gg/bi/iva). */
  onRates?: (patch: Partial<Rates>) => void;
  /** % de CI que declaran mayoritariamente las partidas importadas de un banco
   *  (chip «CI x%»), para ofrecerlo cuando la obra aún no tiene indirectos. */
  ciPropuesto?: number;
}) {
  const { rows, cd, ci, pem, gg, bi, pec, iva, total, rates } = data;
  // La propuesta se descarta por sesión: es un ofrecimiento, no una tarea
  // pendiente que deba perseguir al usuario hoja tras hoja.
  const [propuestaOff, setPropuestaOff] = useState(false);
  const ofrece = !propuestaOff && rates.ci === 0 && ciPropuesto != null && ciPropuesto > 0;

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
        {ci > 0 && (
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Costes directos (suma de capítulos)</span>
            <span className={`mono ${styles.totalVal}`}>{fmtCents(cd)}</span>
          </div>
        )}
        <PctRow
          label="Costes indirectos"
          ayuda={AYUDA.ci}
          rate={rates.ci}
          value={ci}
          color="color-mix(in srgb, var(--accent) 70%, var(--bg-elevated))"
          onRate={(r) => onRates?.({ ci: r })}
        >
          {ofrece && (
            <div className={styles.ciHint}>
              <Icon name="help" size={13} />
              <span className={styles.ciHintText}>
                Las partidas importadas declaran un CI del{' '}
                <b className="mono">{fmtNum(ciPropuesto, 1)}%</b> en su banco de origen; este
                presupuesto aún no lo aplica.
              </span>
              <button
                type="button"
                className={styles.ciApply}
                onClick={() => onRates?.({ ci: pctToRate(ciPropuesto) })}
              >
                Aplicar {fmtNum(ciPropuesto, 1)}%
              </button>
              <button
                type="button"
                className={styles.ciDismiss}
                aria-label="Descartar la propuesta de costes indirectos"
                onClick={() => setPropuestaOff(true)}
              >
                <Icon name="x" size={13} />
              </button>
            </div>
          )}
        </PctRow>
        <div className={styles.pemRow}>
          <span className={styles.pemLabel}>
            Presupuesto de Ejecución Material (PEM)
            <InfoTip term="PEM">{AYUDA.pem}</InfoTip>
          </span>
          <span className={`mono ${styles.pemVal}`}>{fmtCents(pem)}</span>
        </div>
        <PctRow
          label="Gastos generales"
          ayuda={AYUDA.gg}
          rate={rates.gg}
          value={gg}
          color="color-mix(in srgb, var(--accent) 45%, var(--bg-elevated))"
          onRate={(r) => onRates?.({ gg: r })}
        />
        <PctRow
          label="Beneficio industrial"
          ayuda={AYUDA.bi}
          rate={rates.bi}
          value={bi}
          color="color-mix(in srgb, var(--accent) 25%, var(--bg-elevated))"
          onRate={(r) => onRates?.({ bi: r })}
        />
        <div className={`${styles.totalRow} ${styles.strong}`}>
          <span className={styles.totalLabel}>
            Presupuesto de Ejecución por Contrata (s/ IVA)
            <InfoTip term="PEC">{AYUDA.pec}</InfoTip>
          </span>
          <span className={`mono ${styles.totalVal}`}>{fmtCents(pec)}</span>
        </div>
        <div className={styles.pctRow}>
          <span className={styles.pctLeft}>
            <span className={styles.swatch} style={{ background: 'var(--text-disabled)' }} />
            <IvaSelect rate={rates.iva} onChange={(r) => onRates?.({ iva: r })} />
            <InfoTip term="IVA">{AYUDA.iva}</InfoTip>
          </span>
          <span className={`mono ${styles.pctVal}`}>{fmtCents(iva)}</span>
        </div>
        <div className={styles.bigRow}>
          <span className={styles.bigLabel}>
            Presupuesto base de licitación
            <InfoTip term="Presupuesto base de licitación" align="end">
              {AYUDA.licitacion}
            </InfoTip>
          </span>
          <span className={`mono ${styles.bigVal}`}>{fmtCents(total)}</span>
        </div>
      </div>
    </div>
  );
}

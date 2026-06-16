import { useState } from 'react';
import { Badge, EditableNum, EditableText, Icon } from '../../components';
import {
  cantidadToPct,
  certCalc,
  certPrecioK,
  estaCertDisplay,
  extraCalc,
  pctToCantidad,
  type CertSnapshot,
} from '../../core/certificacion';
import { fmtNum, round2, toEur } from '../../core/money';
import type { CertExtra, Partida } from '../../core/types';
import { useObraStore, type CertMode } from '../../store';
import { CertDetail } from './CertTable';
import { PctBar } from './PctBar';
import styles from './Certificaciones.module.css';

type Data = Record<string, number>;

/**
 * Tarjeta de certificación de una partida (modo compacto, <780). Mismos derivados
 * que la fila de tabla (`certCalc`); ejecutada y % editables, despliegue con
 * descripción + líneas de medición marcables (reusa `CertDetail`, F4.3).
 */
export function CertCard({
  p,
  curData,
  prevData,
  mode,
  coefK,
  snap,
}: {
  p: Partida;
  curData: Data;
  prevData: Data;
  mode: CertMode;
  coefK: number;
  snap?: CertSnapshot;
}) {
  const onCertEdit = useObraStore((s) => s.onCertEdit);
  const [expanded, setExpanded] = useState(false);
  const k = certCalc(p, curData, prevData, coefK, snap);
  const abono = mode === 'origen' ? k.aOrigen : k.estaCert;
  const execValue = mode === 'origen' ? k.ejecutada : estaCertDisplay(k.ejecutada, k.prev);
  const execPct = cantidadToPct(k.ofertada, execValue);
  // Precio mostrado = el de la valoración (congelado si la cert lo tiene, F7.0).
  const precioK = round2(certPrecioK(p, coefK, snap));

  return (
    <div className={`${styles.card} ${expanded ? styles.open : ''}`}>
      <div className={styles.cardHead} onClick={() => setExpanded((v) => !v)}>
        <div className={styles.cardTop}>
          <Icon
            name={expanded ? 'chevronDown' : 'chevron'}
            size={15}
            className={`${styles.chev} ${expanded ? styles.open : ''}`}
          />
          <div className={styles.cardId}>
            <span className={`mono ${styles.cardPos}`}>{p.pos}</span>
            <span className={`mono ${styles.cardCode}`}>{p.code}</span>
          </div>
          <span className={`mono ${styles.cardAbono}`}>{fmtNum(toEur(abono))}</span>
        </div>

        <div className={styles.cardTitleRow}>
          {p.mainType && <Badge type={p.mainType} />}
          {p.contradictorio && (
            <span className={styles.pcBadge}>
              <span className="dot" style={{ background: 'var(--state-warn)' }} />
              P.C.
            </span>
          )}
          <span className={styles.cardTitle}>{p.title}</span>
        </div>

        <div className={styles.cardStats}>
          <div className={styles.cStat}>
            <div className={`caps ${styles.cStatLabel}`}>Ud.</div>
            <div className={`mono ${styles.cStatVal}`}>{p.ud}</div>
          </div>
          <div className={styles.cStat}>
            <div className={`caps ${styles.cStatLabel}`}>Ofertada</div>
            <div className={`mono ${styles.cStatVal}`}>{fmtNum(k.ofertada)}</div>
          </div>
          <div className={`${styles.cStat} ${styles.last}`}>
            <div className={`caps ${styles.cStatLabel}`}>Precio €</div>
            <div className={`mono ${styles.cStatVal}`}>{fmtNum(precioK)}</div>
          </div>
        </div>

        <div className={styles.cardExec} onClick={(e) => e.stopPropagation()}>
          <div className={styles.cExecField}>
            <div className={`caps ${styles.cStatLabel}`}>
              {mode === 'origen' ? 'Ejec. a origen' : 'Ejec. esta cert.'}
            </div>
            <div className={`mono ${styles.cStatVal}`}>
              <EditableNum
                value={execValue}
                dec={2}
                accent
                ariaLabel="Cantidad ejecutada"
                onCommit={(v) => onCertEdit(p.id, v, mode)}
              />
            </div>
          </div>
          {k.ofertada > 0 && (
            <PctBar
              pct={execPct}
              onCommitPct={(pct) => onCertEdit(p.id, pctToCantidad(k.ofertada, pct), mode)}
            />
          )}
        </div>
      </div>

      {expanded && (
        <div className={styles.cardDetail}>
          <CertDetail p={p} />
        </div>
      )}
    </div>
  );
}

/** Tarjeta de un precio contradictorio (F4.4) en modo compacto. */
export function CertExtraCard({
  e,
  prevCantidad,
  mode,
}: {
  e: CertExtra;
  prevCantidad: number;
  mode: CertMode;
}) {
  const editContradictorio = useObraStore((s) => s.editContradictorio);
  const deleteContradictorio = useObraStore((s) => s.deleteContradictorio);
  const k = extraCalc(e, prevCantidad);
  const abono = mode === 'origen' ? k.aOrigen : k.estaCert;

  return (
    <div className={`${styles.card} ${styles.extraCard}`}>
      <div className={styles.cardHead}>
        <div className={styles.cardTop}>
          <span className={styles.pcBadge}>
            <span className="dot" style={{ background: 'var(--state-warn)' }} />
            P.C.
          </span>
          <span className={`mono ${styles.cardPos}`} style={{ flex: 1 }}>
            {e.pos}
          </span>
          <span className={`mono ${styles.cardAbono}`}>{fmtNum(toEur(abono))}</span>
          <button
            type="button"
            className={styles.extraDel}
            aria-label="Eliminar contradictorio"
            onClick={() => deleteContradictorio(e.id)}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>

        <div className={styles.cardTitleRow}>
          <EditableText
            value={e.title}
            ariaLabel="Título del contradictorio"
            placeholder="Descripción del precio contradictorio…"
            style={{ fontSize: 13 }}
            onCommit={(v) => editContradictorio(e.id, 'title', v)}
          />
        </div>

        <div className={styles.cardStats}>
          <div className={styles.cStat}>
            <div className={`caps ${styles.cStatLabel}`}>Ud.</div>
            <div className={`mono ${styles.cStatVal}`}>
              <EditableText
                value={e.ud}
                ariaLabel="Unidad"
                placeholder="ud"
                style={{ fontSize: 12.5 }}
                onCommit={(v) => editContradictorio(e.id, 'ud', v)}
              />
            </div>
          </div>
          <div className={styles.cStat}>
            <div className={`caps ${styles.cStatLabel}`}>Cantidad</div>
            <div className={`mono ${styles.cStatVal}`}>
              <EditableNum
                value={e.cantidad}
                dec={2}
                accent
                ariaLabel="Cantidad ejecutada"
                onCommit={(v) => editContradictorio(e.id, 'cantidad', v)}
              />
            </div>
          </div>
          <div className={`${styles.cStat} ${styles.last}`}>
            <div className={`caps ${styles.cStatLabel}`}>Precio €</div>
            <div className={`mono ${styles.cStatVal}`}>
              <EditableNum
                value={e.precio}
                dec={2}
                ariaLabel="Precio"
                onCommit={(v) => editContradictorio(e.id, 'precio', v)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

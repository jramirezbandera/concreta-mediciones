import { useState, type MouseEvent } from 'react';
import { Badge, ContraChip, EditableNum, EditableText, Icon } from '../../components';
import { fmtNum, toEur, type Cents } from '../../core/money';
import type { Partida } from '../../core/types';
import { usePartidaRow } from '../../hooks/usePartidaRow';
import { useObraStore } from '../../store';
import { DetailPanel } from './DetailPanel';
import { PartidaMenu } from './PartidaMenu';
import styles from './Presupuesto.module.css';

/** Chip "BASE": partida copiada de una base de precios hasta que se edita. */
function BaseChip({ source }: { source?: string }) {
  return (
    <span className={styles.baseChip} title={`Copiada de ${source || 'una base'} · edítala para confirmarla`}>
      BASE
    </span>
  );
}

/** No propagar el click al `<tr>` (que despliega) desde las celdas editables. */
function stop(e: MouseEvent) {
  e.stopPropagation();
}

/**
 * Fila de partida (F2.2): Nº·Código (con chevron), descripción (badge + título
 * editable + chips), Ud, Cantidad (derivada), Precio editable, Importe (+barra
 * de peso). Click en la fila despliega el panel de detalle (medición/descripción);
 * las celdas editables paran la propagación. Derivados vía `usePartidaRow` (T6).
 */
export function PartidaRow({
  p,
  chapterId,
  chapterTotal,
}: {
  p: Partida;
  chapterId: string;
  chapterTotal: Cents;
}) {
  const [expanded, setExpanded] = useState(false);
  const { cantidad, importe, pct } = usePartidaRow(p, chapterTotal);
  const editPartidaField = useObraStore((s) => s.editPartidaField);
  const setPrecio = useObraStore((s) => s.setPrecio);

  return (
    <>
      <tr
        className={`tcol ${styles.row} ${expanded ? styles.expanded : ''}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className={styles.cNum}>
          <div className={styles.numFlex}>
            <Icon
              name={expanded ? 'chevronDown' : 'chevron'}
              size={13}
              className={`${styles.chevIcon} ${expanded ? styles.open : ''}`}
            />
            <div className={styles.numInner}>
              <div className={`mono ${styles.pos}`}>{p.pos}</div>
              <div className={`mono ${styles.code}`}>{p.code}</div>
            </div>
          </div>
        </td>
        <td className={styles.cDesc} onClick={stop}>
          <div className={styles.descInner}>
            {p.mainType && <Badge type={p.mainType} />}
            <EditableText
              value={p.title}
              ariaLabel="Título de la partida"
              placeholder="Título de la partida…"
              className={styles.title}
              onCommit={(v) => editPartidaField(chapterId, p.id, 'title', v)}
            />
            {p.fromBase && <BaseChip source={p.baseSource} />}
            {p.contradictorio && <ContraChip />}
          </div>
        </td>
        <td className={`mono ${styles.cUd}`}>{p.ud}</td>
        <td className={`mono ${styles.cQty}`}>
          <span className={styles.qtyNum}>{fmtNum(cantidad)}</span>
        </td>
        <td className={styles.priceCellEdit} onClick={stop}>
          <EditableNum
            value={p.precio}
            dec={2}
            ariaLabel="Precio unitario"
            onCommit={(v) => setPrecio(chapterId, p.id, v)}
          />
        </td>
        <td className={styles.cImporte}>
          <div className={`mono ${styles.importeNum}`}>{fmtNum(toEur(importe))}</div>
          <div className={styles.weightTrack}>
            <div className={styles.weightFill} style={{ width: `${Math.max(3, pct)}%` }} />
          </div>
        </td>
        <td className={styles.cMenu} onClick={stop}>
          <PartidaMenu p={p} chapterId={chapterId} />
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className={styles.detailCell}>
            <DetailPanel p={p} chapterId={chapterId} />
          </td>
        </tr>
      )}
    </>
  );
}

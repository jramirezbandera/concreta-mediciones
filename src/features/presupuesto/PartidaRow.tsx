import { memo, type MouseEvent } from 'react';
import { Badge, CiChip, ContraChip, EditableNum, EditableText, Icon, UdSelect } from '../../components';
import { fmtNum, toEur } from '../../core/money';
import type { Partida } from '../../core/types';
import { useJustRevealed } from '../../hooks/useJustRevealed';
import { usePartidaRow } from '../../hooks/usePartidaRow';
import { useObraStore } from '../../store';
import { DetailPanel } from './DetailPanel';
import { PartidaMenu } from './PartidaMenu';
import { WeightBar } from './WeightBar';
import styles from './Presupuesto.module.css';

/** No propagar el click al `<tr>` (que selecciona/despliega) desde un control
 *  editable. Se envuelve SOLO el widget, no la celda entera, para que el espacio
 *  vacío de la fila (incluida la banda de la descripción) siga seleccionando. */
function stop(e: MouseEvent) {
  e.stopPropagation();
}

/**
 * Fila de partida (F2.2): Nº·Código (con chevron), descripción (badge + título
 * editable + chips), Ud, Cantidad (derivada), Precio editable, Importe (+barra
 * de peso). Click en la ZONA VACÍA de la fila la selecciona y despliega su panel
 * de detalle (medición/descripción); los controles editables paran la
 * propagación. La fila abierta ES la seleccionada (single-open, en el store).
 *
 * MEMOIZADA por `p`/`chapterId` (T1.1): editar otra partida del capítulo no
 * re-renderiza esta fila. El peso % vive en `WeightBar` (contexto) para que el
 * cambio del total del capítulo tampoco re-renderice la fila entera, solo la
 * barra. Derivados vía `usePartidaRow` (T6).
 */
export const PartidaRow = memo(function PartidaRow({
  p,
  chapterId,
}: {
  p: Partida;
  chapterId: string;
}) {
  const { cantidad, importe, isOverride, descompUnit } = usePartidaRow(p);
  const editPartidaField = useObraStore((s) => s.editPartidaField);
  const setPrecio = useObraStore((s) => s.setPrecio);
  const open = useObraStore((s) => s.openPartidaId === p.id);
  const togglePartida = useObraStore((s) => s.togglePartida);
  const justRevealed = useJustRevealed(p.id);

  return (
    <>
      <tr
        id={`partida-${p.id}`}
        className={`tcol ${styles.row} ${open ? `${styles.expanded} ${styles.selected}` : ''} ${justRevealed ? styles.justRevealed : ''}`}
        aria-selected={open}
        onClick={() => togglePartida(p.id)}
      >
        <td className={styles.cNum}>
          <div className={styles.numFlex}>
            <Icon
              name={open ? 'chevronDown' : 'chevron'}
              size={13}
              className={`${styles.chevIcon} ${open ? styles.open : ''}`}
            />
            <div className={styles.numInner}>
              <div className={`mono ${styles.pos}`}>{p.pos}</div>
              <div className={`mono ${styles.code}`}>{p.code}</div>
            </div>
          </div>
        </td>
        <td className={styles.cDesc}>
          <div className={styles.descInner}>
            {p.mainType && <Badge type={p.mainType} />}
            <span onClick={stop}>
              <EditableText
                value={p.title}
                ariaLabel="Título de la partida"
                placeholder="Título de la partida…"
                className={styles.title}
                onCommit={(v) => editPartidaField(chapterId, p.id, 'title', v)}
              />
            </span>
            {p.contradictorio && <ContraChip />}
            {p.ciPct != null && p.ciPct > 0 && <CiChip pct={p.ciPct} />}
          </div>
        </td>
        <td className={`mono ${styles.cUd}`}>
          <span onClick={stop}>
            <UdSelect
              value={p.ud}
              ariaLabel="Unidad de medida de la partida"
              onCommit={(v) => editPartidaField(chapterId, p.id, 'ud', v)}
            />
          </span>
        </td>
        <td className={`mono ${styles.cQty}`}>
          <span className={styles.qtyNum}>{fmtNum(cantidad)}</span>
        </td>
        <td
          className={styles.priceCellEdit}
          title={
            isOverride
              ? `Precio fijado a mano (no coincide con su descompuesto: ${fmtNum(descompUnit)} €)`
              : undefined
          }
        >
          {isOverride && <span className={styles.overrideDot} aria-hidden="true" />}
          <span onClick={stop}>
            <EditableNum
              value={p.precio}
              dec={2}
              ariaLabel="Precio unitario"
              onCommit={(v) => setPrecio(chapterId, p.id, v)}
            />
          </span>
        </td>
        <td className={styles.cImporte}>
          <div className={`mono ${styles.importeNum}`}>{fmtNum(toEur(importe))}</div>
          <WeightBar importe={importe} />
        </td>
        <td className={styles.cMenu} onClick={stop}>
          <PartidaMenu p={p} chapterId={chapterId} />
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className={styles.detailCell}>
            <DetailPanel p={p} chapterId={chapterId} />
          </td>
        </tr>
      )}
    </>
  );
});

import { memo, useCallback, type KeyboardEvent, type MouseEvent } from 'react';
import { Badge, CiChip, ContraChip, EditableNum, EditableText, Icon, UdSelect } from '../../components';
import { fmtNum, toEur } from '../../core/money';
import type { Partida } from '../../core/types';
import { armNextEdit, neighborEditCell } from '../../hooks/editGridNav';
import { useJustRevealed } from '../../hooks/useJustRevealed';
import { usePartidaRow } from '../../hooks/usePartidaRow';
import { useReorderSource, useReorderTarget, type ReorderDrag } from '../../hooks/useReorderDrag';
import { useObraStore } from '../../store';
import { DetailPanel } from './DetailPanel';
import { PartidaMenu } from './PartidaMenu';
import { precioOrigenSignal } from './precioOrigen';
import { WeightBar } from './WeightBar';
import styles from './Presupuesto.module.css';

/** No propagar el click al `<tr>` (que selecciona/despliega) desde un control
 *  editable. Se envuelve SOLO el widget, no la celda entera, para que el espacio
 *  vacío de la fila (incluida la banda de la descripción) siga seleccionando. */
function stop(e: MouseEvent) {
  e.stopPropagation();
}

/** Tab / Shift+Tab dentro de una celda editable de la fila (Cantidad ↔ Precio):
 *  pasa a la celda vecina y la ABRE en edición —como el grid de medición—, para
 *  no tener que hacer click para editar. La fila es su propio `[data-editgrid]`;
 *  fuera de esas celdas (título, ud) el `from` no está en un `[data-editfield]`
 *  → `neighborEditCell` devuelve null y el Tab nativo sigue su curso. */
function tabEditCells(e: KeyboardEvent<HTMLTableRowElement>) {
  if (e.key !== 'Tab') return;
  const t = e.target as HTMLElement;
  if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA') return; // no en el input de edición
  const next = neighborEditCell(t, e.shiftKey ? -1 : 1);
  if (!next) return; // borde de la fila: deja salir el foco (Tab nativo)
  e.preventDefault();
  armNextEdit(next);
  next.focus();
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
  prevId = null,
  nextId = null,
}: {
  p: Partida;
  chapterId: string;
  /** Id de la partida ANTERIOR de su mismo grupo (`null` = es la primera). */
  prevId?: string | null;
  /** Id de la partida SIGUIENTE de su mismo grupo (`null` = es la última). Es
   *  el destino de «soltar debajo de esta fila»; primitivos, no arrays, para no
   *  romper la memoización (T1.1). */
  nextId?: string | null;
}) {
  const { cantidad, importe, origen, descompUnit } = usePartidaRow(p);
  // Señal de origen del precio (descompuesto / a mano / directo), común a la
  // fila, la tarjeta móvil y el panel de justificación.
  const precio = precioOrigenSignal(origen, descompUnit, p.items.length);
  const editPartidaField = useObraStore((s) => s.editPartidaField);
  const setPrecio = useObraStore((s) => s.setPrecio);
  const setCantidad = useObraStore((s) => s.setCantidad);
  // Sin medición → la cantidad es un dato editable (cantidad fija); con líneas,
  // es la Σ derivada y se muestra en solo-lectura.
  const sinMedicion = p.med.length === 0;
  const open = useObraStore((s) => s.openPartidaId === p.id);
  const togglePartida = useObraStore((s) => s.togglePartida);
  const reorderPartida = useObraStore((s) => s.reorderPartida);
  const justRevealed = useJustRevealed(p.id);

  // Arrastrar para reordenar dentro del capítulo (el asa vive en la columna Nº).
  const drag = useReorderSource(
    useCallback(
      (): ReorderDrag => ({ kind: 'partida', id: p.id, scope: chapterId }),
      [p.id, chapterId],
    ),
  );
  const drop = useReorderTarget(
    useCallback(
      (d: ReorderDrag) => d.kind === 'partida' && d.scope === chapterId && d.id !== p.id,
      [chapterId, p.id],
    ),
    useCallback(
      (d: ReorderDrag, place: 'before' | 'after') => {
        // Soltar en la mitad de abajo = delante de la SIGUIENTE del grupo (o al
        // final si no hay). Se pasa también el sub de esta fila: arrastrar entre
        // grupos del capítulo cambia de subcapítulo, como en Arquímedes.
        reorderPartida(chapterId, d.id, place === 'before' ? p.id : nextId, p.sub ?? null);
      },
      [chapterId, nextId, p.id, p.sub, reorderPartida],
    ),
  );

  return (
    <>
      <tr
        id={`partida-${p.id}`}
        data-editgrid=""
        data-editrow=""
        className={`tcol ${styles.row} ${open ? `${styles.expanded} ${styles.selected}` : ''} ${justRevealed ? styles.justRevealed : ''} ${drag.dragging ? styles.dragging : ''} ${drop.place === 'before' ? styles.dropBefore : ''} ${drop.place === 'after' ? styles.dropAfter : ''}`}
        aria-selected={open}
        onClick={() => togglePartida(p.id)}
        onKeyDown={tabEditCells}
        {...drag.source}
        {...drop.events}
      >
        <td className={styles.cNum}>
          <div className={styles.numFlex}>
            <span
              className={styles.grip}
              aria-hidden="true"
              title="Arrastra para cambiar el orden"
              {...drag.handle}
            >
              <Icon name="grip" size={12} />
            </span>
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
        <td
          className={`mono ${styles.cQty}`}
          data-editfield={sinMedicion ? '' : undefined}
          data-col={sinMedicion ? 0 : undefined}
          title={sinMedicion ? 'Cantidad fija (sin líneas de medición)' : undefined}
        >
          {sinMedicion ? (
            <span onClick={stop}>
              <EditableNum
                value={cantidad}
                dec={2}
                ariaLabel="Cantidad de la partida (sin medición)"
                onCommit={(v) => setCantidad(chapterId, p.id, v)}
              />
            </span>
          ) : (
            <span className={styles.qtyNum}>{fmtNum(cantidad)}</span>
          )}
        </td>
        <td className={styles.priceCellEdit} data-editfield="" data-col={1} title={precio.title}>
          {precio.dot && <span className={styles.overrideDot} aria-hidden="true" />}
          <span onClick={stop}>
            <EditableNum
              value={p.precio}
              dec={2}
              accent={precio.accent}
              ariaLabel="Precio unitario"
              onCommit={(v) => setPrecio(chapterId, p.id, v)}
            />
          </span>
          <span className={styles.srOnly}>{precio.sr}</span>
        </td>
        <td className={styles.cImporte}>
          <div className={`mono ${styles.importeNum}`}>{fmtNum(toEur(importe))}</div>
          <WeightBar importe={importe} />
        </td>
        <td className={styles.cMenu} onClick={stop}>
          <PartidaMenu p={p} chapterId={chapterId} canUp={!!prevId} canDown={!!nextId} />
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

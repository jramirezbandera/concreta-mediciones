import { memo, useCallback, type DragEvent } from 'react';
import { Icon } from '../../components';
import { lineParcial } from '../../core/medicion';
import type { MedCol } from '../../core/medForma';
import { fmtNum } from '../../core/money';
import type { MedLine } from '../../core/types';
import { useReorderSource, useReorderTarget, type ReorderDrag } from '../../hooks/useReorderDrag';
import { useObraStore } from '../../store';
import { deleteLines, moveLineTo, toggleLine } from '../../store/medLineOps';
import { useMedUiStore } from '../../store/medUiStore';
import check from '../../styles/lineCheck.module.css';
import { decOf } from './format';
import { MedComment, MedNum } from './MedCells';
import styles from './Presupuesto.module.css';

/**
 * Fila de la tabla de medición (escritorio). Primera columna: asa de arrastre
 * (reordena UNA línea dentro de su partida) y casilla de selección. Se suscribe
 * SOLO a si ella está seleccionada: marcar una casilla re-renderiza las filas
 * que cambian, no la tabla. Memoizada: `cols` llega memoizado desde el panel.
 */
export const MedLineRow = memo(function MedLineRow({
  line,
  index,
  cols,
  chapterId,
  partidaId,
  nextId,
  touch,
}: {
  line: MedLine;
  index: number;
  cols: MedCol[];
  chapterId: string;
  partidaId: string;
  /** Línea siguiente (`null` = es la última): destino de «soltar debajo». */
  nextId: string | null;
  /** Solo táctil: sin asa (no hay arrastre) y casilla y X siempre visibles. */
  touch: boolean;
}) {
  const editMedLine = useObraStore((s) => s.editMedLine);
  const selected = useMedUiStore((s) => s.partidaId === partidaId && s.selected.includes(line.id));
  const comment = line.comment.trim();

  const drag = useReorderSource(
    useCallback((): ReorderDrag => ({ kind: 'medline', id: line.id, scope: partidaId }), [line.id, partidaId]),
  );
  const drop = useReorderTarget(
    useCallback(
      (d: ReorderDrag) => d.kind === 'medline' && d.scope === partidaId && d.id !== line.id,
      [line.id, partidaId],
    ),
    useCallback(
      (d: ReorderDrag, place: 'before' | 'after') =>
        moveLineTo(partidaId, d.id, place === 'before' ? line.id : nextId),
      [line.id, nextId, partidaId],
    ),
  );

  return (
    <tr
      className={`med-row ${styles.medRow} ${selected ? styles.lineSelected : ''} ${drag.dragging ? styles.dragging : ''} ${drop.place === 'before' ? styles.dropBefore : ''} ${drop.place === 'after' ? styles.dropAfter : ''}`}
      data-editrow=""
      data-lineid={line.id}
      aria-selected={selected}
      draggable={drag.source.draggable}
      onDragStart={(e: DragEvent) => {
        useMedUiStore.getState().clearSelection(); // el arrastre mueve UNA línea
        drag.source.onDragStart(e);
      }}
      onDragEnd={drag.source.onDragEnd}
      {...drop.events}
    >
      <td className={`${styles.medTd} ${styles.medSelTd}`}>
        <div className={styles.medSelInner}>
          {!touch && (
            <span
              className={styles.medGrip}
              aria-hidden="true"
              title="Arrastra para cambiar el orden · Alt+↑/↓"
              {...drag.handle}
            >
              <Icon name="grip" size={12} />
            </span>
          )}
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={`Seleccionar línea: ${comment || `línea ${index + 1}`}`}
            tabIndex={-1}
            data-linecheck=""
            className={`tap-target ${check.lineCheck} ${selected ? check.on : ''} ${styles.medCheck}`}
            // macOS (Safari/Firefox) no enfoca un botón al hacer click: el foco
            // se lleva a mano para que los atajos sepan dónde estás.
            onPointerDown={(e) => e.currentTarget.focus()}
            onClick={(e) => toggleLine(partidaId, line.id, e.shiftKey)}
          >
            {selected && <Icon name="check" size={12} />}
          </button>
        </div>
      </td>
      <td className={`${styles.medTd} ${styles.medTdComment}`} data-editfield="" data-col="0">
        <MedComment
          value={line.comment}
          ariaLabel="Comentario de la línea"
          onCommit={(v) => editMedLine(chapterId, partidaId, index, 'comment', v)}
        />
      </td>
      {cols.map((c, ci) => (
        <td key={c.slot} className={styles.medTd} data-editfield="" data-col={ci + 1}>
          <MedNum
            value={line[c.slot]}
            expr={line.expr?.[c.slot]}
            dec={c.slot === 'uds' ? decOf(line.uds) : undefined}
            ariaLabel={c.slot === 'uds' ? 'Unidades' : c.label}
            onCommit={(v, ex) => editMedLine(chapterId, partidaId, index, c.slot, v, ex)}
          />
        </td>
      ))}
      <td className={`mono ${styles.medTd} ${styles.medParcial}`}>{fmtNum(lineParcial(line))}</td>
      <td className={`${styles.medTd} ${styles.medDelTd}`}>
        <button
          type="button"
          title="Eliminar línea"
          aria-label={`Eliminar línea: ${comment || `línea ${index + 1}`}`}
          data-del=""
          className={`tcol med-del ${styles.medDelBtn}`}
          onClick={() => deleteLines(partidaId, [line.id], { col: 'del' })}
        >
          <Icon name="x" size={14} />
        </button>
      </td>
    </tr>
  );
});

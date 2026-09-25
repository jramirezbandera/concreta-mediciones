import { memo, type ReactNode } from 'react';
import { Icon } from '../../components';
import { lineParcial } from '../../core/medicion';
import type { MedCol } from '../../core/medForma';
import { fmtNum } from '../../core/money';
import type { MedLine, Partida } from '../../core/types';
import { useMedGridTab } from '../../hooks/useMedGridTab';
import { useMedLineKeys } from '../../hooks/useMedLineKeys';
import { useObraStore } from '../../store';
import { deleteLines, toggleLine } from '../../store/medLineOps';
import { useMedUiStore } from '../../store/medUiStore';
import check from '../../styles/lineCheck.module.css';
import { FUERA_TITLE, decOf } from './format';
import { MedComment, MedNum } from './MedCells';
import { CutTag } from './MedLineRow';
import { useIsCut } from './useIsCut';
import styles from './Presupuesto.module.css';

/** Campo etiquetado (Uds/Longitud/…) para la medición en tarjeta. `col` marca la
 *  columna para la navegación de teclado (Tab/Enter). */
function MedField({
  label,
  col,
  fuera = false,
  children,
}: {
  label: string;
  col: number;
  fuera?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.medField}>
      <span
        className={`caps ${styles.medFieldLabel} ${fuera ? styles.medThFuera : ''}`}
        title={fuera ? FUERA_TITLE : undefined}
      >
        {label}
      </span>
      <div className={styles.medFieldBox} data-editfield="" data-col={col}>
        {children}
      </div>
    </div>
  );
}

/** Tarjeta de UNA línea: casilla de selección + comentario + X, sus casillas y
 *  su parcial. Sin menú ⋮: la barra de selección es la única superficie de
 *  acciones (copiar, cortar, duplicar, subir, bajar, eliminar). */
const MedLineCard = memo(function MedLineCard({
  line,
  index,
  cols,
  chapterId,
  partidaId,
}: {
  line: MedLine;
  index: number;
  cols: MedCol[];
  chapterId: string;
  partidaId: string;
}) {
  const editMedLine = useObraStore((s) => s.editMedLine);
  const selected = useMedUiStore((s) => s.partidaId === partidaId && s.selected.includes(line.id));
  const cut = useIsCut(partidaId, line.id);
  const name = line.comment.trim() || `línea ${index + 1}`;
  return (
    <div
      className={`${styles.medCard} ${selected ? styles.cardSelected : ''} ${cut ? styles.lineCut : ''}`}
      data-editrow=""
      data-lineid={line.id}
      aria-selected={selected}
    >
      <div className={styles.medCardTop}>
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={`Seleccionar línea: ${name}`}
          tabIndex={-1}
          data-linecheck=""
          className={`tap-target ${check.lineCheck} ${selected ? check.on : ''}`}
          onPointerDown={(e) => e.currentTarget.focus()}
          onClick={(e) => toggleLine(partidaId, line.id, e.shiftKey)}
        >
          {selected && <Icon name="check" size={12} />}
        </button>
        <span style={{ flex: 1, minWidth: 0 }} data-editfield="" data-col="0">
          <MedComment
            value={line.comment}
            ariaLabel="Comentario de la línea"
            onCommit={(v) => editMedLine(chapterId, partidaId, index, 'comment', v)}
          />
        </span>
        {cut && <CutTag />}
        <button
          type="button"
          title="Eliminar línea"
          aria-label={`Eliminar línea: ${name}`}
          data-del=""
          className={`tcol ${styles.medDelCard}`}
          onClick={() => deleteLines(partidaId, [line.id], { col: 'del' })}
        >
          <Icon name="x" size={15} />
        </button>
      </div>
      <div
        className={styles.medGrid}
        style={{ gridTemplateColumns: `repeat(${Math.max(cols.length, 2)}, 1fr)` }}
      >
        {cols.map((c, ci) => (
          <MedField key={c.slot} label={c.label} col={ci + 1} fuera={c.fuera}>
            <MedNum
              value={line[c.slot]}
              expr={line.expr?.[c.slot]}
              dec={c.slot === 'uds' ? decOf(line.uds) : undefined}
              align="center"
              ariaLabel={c.slot === 'uds' ? 'Unidades' : c.label}
              onCommit={(v, ex) => editMedLine(chapterId, partidaId, index, c.slot, v, ex)}
            />
          </MedField>
        ))}
      </div>
      <div className={styles.medCardFoot}>
        <span className={`caps ${styles.medCardParcLabel}`}>Parcial</span>
        <span className={`mono ${styles.medCardParcVal}`}>{fmtNum(lineParcial(line))}</span>
      </div>
    </div>
  );
});

/** Medición en tarjetas (modo compacto, <780). Misma semántica que la tabla. */
export function MedCards({
  p,
  chapterId,
  cols,
  emptyText,
}: {
  p: Partida;
  chapterId: string;
  cols: MedCol[];
  emptyText: string;
}) {
  const addMedLine = useObraStore((s) => s.addMedLine);
  const med = p.med ?? [];
  const medTab = useMedGridTab(() => addMedLine(chapterId, p.id), med.length);
  const lineKeys = useMedLineKeys(p.id);

  if (med.length === 0) return <div className={styles.medCardsEmpty}>{emptyText}</div>;

  return (
    <div
      ref={medTab.ref}
      data-editgrid=""
      data-medgrid={p.id}
      className={styles.medCardList}
      onKeyDown={medTab.onKeyDown}
      {...lineKeys}
    >
      {med.map((l, i) => (
        <MedLineCard key={l.id} line={l} index={i} cols={cols} chapterId={chapterId} partidaId={p.id} />
      ))}
    </div>
  );
}

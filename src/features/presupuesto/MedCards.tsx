import type { ReactNode } from 'react';
import { Icon } from '../../components';
import { lineParcial } from '../../core/medicion';
import { medColumnas, medFormaDe } from '../../core/medForma';
import { fmtNum } from '../../core/money';
import type { Partida } from '../../core/types';
import { useMedGridTab } from '../../hooks/useMedGridTab';
import { useObraStore } from '../../store';
import { FUERA_TITLE, decOf } from './format';
import { MedComment, MedNum } from './MedCells';
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

/** Medición en tarjetas (modo compacto, <780). Misma semántica que la tabla. */
export function MedCards({ p, chapterId }: { p: Partida; chapterId: string }) {
  const editMedLine = useObraStore((s) => s.editMedLine);
  const deleteMedLine = useObraStore((s) => s.deleteMedLine);
  const addMedLine = useObraStore((s) => s.addMedLine);
  const med = p.med ?? [];
  const cols = medColumnas(medFormaDe(p), med);
  const medTab = useMedGridTab(() => addMedLine(chapterId, p.id), med.length);

  if (med.length === 0) {
    return (
      <div className={styles.medCardsEmpty}>
        Sin líneas de medición. Añade la primera para calcular la cantidad; encadena celdas con
        Tab y baja con Enter.
      </div>
    );
  }

  return (
    <div ref={medTab.ref} data-editgrid="" className={styles.medCardList} onKeyDown={medTab.onKeyDown}>
      {med.map((l, i) => (
        <div key={l.id} className={styles.medCard} data-editrow="">
          <div className={styles.medCardTop}>
            <span style={{ flex: 1, minWidth: 0 }} data-editfield="" data-col="0">
              <MedComment
                value={l.comment}
                ariaLabel="Comentario de la línea"
                onCommit={(v) => editMedLine(chapterId, p.id, i, 'comment', v)}
              />
            </span>
            <button
              type="button"
              title="Eliminar línea"
              className={`tcol ${styles.medDelCard}`}
              onClick={() => deleteMedLine(chapterId, p.id, i)}
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
                  value={l[c.slot]}
                  expr={l.expr?.[c.slot]}
                  dec={c.slot === 'uds' ? decOf(l.uds) : undefined}
                  align="center"
                  ariaLabel={c.slot === 'uds' ? 'Unidades' : c.label}
                  onCommit={(v, ex) => editMedLine(chapterId, p.id, i, c.slot, v, ex)}
                />
              </MedField>
            ))}
          </div>
          <div className={styles.medCardFoot}>
            <span className={`caps ${styles.medCardParcLabel}`}>Parcial</span>
            <span className={`mono ${styles.medCardParcVal}`}>{fmtNum(lineParcial(l))}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

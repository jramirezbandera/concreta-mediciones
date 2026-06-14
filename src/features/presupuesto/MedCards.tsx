import type { ReactNode } from 'react';
import { Icon } from '../../components';
import { lineParcial } from '../../core/medicion';
import { fmtNum } from '../../core/money';
import type { Partida } from '../../core/types';
import { useMedGridTab } from '../../hooks/useMedGridTab';
import { useObraStore } from '../../store';
import { decOf } from './format';
import { MedComment, MedNum } from './MedCells';
import styles from './Presupuesto.module.css';

/** Campo etiquetado (Uds/Longitud/…) para la medición en tarjeta. `col` marca la
 *  columna para la navegación de teclado (Tab/Enter). */
function MedField({ label, col, children }: { label: string; col: number; children: ReactNode }) {
  return (
    <div className={styles.medField}>
      <span className={`caps ${styles.medFieldLabel}`}>{label}</span>
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
  const medTab = useMedGridTab(() => addMedLine(chapterId, p.id), med.length);

  if (med.length === 0) {
    return (
      <div className={styles.medCardsEmpty}>
        Sin líneas de medición. Añade la primera para calcular la cantidad.
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
          <div className={styles.medGrid}>
            <MedField label="Uds" col={1}>
              <MedNum
                value={l.uds}
                dec={decOf(l.uds)}
                align="center"
                ariaLabel="Unidades"
                onCommit={(v) => editMedLine(chapterId, p.id, i, 'uds', v)}
              />
            </MedField>
            <MedField label="Longitud" col={2}>
              <MedNum
                value={l.largo}
                align="center"
                ariaLabel="Longitud"
                onCommit={(v) => editMedLine(chapterId, p.id, i, 'largo', v)}
              />
            </MedField>
            <MedField label="Anchura" col={3}>
              <MedNum
                value={l.ancho}
                align="center"
                ariaLabel="Anchura"
                onCommit={(v) => editMedLine(chapterId, p.id, i, 'ancho', v)}
              />
            </MedField>
            <MedField label="Altura" col={4}>
              <MedNum
                value={l.alto}
                align="center"
                ariaLabel="Altura"
                onCommit={(v) => editMedLine(chapterId, p.id, i, 'alto', v)}
              />
            </MedField>
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

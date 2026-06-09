import type { ReactNode } from 'react';
import { Icon } from '../../components';
import { lineParcial } from '../../core/medicion';
import { fmtNum } from '../../core/money';
import type { Partida } from '../../core/types';
import { useObraStore } from '../../store';
import { decOf } from './format';
import { MedComment, MedNum } from './MedCells';
import styles from './Presupuesto.module.css';

/** Campo etiquetado (Uds/Longitud/…) para la medición en tarjeta. */
function MedField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.medField}>
      <span className={`caps ${styles.medFieldLabel}`}>{label}</span>
      <div className={styles.medFieldBox}>{children}</div>
    </div>
  );
}

/** Medición en tarjetas (modo compacto, <780). Misma semántica que la tabla. */
export function MedCards({ p, chapterId }: { p: Partida; chapterId: string }) {
  const editMedLine = useObraStore((s) => s.editMedLine);
  const deleteMedLine = useObraStore((s) => s.deleteMedLine);
  const med = p.med ?? [];

  if (med.length === 0) {
    return (
      <div className={styles.medCardsEmpty}>
        Sin líneas de medición. Añade la primera para calcular la cantidad.
      </div>
    );
  }

  return (
    <div className={styles.medCardList}>
      {med.map((l, i) => (
        <div key={i} className={styles.medCard}>
          <div className={styles.medCardTop}>
            <span style={{ flex: 1, minWidth: 0 }}>
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
            <MedField label="Uds">
              <MedNum
                value={l.uds}
                dec={decOf(l.uds)}
                align="center"
                ariaLabel="Unidades"
                onCommit={(v) => editMedLine(chapterId, p.id, i, 'uds', v)}
              />
            </MedField>
            <MedField label="Longitud">
              <MedNum
                value={l.largo}
                align="center"
                ariaLabel="Longitud"
                onCommit={(v) => editMedLine(chapterId, p.id, i, 'largo', v)}
              />
            </MedField>
            <MedField label="Anchura">
              <MedNum
                value={l.ancho}
                align="center"
                ariaLabel="Anchura"
                onCommit={(v) => editMedLine(chapterId, p.id, i, 'ancho', v)}
              />
            </MedField>
            <MedField label="Altura">
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

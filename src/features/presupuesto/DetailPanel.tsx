import { useState } from 'react';
import { EditableText, Icon } from '../../components';
import { lineParcial, medTotal } from '../../core/medicion';
import { fmtNum } from '../../core/money';
import type { Partida } from '../../core/types';
import { useGridNav } from '../../hooks/useGridNav';
import { useObraStore } from '../../store';
import { decOf } from './format';
import { MedCards } from './MedCards';
import { MedComment, MedNum } from './MedCells';
import { PriceJustif } from './PriceJustif';
import { PriceJustifCards } from './PriceJustifCards';
import styles from './Presupuesto.module.css';

type Tab = 'medicion' | 'descripcion' | 'justif';

/**
 * Panel de detalle de una partida: toggle segmentado Medición / Descripción /
 * Justificación del precio. La Medición edita líneas (uds·largo·ancho·alto →
 * parcial) y el total alimenta la cantidad de la partida en vivo. En modo
 * `compact` (<780, F2.5) la medición y la justificación pasan a tarjetas.
 */
export function DetailPanel({
  p,
  chapterId,
  compact = false,
}: {
  p: Partida;
  chapterId: string;
  compact?: boolean;
}) {
  const [tab, setTab] = useState<Tab>('medicion');
  const gridNav = useGridNav();
  const editPartidaField = useObraStore((s) => s.editPartidaField);
  const addMedLine = useObraStore((s) => s.addMedLine);
  const editMedLine = useObraStore((s) => s.editMedLine);
  const deleteMedLine = useObraStore((s) => s.deleteMedLine);

  const med = p.med ?? [];
  const total = medTotal(med);

  return (
    <div className={`${styles.detail} ${compact ? styles.compact : ''}`}>
      <div className={styles.detailBar}>
        <div className={styles.seg}>
          <button
            type="button"
            className={`tcol ${styles.segBtn} ${tab === 'medicion' ? styles.on : ''}`}
            onClick={() => setTab('medicion')}
          >
            Medición
            <span className={`mono ${styles.segCount}`}>{med.length}</span>
          </button>
          <button
            type="button"
            className={`tcol ${styles.segBtn} ${tab === 'descripcion' ? styles.on : ''}`}
            onClick={() => setTab('descripcion')}
          >
            Descripción
          </button>
          <button
            type="button"
            className={`tcol ${styles.segBtn} ${tab === 'justif' ? styles.on : ''}`}
            onClick={() => setTab('justif')}
          >
            Justificación del precio
            {p.items.length > 0 && <span className={`mono ${styles.segCount}`}>{p.items.length}</span>}
          </button>
        </div>
        {!compact && (
          <div
            className={styles.detailQty}
            style={{ visibility: tab === 'medicion' ? 'hidden' : 'visible' }}
          >
            <span className={`caps ${styles.detailQtyLabel}`}>Cantidad total</span>
            <span className={`mono ${styles.detailQtyVal}`}>{fmtNum(total)}</span>
            <span className={styles.detailQtyUd}>{p.ud}</span>
          </div>
        )}
      </div>

      {tab === 'medicion' && (
        <div>
          {compact ? (
            <MedCards p={p} chapterId={chapterId} />
          ) : (
            <div className={styles.medWrap} onKeyDown={gridNav}>
            <table className={styles.medTable}>
              <thead>
                <tr>
                  <th className={`${styles.medTh} ${styles.medThComment}`}>Comentario</th>
                  <th className={styles.medTh}>Uds</th>
                  <th className={styles.medTh}>Longitud</th>
                  <th className={styles.medTh}>Anchura</th>
                  <th className={styles.medTh}>Altura</th>
                  <th className={styles.medTh}>Parcial</th>
                  <th className={styles.medTh} />
                </tr>
              </thead>
              <tbody>
                {med.map((l, i) => (
                  <tr key={i} className="med-row">
                    <td className={`${styles.medTd} ${styles.medTdComment}`}>
                      <MedComment
                        value={l.comment}
                        ariaLabel="Comentario de la línea"
                        onCommit={(v) => editMedLine(chapterId, p.id, i, 'comment', v)}
                      />
                    </td>
                    <td className={styles.medTd}>
                      <MedNum
                        value={l.uds}
                        dec={decOf(l.uds)}
                        ariaLabel="Unidades"
                        onCommit={(v) => editMedLine(chapterId, p.id, i, 'uds', v)}
                      />
                    </td>
                    <td className={styles.medTd}>
                      <MedNum
                        value={l.largo}
                        ariaLabel="Longitud"
                        onCommit={(v) => editMedLine(chapterId, p.id, i, 'largo', v)}
                      />
                    </td>
                    <td className={styles.medTd}>
                      <MedNum
                        value={l.ancho}
                        ariaLabel="Anchura"
                        onCommit={(v) => editMedLine(chapterId, p.id, i, 'ancho', v)}
                      />
                    </td>
                    <td className={styles.medTd}>
                      <MedNum
                        value={l.alto}
                        ariaLabel="Altura"
                        onCommit={(v) => editMedLine(chapterId, p.id, i, 'alto', v)}
                      />
                    </td>
                    <td className={`mono ${styles.medTd} ${styles.medParcial}`}>{fmtNum(lineParcial(l))}</td>
                    <td className={`${styles.medTd} ${styles.medDelTd}`}>
                      <button
                        type="button"
                        title="Eliminar línea"
                        className={`tcol med-del ${styles.medDelBtn}`}
                        onClick={() => deleteMedLine(chapterId, p.id, i)}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {med.length === 0 && (
                  <tr>
                    <td colSpan={7} className={styles.medEmpty}>
                      Sin líneas de medición. Añade la primera para calcular la cantidad.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          )}
          <div className={`${styles.medFoot} ${compact ? styles.medFootCompact : ''}`}>
            <button
              type="button"
              className={`tcol add-partida ${styles.medAddBtn}`}
              onClick={() => addMedLine(chapterId, p.id)}
            >
              <Icon name="plus" size={14} /> Añadir línea{compact ? '' : ' de medición'}
            </button>
            <div className={styles.detailQty}>
              <span className={`caps ${styles.detailQtyLabel}`}>Cantidad total</span>
              <span className={`mono ${styles.detailQtyVal}`}>{fmtNum(total)}</span>
              <span className={styles.detailQtyUd}>{p.ud}</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'descripcion' && (
        <div className={styles.descBox}>
          <EditableText
            value={p.desc}
            ariaLabel="Descripción de la partida"
            placeholder="Escribe la descripción detallada de la partida (sistema constructivo, materiales, normativa, criterios de medición y abono…)"
            style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', display: 'block', maxWidth: 820 }}
            onCommit={(v) => editPartidaField(chapterId, p.id, 'desc', v)}
          />
        </div>
      )}

      {tab === 'justif' &&
        (compact ? (
          <PriceJustifCards p={p} chapterId={chapterId} />
        ) : (
          <PriceJustif p={p} chapterId={chapterId} />
        ))}
    </div>
  );
}

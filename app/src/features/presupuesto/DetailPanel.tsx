import { useState } from 'react';
import { EditableText, Icon } from '../../components';
import { lineParcial, medTotal } from '../../core/medicion';
import { fmtNum } from '../../core/money';
import type { Partida } from '../../core/types';
import { useObraStore } from '../../store';
import { MedComment, MedNum } from './MedCells';
import { PriceJustif } from './PriceJustif';
import styles from './Presupuesto.module.css';

type Tab = 'medicion' | 'descripcion' | 'justif';

/** ¿Conviene 0 decimales? (uds entera se ve "8", no "8,00"). */
function decOf(v: number | ''): number {
  return v !== '' && Number.isInteger(Number(v)) ? 0 : 2;
}

/**
 * Panel de detalle de una partida (F2.2): toggle segmentado Medición /
 * Descripción. La Medición edita líneas (uds·largo·ancho·alto → parcial) y el
 * total alimenta la cantidad de la partida en vivo. La Justificación del precio
 * (banco compartido) llega en F2.3. Las tarjetas móviles, en F2.5.
 */
export function DetailPanel({ p, chapterId }: { p: Partida; chapterId: string }) {
  const [tab, setTab] = useState<Tab>('medicion');
  const editPartidaField = useObraStore((s) => s.editPartidaField);
  const addMedLine = useObraStore((s) => s.addMedLine);
  const editMedLine = useObraStore((s) => s.editMedLine);
  const deleteMedLine = useObraStore((s) => s.deleteMedLine);

  const med = p.med ?? [];
  const total = medTotal(med);

  return (
    <div className={styles.detail}>
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
        <div className={styles.detailQty} style={{ visibility: tab === 'medicion' ? 'hidden' : 'visible' }}>
          <span className={`caps ${styles.detailQtyLabel}`}>Cantidad total</span>
          <span className={`mono ${styles.detailQtyVal}`}>{fmtNum(total)}</span>
          <span className={styles.detailQtyUd}>{p.ud}</span>
        </div>
      </div>

      {tab === 'medicion' && (
        <div>
          <div className={styles.medWrap}>
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
          <div className={styles.medFoot}>
            <button
              type="button"
              className={`tcol add-partida ${styles.medAddBtn}`}
              onClick={() => addMedLine(chapterId, p.id)}
            >
              <Icon name="plus" size={14} /> Añadir línea de medición
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

      {tab === 'justif' && <PriceJustif p={p} chapterId={chapterId} />}
    </div>
  );
}

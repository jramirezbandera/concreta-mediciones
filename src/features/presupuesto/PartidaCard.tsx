import { useState, type MouseEvent } from 'react';
import { Badge, ContraChip, EditableNum, EditableText, Icon } from '../../components';
import { fmtNum, toEur, type Cents } from '../../core/money';
import type { Partida } from '../../core/types';
import { usePartidaRow } from '../../hooks/usePartidaRow';
import { useObraStore } from '../../store';
import { DetailPanel } from './DetailPanel';
import { BaseChip } from './PartidaRow';
import { PartidaMenu } from './PartidaMenu';
import styles from './Presupuesto.module.css';

function stop(e: MouseEvent) {
  e.stopPropagation();
}

/**
 * Tarjeta de partida (modo compacto, <780). Presenta los MISMOS derivados que la
 * fila de tabla (vía `usePartidaRow`, T6) — sin duplicar cálculo. Click despliega
 * el detalle compacto; título y precio editables paran la propagación.
 */
export function PartidaCard({
  p,
  chapterId,
  chapterTotal,
}: {
  p: Partida;
  chapterId: string;
  chapterTotal: Cents;
}) {
  const [expanded, setExpanded] = useState(false);
  const { cantidad, importe } = usePartidaRow(p, chapterTotal);
  const editPartidaField = useObraStore((s) => s.editPartidaField);
  const setPrecio = useObraStore((s) => s.setPrecio);

  return (
    <div className={`${styles.pCard} ${expanded ? styles.open : ''}`}>
      <div className={styles.pCardHead} onClick={() => setExpanded((v) => !v)}>
        <div className={styles.pCardTop}>
          <Icon
            name={expanded ? 'chevronDown' : 'chevron'}
            size={15}
            className={`${styles.chevIcon} ${expanded ? styles.open : ''}`}
          />
          <div className={styles.pCardId}>
            <span className={`mono ${styles.pCardPos}`}>{p.pos}</span>
            <span className={`mono ${styles.pCardCode}`}>{p.code}</span>
          </div>
          <span className={`mono ${styles.pCardImporte}`}>{fmtNum(toEur(importe))}</span>
          <span onClick={stop} style={{ flexShrink: 0 }}>
            <PartidaMenu p={p} chapterId={chapterId} />
          </span>
        </div>

        <div className={styles.pCardTitleRow} onClick={stop}>
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

        <div className={styles.pCardStats}>
          <div className={styles.pStat} onClick={stop}>
            <div className={`caps ${styles.pStatLabel}`}>Ud.</div>
            <div className={`mono ${styles.pStatVal}`}>
              <EditableText
                value={p.ud}
                ariaLabel="Unidad de medida de la partida"
                placeholder="ud"
                onCommit={(v) => editPartidaField(chapterId, p.id, 'ud', v)}
              />
            </div>
          </div>
          <div className={styles.pStat}>
            <div className={`caps ${styles.pStatLabel}`}>Cantidad</div>
            <div className={`mono ${styles.pStatVal}`}>{fmtNum(cantidad)}</div>
          </div>
          <div className={`${styles.pStat} ${styles.last}`} onClick={stop}>
            <div className={`caps ${styles.pStatLabel}`}>Precio €</div>
            <div className={`mono ${styles.pStatVal}`}>
              <EditableNum
                value={p.precio}
                dec={2}
                ariaLabel="Precio unitario"
                onCommit={(v) => setPrecio(chapterId, p.id, v)}
              />
            </div>
          </div>
        </div>
      </div>

      {expanded && <DetailPanel p={p} chapterId={chapterId} compact />}
    </div>
  );
}

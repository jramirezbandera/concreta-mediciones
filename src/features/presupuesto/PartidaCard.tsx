import { memo, type MouseEvent } from 'react';
import { Badge, CiChip, ContraChip, EditableNum, EditableText, Icon, UdSelect } from '../../components';
import { fmtNum, toEur } from '../../core/money';
import type { Partida } from '../../core/types';
import { useJustRevealed } from '../../hooks/useJustRevealed';
import { usePartidaRow } from '../../hooks/usePartidaRow';
import { useObraStore } from '../../store';
import { DetailPanel } from './DetailPanel';
import { PartidaMenu } from './PartidaMenu';
import { precioOrigenSignal } from './precioOrigen';
import styles from './Presupuesto.module.css';

function stop(e: MouseEvent) {
  e.stopPropagation();
}

/**
 * Tarjeta de partida (modo compacto, <780). Presenta los MISMOS derivados que la
 * fila de tabla (vía `usePartidaRow`, T6) — sin duplicar cálculo. Click despliega
 * el detalle compacto; título y precio editables paran la propagación. Memoizada
 * por `p`/`chapterId` (T1.1): editar otra partida no la re-renderiza.
 */
export const PartidaCard = memo(function PartidaCard({
  p,
  chapterId,
  canUp = false,
  canDown = false,
}: {
  p: Partida;
  chapterId: string;
  /** Hay hermana arriba/abajo en su grupo → «Subir/Bajar» del menú ⋮ activos. */
  canUp?: boolean;
  canDown?: boolean;
}) {
  const { cantidad, importe, origen, descompUnit } = usePartidaRow(p);
  const precio = precioOrigenSignal(origen, descompUnit, p.items.length);
  const editPartidaField = useObraStore((s) => s.editPartidaField);
  const setPrecio = useObraStore((s) => s.setPrecio);
  const setCantidad = useObraStore((s) => s.setCantidad);
  const sinMedicion = p.med.length === 0;
  const open = useObraStore((s) => s.openPartidaId === p.id);
  const togglePartida = useObraStore((s) => s.togglePartida);
  const justRevealed = useJustRevealed(p.id);

  return (
    <div
      id={`partida-${p.id}`}
      className={`${styles.pCard} ${open ? `${styles.open} ${styles.selected}` : ''} ${justRevealed ? styles.justRevealed : ''}`}
      aria-selected={open}
    >
      <div className={styles.pCardHead} onClick={() => togglePartida(p.id)}>
        <div className={styles.pCardTop}>
          <Icon
            name={open ? 'chevronDown' : 'chevron'}
            size={15}
            className={`${styles.chevIcon} ${open ? styles.open : ''}`}
          />
          <div className={styles.pCardId}>
            <span className={`mono ${styles.pCardPos}`}>{p.pos}</span>
            <span className={`mono ${styles.pCardCode}`}>{p.code}</span>
          </div>
          <span className={`mono ${styles.pCardImporte}`}>{fmtNum(toEur(importe))}</span>
          <span onClick={stop} style={{ flexShrink: 0 }}>
            <PartidaMenu p={p} chapterId={chapterId} canUp={canUp} canDown={canDown} />
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
          {p.contradictorio && <ContraChip />}
          {p.ciPct != null && p.ciPct > 0 && <CiChip pct={p.ciPct} small />}
        </div>

        <div className={styles.pCardStats}>
          <div className={styles.pStat} onClick={stop}>
            <div className={`caps ${styles.pStatLabel}`}>Ud.</div>
            <div className={`mono ${styles.pStatVal}`}>
              <UdSelect
                value={p.ud}
                ariaLabel="Unidad de medida de la partida"
                onCommit={(v) => editPartidaField(chapterId, p.id, 'ud', v)}
              />
            </div>
          </div>
          <div className={styles.pStat} onClick={sinMedicion ? stop : undefined}>
            <div className={`caps ${styles.pStatLabel}`}>Cantidad</div>
            <div className={`mono ${styles.pStatVal}`}>
              {sinMedicion ? (
                <EditableNum
                  value={cantidad}
                  dec={2}
                  ariaLabel="Cantidad de la partida (sin medición)"
                  onCommit={(v) => setCantidad(chapterId, p.id, v)}
                />
              ) : (
                fmtNum(cantidad)
              )}
            </div>
          </div>
          <div className={`${styles.pStat} ${styles.last}`} onClick={stop} title={precio.title}>
            <div className={`caps ${styles.pStatLabel}`}>Precio €</div>
            <div className={`mono ${styles.pStatVal}`}>
              {precio.dot && <span className={styles.overrideDotCard} aria-hidden="true" />}
              <EditableNum
                value={p.precio}
                dec={2}
                accent={precio.accent}
                ariaLabel="Precio unitario"
                onCommit={(v) => setPrecio(chapterId, p.id, v)}
              />
              <span className={styles.srOnly}>{precio.sr}</span>
            </div>
          </div>
        </div>
      </div>

      {open && <DetailPanel p={p} chapterId={chapterId} compact />}
    </div>
  );
});

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
      {/* Tres líneas que se leen de arriba abajo como la fila de la tabla:
          identificación → título → cálculo. El importe cierra la línea de su
          propio cálculo (cantidad × precio ···· importe) en vez de flotar
          arriba lejos de sus factores; sin caja ni etiquetas en mayúsculas. */}
      <div className={styles.pCardHead} onClick={() => togglePartida(p.id)}>
        {/* Botón real (no solo el clic en la tarjeta): foco de teclado, estado
            para lectores de pantalla y 44px de área táctil. Igual que CertCard. */}
        <button
          type="button"
          className={`tap-target ${styles.chevBtn} ${styles.pCardChev}`}
          aria-expanded={open}
          aria-label={`${open ? 'Contraer' : 'Desplegar'} partida ${p.pos}`}
          onClick={(e) => {
            e.stopPropagation();
            togglePartida(p.id);
          }}
        >
          <Icon
            name={open ? 'chevronDown' : 'chevron'}
            size={15}
            className={`${styles.chevIcon} ${open ? styles.open : ''}`}
          />
        </button>
        <div className={styles.pCardId}>
          <span className={`mono ${styles.pCardPos}`}>{p.pos}</span>
          <span className={`mono ${styles.pCardCode}`}>{p.code}</span>
          {p.mainType && <Badge type={p.mainType} />}
          {p.contradictorio && <ContraChip />}
          {p.ciPct != null && p.ciPct > 0 && <CiChip pct={p.ciPct} small />}
        </div>
        <span className={styles.pCardMenu} onClick={stop}>
          <PartidaMenu p={p} chapterId={chapterId} canUp={canUp} canDown={canDown} />
        </span>

        <div className={styles.pCardTitleRow} onClick={stop}>
          <EditableText
            value={p.title}
            ariaLabel="Título de la partida"
            placeholder="Título de la partida…"
            className={styles.title}
            onCommit={(v) => editPartidaField(chapterId, p.id, 'title', v)}
          />
        </div>

        <div className={`mono ${styles.pCardCalc}`}>
          <span
            className={styles.pCalcNum}
            onClick={sinMedicion ? stop : undefined}
            title={sinMedicion ? 'Cantidad (sin medición: se escribe a mano)' : 'Cantidad medida'}
          >
            {sinMedicion ? (
              <EditableNum
                value={cantidad}
                dec={2}
                ariaLabel="Cantidad de la partida (sin medición)"
                onCommit={(v) => setCantidad(chapterId, p.id, v)}
              />
            ) : (
              <span className={styles.pCalcFixed}>{fmtNum(cantidad)}</span>
            )}
          </span>
          <span onClick={stop} className={styles.pCalcUd}>
            <UdSelect
              value={p.ud}
              ariaLabel="Unidad de medida de la partida"
              onCommit={(v) => editPartidaField(chapterId, p.id, 'ud', v)}
            />
          </span>
          <span className={styles.pCalcOp} aria-hidden="true">
            ×
          </span>
          <span className={styles.pCalcNum} onClick={stop} title={precio.title}>
            {precio.dot && <span className={styles.overrideDotCard} aria-hidden="true" />}
            <EditableNum
              value={p.precio}
              dec={2}
              accent={precio.accent}
              ariaLabel="Precio unitario"
              onCommit={(v) => setPrecio(chapterId, p.id, v)}
            />
            <span className={styles.srOnly}>{precio.sr}</span>
          </span>
          <span className={styles.pCalcOp} aria-hidden="true">
            €
          </span>
          <span className={styles.pCalcLeader} aria-hidden="true" />
          <span className={styles.pCardImporte} title="Importe">
            <span className={styles.srOnly}>Importe </span>
            {fmtNum(toEur(importe))}
          </span>
        </div>
      </div>

      {open && <DetailPanel p={p} chapterId={chapterId} compact />}
    </div>
  );
});

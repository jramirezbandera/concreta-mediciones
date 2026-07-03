/* ---------- fila de partida de referencia (descripción desplegable) ------ */
import { useState } from 'react';
import { Badge, Icon } from '../../../components';
import { baseAcumulada, itemImporteRec } from '../../../core/banco';
import { fmtNum } from '../../../core/money';
import { REF_DESC, type RefPartida } from '../../../core/refdata';
import styles from '../Referencia.module.css';

/** Los items del panel vienen HIDRATADOS (precio inline) y `recPrecio` cae al
 *  `precio` del item con un banco vacío → el motor sirve tal cual. */
const EMPTY_BANCO = {};

/** Importe de descomposición de una línea — EL MOTOR (`core/banco`), no una
 *  réplica: la copia local porcentuaba el `%` sobre la base PLANA (solo líneas
 *  no-%) mientras el motor usa base ACUMULADA estilo Arquímedes; con ≥2 líneas
 *  `%` (medios auxiliares + CI, habitual en bancos CYPE) las líneas mostradas
 *  NO sumaban el precio que de verdad se copia al presupuesto (auditoría B-06). */
function itemImporte(items: RefPartida['items'], i: number): number {
  return itemImporteRec(items[i]!, EMPTY_BANCO, baseAcumulada(items, EMPTY_BANCO, i));
}

export function RefPartidaRow({
  p,
  selected,
  onToggleSel,
  onCopyOne,
  onDragStart,
  onDragEnd,
  pathLabel,
}: {
  p: RefPartida;
  selected: boolean;
  onToggleSel: (p: RefPartida) => void;
  onCopyOne: (p: RefPartida) => void;
  onDragStart: (e: React.DragEvent, p: RefPartida) => void;
  onDragEnd: () => void;
  /** Ruta del subcapítulo al que pertenece (solo en resultados de búsqueda). */
  pathLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  // Las bases traen la desc por código (REF_DESC); las obras propias en la partida.
  const desc = p.desc ?? REF_DESC[p.code] ?? '';
  return (
    <div className={`${styles.part} ${open ? styles.open : ''}`}>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, p)}
        onDragEnd={onDragEnd}
        className={`${styles.partRow} ${selected ? styles.selected : ''}`}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title={open ? 'Ocultar descripción' : 'Ver descripción'}
          className={`tcol ${styles.partChev} ${open ? styles.on : ''}`}
        >
          <Icon name={open ? 'chevronDown' : 'chevron'} size={13} />
        </button>
        <button
          type="button"
          onClick={() => onToggleSel(p)}
          title="Seleccionar"
          aria-label={`Seleccionar ${p.code}`}
          aria-pressed={selected}
          className={`tcol ${styles.partCheck} ${selected ? styles.on : ''}`}
        >
          {selected && <Icon name="check" size={12} />}
        </button>
        <span className={`mono ${styles.partCode}`}>{p.code}</span>
        <div className={styles.partTitleWrap} onClick={() => setOpen((o) => !o)}>
          <div className={`${styles.partTitle} ${open ? styles.open : ''}`}>{p.title}</div>
          {pathLabel && <div className={styles.partPath}>{pathLabel}</div>}
        </div>
        <span className={`mono ${styles.partUd}`}>{p.ud}</span>
        <span className={`mono ${styles.partPrecio}`}>{fmtNum(p.precio)}</span>
        <button
          type="button"
          onClick={() => onCopyOne(p)}
          title="Copiar a mi presupuesto"
          aria-label={`Copiar ${p.code} a mi presupuesto`}
          className={`tcol ${styles.partCopy}`}
        >
          <Icon name="arrowLeft" size={15} />
        </button>
      </div>
      {open && (
        <div className={styles.partDetail}>
          {desc && <p className={styles.partDesc}>{desc}</p>}
          {p.items.length > 0 && (
            <div className={styles.descomp}>
              <div className={`caps ${styles.descompHead}`}>Descomposición</div>
              {p.items.map((it, i) => (
                <div key={i} className={styles.descompRow}>
                  <Badge type={it.type} />
                  <span className={styles.descompDesc}>{it.desc}</span>
                  <span className={`mono ${styles.descompCant}`}>
                    {fmtNum(it.cantidad, 3)} {it.type === '%CI' ? '%' : it.ud}
                  </span>
                  <span className={`mono ${styles.descompImp}`}>{fmtNum(itemImporte(p.items, i))}</span>
                </div>
              ))}
            </div>
          )}
          <div className={styles.partDetailActions}>
            <button type="button" onClick={() => onCopyOne(p)} className={styles.partCopyBig}>
              <Icon name="arrowLeft" size={14} /> Copiar a mi presupuesto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

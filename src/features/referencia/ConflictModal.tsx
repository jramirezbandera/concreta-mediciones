/* ===========================================================================
   ConflictModal — resolución de colisión de recursos al copiar entre obras
   (T-10 / T-1, decisión eng-review D2: "avisar y preguntar"). Cuando un código
   entrante choca con el banco a precio/unidad distintos, el store deja
   `pendingCopy` y este diálogo deja elegir por concepto: FUSIONAR (usar el del
   presupuesto actual) o BIFURCAR (crear un código nuevo con el de la obra de
   origen, para que el descompuesto copiado conserve su precio). Por defecto
   BIFURCAR (no cambia en silencio el precio/unidad de lo copiado).

   Reusa el `Modal` compartido → scrim (`--scrim`), trap de foco, Esc, cierre por
   overlay, hoja inferior en móvil y restauración de foco (cierra parte de T-7).
   =========================================================================== */
import { useEffect, useState } from 'react';
import { Icon } from '../../components';
import { Modal } from '../../components/Modal';
import { fmtNum } from '../../core/money';
import type { Resolution } from '../../core/refdata';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useObraStore } from '../../store';
import styles from './ConflictModal.module.css';

export function ConflictModal() {
  const pending = useObraStore((s) => s.pendingCopy);
  const resolve = useObraStore((s) => s.resolveCopyRefPartidas);
  const cancel = useObraStore((s) => s.cancelCopyRefPartidas);
  const bp = useBreakpoint();
  const [res, setRes] = useState<Resolution>({});

  useEffect(() => {
    if (!pending) return;
    const init: Resolution = {};
    for (const c of pending.collisions) init[c.code] = 'fork';
    setRes(init);
  }, [pending]);

  if (!pending) return null;
  const { collisions } = pending;
  const n = collisions.length;

  return (
    <Modal
      open
      onClose={cancel}
      compact={bp.isMobile}
      icon="alert"
      title={
        n === 1
          ? '1 recurso ya existe con otro precio o unidad'
          : `${n} recursos ya existen con otro precio o unidad`
      }
      subtitle="Fusionar usa el de tu presupuesto; bifurcar crea un código nuevo y conserva el de la obra de origen."
      footer={
        <>
          <button type="button" onClick={cancel} className={`tcol ${styles.cancel}`}>
            Cancelar
          </button>
          <button type="button" onClick={() => resolve(res)} className={styles.confirm}>
            <Icon name="arrowLeft" size={15} style={{ flexShrink: 0 }} /> Copiar
          </button>
        </>
      }
    >
      <div className={styles.list}>
        {collisions.map((c) => {
          const choice = res[c.code] ?? 'fork';
          return (
            <div key={c.code} className={styles.row}>
              <div className={styles.rowHead}>
                <span className={`mono ${styles.code}`}>{c.code}</span>
                <span className={styles.rowDesc}>{c.incoming.desc || c.existing.desc}</span>
              </div>
              <div className={styles.compare}>
                <span className={styles.cell}>
                  Tu banco: <span className="mono">{fmtNum(c.existing.precio)} €/{c.existing.ud}</span>
                </span>
                <span className={styles.cell}>
                  Obra origen:{' '}
                  <span className="mono">{fmtNum(c.incoming.precio)} €/{c.incoming.ud}</span>
                </span>
              </div>
              <div className={styles.seg} role="radiogroup" aria-label={`Resolución de ${c.code}`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={choice === 'merge'}
                  onClick={() => setRes((r) => ({ ...r, [c.code]: 'merge' }))}
                  className={`tcol ${styles.segBtn} ${choice === 'merge' ? styles.segOn : ''}`}
                >
                  Fusionar
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={choice === 'fork'}
                  onClick={() => setRes((r) => ({ ...r, [c.code]: 'fork' }))}
                  className={`tcol ${styles.segBtn} ${choice === 'fork' ? styles.segOn : ''}`}
                >
                  Bifurcar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

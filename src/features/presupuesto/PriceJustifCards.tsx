import type { ReactNode } from 'react';
import { Badge, EditableNum, EditableText, Icon } from '../../components';
import { descompUnit, itemImporteRec, precioCuadraDescompuesto, recursoBase } from '../../core/banco';
import { fmtNum } from '../../core/money';
import type { Partida } from '../../core/types';
import { selectRecursoUsage, useObraStore } from '../../store';
import { SharedChip } from './PriceJustif';
import styles from './Presupuesto.module.css';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.medField} style={{ flex: 1, minWidth: 0 }}>
      <span className={`caps ${styles.medFieldLabel}`}>{label}</span>
      <div className={styles.medFieldBox}>{children}</div>
    </div>
  );
}

/** Justificación en tarjetas (modo compacto, <780). Mismo banco compartido. */
export function PriceJustifCards({ p, chapterId }: { p: Partida; chapterId: string }) {
  const recursos = useObraStore((s) => s.recursos);
  const usage = useObraStore(selectRecursoUsage);
  const editRecurso = useObraStore((s) => s.editRecurso);
  const editItemCantidad = useObraStore((s) => s.editItemCantidad);
  const addItem = useObraStore((s) => s.addItem);
  const deleteItem = useObraStore((s) => s.deleteItem);

  const items = p.items ?? [];
  const base = recursoBase(items, recursos);
  const descomp = descompUnit(items, recursos);
  const isOverride = !precioCuadraDescompuesto(p, recursos);

  return (
    <div className={styles.jCardList}>
      {items.map((it, i) => {
        const isCI = it.type === '%CI';
        const rec = recursos[it.code];
        const precio = isCI ? base : (rec?.precio ?? it.precio ?? 0);
        const desc = isCI ? it.desc || 'Costes indirectos' : (rec?.desc ?? it.desc ?? '');
        const ud = isCI ? '%' : (rec?.ud ?? it.ud ?? '');
        const importe = itemImporteRec(it, recursos, base);
        return (
          <div key={i} className={styles.jCard}>
            <div className={styles.jCardTop}>
              <Badge type={it.type} />
              <span className={`mono ${styles.jCode}`}>{it.code}</span>
              <SharedChip n={usage[it.code]} />
              <span className={`mono ${styles.jCardImporte}`}>{fmtNum(importe)}</span>
              <button
                type="button"
                title="Eliminar concepto"
                className={`tcol ${styles.medDelCard}`}
                onClick={() => deleteItem(chapterId, p.id, i)}
              >
                <Icon name="x" size={14} />
              </button>
            </div>
            {isCI ? (
              <div className={styles.jCIDesc} style={{ marginBottom: 8 }}>{desc}</div>
            ) : (
              <div className={styles.jCardDesc}>
                <EditableText
                  value={desc}
                  ariaLabel="Concepto del recurso"
                  placeholder="Concepto…"
                  style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block' }}
                  onCommit={(v) => editRecurso(it.code, 'desc', v)}
                />
              </div>
            )}
            <div className={styles.jCardGrid}>
              <Field label="Ud">
                {isCI ? (
                  <span className={`mono ${styles.jCIRead}`} style={{ textAlign: 'center' }}>%</span>
                ) : (
                  <EditableText
                    value={ud}
                    ariaLabel="Unidad del recurso"
                    placeholder="ud"
                    style={{ textAlign: 'center' }}
                    onCommit={(v) => editRecurso(it.code, 'ud', v)}
                  />
                )}
              </Field>
              <Field label={isCI ? 'Porcentaje' : 'Rendimiento'}>
                <EditableNum
                  value={it.cantidad}
                  dec={isCI ? 2 : 3}
                  ariaLabel="Rendimiento"
                  onCommit={(v) => editItemCantidad(chapterId, p.id, i, v)}
                />
              </Field>
              <Field label="Precio €">
                {isCI ? (
                  <span className={`mono ${styles.jCIRead}`} style={{ textAlign: 'center' }}>
                    {fmtNum(precio)}
                  </span>
                ) : (
                  <EditableNum
                    value={precio}
                    dec={2}
                    accent
                    ariaLabel="Precio del recurso"
                    onCommit={(v) => editRecurso(it.code, 'precio', v)}
                  />
                )}
              </Field>
            </div>
          </div>
        );
      })}

      <button type="button" className={`tcol ${styles.cardsAdd}`} onClick={() => addItem(chapterId, p.id)}>
        <Icon name="plus" size={15} /> Añadir concepto
      </button>

      <div className={styles.jFootCard}>
        <span className={`caps ${styles.jFootLabel}`}>Precio descompuesto</span>
        <span className={`mono ${styles.jFootVal}`}>{fmtNum(descomp)} €</span>
      </div>

      {isOverride && (
        <div className={`${styles.jOverride} ${styles.jOverrideCard}`}>
          <Icon name="pencil" size={12} />
          <span>
            Precio fijado a mano (<span className="mono">{fmtNum(p.precio)} €</span>): no sale de
            estos descompuestos (<span className="mono">{fmtNum(descomp)} €</span>).
          </span>
        </div>
      )}
    </div>
  );
}

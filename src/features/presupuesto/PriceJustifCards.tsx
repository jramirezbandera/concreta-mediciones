import type { ReactNode } from 'react';
import { Badge, EditableNum, EditableText, Icon, TypeSelect, UdSelect } from '../../components';
import { baseAcumulada, descompUnit, itemImporteRec, precioCuadraDescompuesto } from '../../core/banco';
import { fmtNum } from '../../core/money';
import type { Partida } from '../../core/types';
import { selectRecursoUsage, useObraStore } from '../../store';
import { SharedChip } from './PriceJustif';
import { useCowGuard } from './useCowGuard';
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
  const { guard, dialogEl } = useCowGuard(chapterId, p);

  const items = p.items ?? [];
  const descomp = descompUnit(items, recursos);
  const isOverride = !precioCuadraDescompuesto(p, recursos);

  return (
    <>
    <div className={styles.jCardList}>
      {items.map((it, i) => {
        const isCI = it.type === '%CI';
        const rec = recursos[it.code];
        // Base ACUMULADA hasta esta fila (directos + líneas anteriores).
        const base = isCI ? baseAcumulada(items, recursos, i) : 0;
        const precio = isCI ? base : (rec?.precio ?? it.precio ?? 0);
        const desc = isCI ? it.desc || 'Costes indirectos' : (rec?.desc ?? it.desc ?? '');
        const ud = isCI ? '%' : (rec?.ud ?? it.ud ?? '');
        // Tipo: el banco es la fuente de verdad (no el vestigio `it.type`).
        const dispType = isCI ? it.type : (rec?.type ?? it.type);
        const importe = itemImporteRec(it, recursos, base);
        return (
          <div key={i} className={styles.jCard}>
            <div className={styles.jCardTop}>
              {isCI ? (
                <Badge type={it.type} />
              ) : (
                <TypeSelect
                  value={dispType}
                  ariaLabel="Tipo de recurso"
                  onCommit={(v) => guard.type(i, v)}
                />
              )}
              {isCI ? (
                <span className={`mono ${styles.jCode}`}>{it.code}</span>
              ) : (
                <EditableText
                  value={it.code}
                  ariaLabel="Código del recurso"
                  placeholder="Código…"
                  className="mono"
                  style={{ fontSize: 12 }}
                  onCommit={(v) => guard.code(i, v)}
                />
              )}
              <SharedChip n={usage[it.code]} />
              <span className={`mono ${styles.jCardImporte}`}>{fmtNum(importe)}</span>
              <button
                type="button"
                title="Eliminar concepto"
                className={`tcol ${styles.medDelCard}`}
                onClick={() => guard.deleteItem(i)}
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
                  onCommit={(v) => guard.recurso(i, 'desc', v)}
                />
              </div>
            )}
            <div className={styles.jCardGrid}>
              <Field label="Ud">
                {isCI ? (
                  <span className={`mono ${styles.jCIRead}`} style={{ textAlign: 'center' }}>%</span>
                ) : (
                  <UdSelect
                    value={ud}
                    ariaLabel="Unidad del recurso"
                    onCommit={(v) => guard.recurso(i, 'ud', v)}
                  />
                )}
              </Field>
              <Field label={isCI ? 'Porcentaje' : 'Rendimiento'}>
                <EditableNum
                  value={it.cantidad}
                  dec={isCI ? 2 : 3}
                  ariaLabel="Rendimiento"
                  onCommit={(v) => guard.cantidad(i, v)}
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
                    onCommit={(v) => guard.recurso(i, 'precio', v)}
                  />
                )}
              </Field>
            </div>
          </div>
        );
      })}

      <button type="button" className={`tcol ${styles.cardsAdd}`} onClick={() => guard.addItem()}>
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
    {dialogEl}
    </>
  );
}

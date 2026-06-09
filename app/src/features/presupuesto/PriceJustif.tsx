import { Badge, EditableNum, EditableText, Icon } from '../../components';
import { descompUnit, itemImporteRec, precioCuadraDescompuesto, recursoBase } from '../../core/banco';
import { fmtNum } from '../../core/money';
import type { Partida } from '../../core/types';
import { selectRecursoUsage, useObraStore } from '../../store';
import styles from './Presupuesto.module.css';

/** Indicador de concepto compartido (editar afecta a N partidas). */
function SharedChip({ n }: { n?: number }) {
  if (!n || n < 2) return null;
  return (
    <span className={styles.jShared} title={`Compartido: editar este concepto afecta a ${n} partidas`}>
      <Icon name="layers" size={10} /> {n}
    </span>
  );
}

/**
 * Justificación del precio (F2.3): tabla del banco de recursos COMPARTIDO por
 * código. Editar desc/ud/precio de un concepto afecta a todas las partidas que
 * lo usan (`editRecurso`); el rendimiento es propio (`editItemCantidad`). El
 * `%CI` es un % sobre el coste directo (precio = base, no editable). El pie
 * muestra el precio descompuesto y, si la partida tiene override, la señal de
 * que su precio NO se calcula de aquí. (Tarjetas móviles: F2.5.)
 */
export function PriceJustif({ p, chapterId }: { p: Partida; chapterId: string }) {
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
    <div className={styles.medWrap}>
      <table className={styles.jTable}>
        <thead>
          <tr>
            <th className={`${styles.jTh} ${styles.jTipoTd}`}>Tipo</th>
            <th className={styles.jTh}>Código</th>
            <th className={styles.jTh}>Concepto</th>
            <th className={styles.jTh}>Ud</th>
            <th className={`${styles.jTh} ${styles.jThNum}`}>Rendim.</th>
            <th className={`${styles.jTh} ${styles.jThNum}`}>Precio</th>
            <th className={`${styles.jTh} ${styles.jThNum}`}>Importe</th>
            <th className={styles.jTh} />
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const isCI = it.type === '%CI';
            const rec = recursos[it.code];
            const precio = isCI ? base : (rec?.precio ?? it.precio ?? 0);
            const desc = isCI ? it.desc || 'Costes indirectos' : (rec?.desc ?? it.desc ?? '');
            const ud = isCI ? '%' : (rec?.ud ?? it.ud ?? '');
            const importe = itemImporteRec(it, recursos, base);
            return (
              <tr key={i} className="med-row">
                <td className={`${styles.jTd} ${styles.jTipoTd}`}>
                  <Badge type={it.type} />
                </td>
                <td className={styles.jTd}>
                  <span className={`mono ${styles.jCode}`}>{it.code}</span>
                </td>
                <td className={styles.jTd}>
                  <div className={styles.jConcept}>
                    {isCI ? (
                      <span className={styles.jCIDesc}>{desc}</span>
                    ) : (
                      <EditableText
                        value={desc}
                        ariaLabel="Concepto del recurso"
                        placeholder="Concepto…"
                        style={{ fontSize: 12.5, color: 'var(--text-secondary)', flex: 1 }}
                        onCommit={(v) => editRecurso(it.code, 'desc', v)}
                      />
                    )}
                    <SharedChip n={usage[it.code]} />
                  </div>
                </td>
                <td className={styles.jTd}>
                  {isCI ? (
                    <span className={`mono ${styles.jCode}`}>%</span>
                  ) : (
                    <EditableText
                      value={ud}
                      ariaLabel="Unidad del recurso"
                      placeholder="ud"
                      style={{ fontSize: 11.5, color: 'var(--text-disabled)' }}
                      onCommit={(v) => editRecurso(it.code, 'ud', v)}
                    />
                  )}
                </td>
                <td className={styles.jTd}>
                  <EditableNum
                    value={it.cantidad}
                    dec={isCI ? 2 : 3}
                    ariaLabel="Rendimiento"
                    onCommit={(v) => editItemCantidad(chapterId, p.id, i, v)}
                  />
                </td>
                <td className={styles.jTd}>
                  {isCI ? (
                    <span className={`mono ${styles.jCIRead}`}>{fmtNum(precio)}</span>
                  ) : (
                    <EditableNum
                      value={precio}
                      dec={2}
                      accent
                      ariaLabel="Precio del recurso"
                      onCommit={(v) => editRecurso(it.code, 'precio', v)}
                    />
                  )}
                </td>
                <td className={`mono ${styles.jTd} ${styles.jImporte}`}>{fmtNum(importe)}</td>
                <td className={`${styles.jTd} ${styles.medDelTd}`}>
                  <button
                    type="button"
                    title="Eliminar concepto"
                    className={`tcol med-del ${styles.medDelBtn}`}
                    onClick={() => deleteItem(chapterId, p.id, i)}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={8} className={styles.jEmpty}>
                Sin descomposición. Añade conceptos de mano de obra, maquinaria o materiales.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className={styles.jFoot}>
        <button
          type="button"
          className={`tcol add-partida ${styles.medAddBtn}`}
          onClick={() => addItem(chapterId, p.id)}
        >
          <Icon name="plus" size={14} /> Añadir concepto
        </button>
        <div className={styles.jFootRight}>
          <span className={`caps ${styles.jFootLabel}`}>Precio descompuesto</span>
          <span className={`mono ${styles.jFootVal}`}>{fmtNum(descomp)} €</span>
        </div>
      </div>

      {isOverride && (
        <div className={styles.jOverride}>
          <Icon name="pencil" size={12} />
          <span>
            El precio de la partida (<span className="mono">{fmtNum(p.precio)} €</span>) está fijado a
            mano: no se recalcula de estos descompuestos (<span className="mono">{fmtNum(descomp)} €</span>).
          </span>
        </div>
      )}
    </div>
  );
}

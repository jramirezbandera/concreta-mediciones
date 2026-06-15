import { Badge, EditableNum, EditableText, Icon, TypeSelect, UdSelect } from '../../components';
import { baseAcumulada, descompUnit, itemImporteRec, precioCuadraDescompuesto } from '../../core/banco';
import { fmtNum } from '../../core/money';
import type { Partida } from '../../core/types';
import { useGridNav } from '../../hooks/useGridNav';
import { selectRecursoUsage, useObraStore } from '../../store';
import { useCowGuard } from './useCowGuard';
import styles from './Presupuesto.module.css';

/** Indicador de concepto compartido (editar afecta a N partidas). */
export function SharedChip({ n }: { n?: number }) {
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
  const { guard, dialogEl } = useCowGuard(chapterId, p);

  const gridNav = useGridNav();
  const items = p.items ?? [];
  const descomp = descompUnit(items, recursos);
  const isOverride = !precioCuadraDescompuesto(p, recursos);

  return (
    <>
    <div className={styles.medWrap} onKeyDown={gridNav}>
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
            // Un `%` porcentúa la base ACUMULADA hasta su fila (directos +
            // líneas anteriores), como Arquímedes — el CI sobre directos+aux.
            const base = isCI ? baseAcumulada(items, recursos, i) : 0;
            const precio = isCI ? base : (rec?.precio ?? it.precio ?? 0);
            const desc = isCI ? it.desc || 'Costes indirectos' : (rec?.desc ?? it.desc ?? '');
            const ud = isCI ? '%' : (rec?.ud ?? it.ud ?? '');
            // Tipo: el banco es la fuente de verdad (no el vestigio `it.type`).
            const dispType = isCI ? it.type : (rec?.type ?? it.type);
            const importe = itemImporteRec(it, recursos, base);
            return (
              <tr key={i} className="med-row">
                <td className={`${styles.jTd} ${styles.jTipoTd}`}>
                  {isCI ? (
                    <Badge type={it.type} />
                  ) : (
                    <TypeSelect
                      value={dispType}
                      ariaLabel="Tipo de recurso"
                      onCommit={(v) => guard.type(i, v)}
                    />
                  )}
                </td>
                <td className={styles.jTd}>
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
                        onCommit={(v) => guard.recurso(i, 'desc', v)}
                      />
                    )}
                    <SharedChip n={usage[it.code]} />
                  </div>
                </td>
                <td className={styles.jTd}>
                  {isCI ? (
                    <span className={`mono ${styles.jCode}`}>%</span>
                  ) : (
                    <UdSelect
                      value={ud}
                      ariaLabel="Unidad del recurso"
                      onCommit={(v) => guard.recurso(i, 'ud', v)}
                    />
                  )}
                </td>
                <td className={styles.jTd}>
                  <EditableNum
                    value={it.cantidad}
                    dec={isCI ? 2 : 3}
                    ariaLabel="Rendimiento"
                    onCommit={(v) => guard.cantidad(i, v)}
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
                      onCommit={(v) => guard.recurso(i, 'precio', v)}
                    />
                  )}
                </td>
                <td className={`mono ${styles.jTd} ${styles.jImporte}`}>{fmtNum(importe)}</td>
                <td className={`${styles.jTd} ${styles.medDelTd}`}>
                  <button
                    type="button"
                    title="Eliminar concepto"
                    className={`tcol med-del ${styles.medDelBtn}`}
                    onClick={() => guard.deleteItem(i)}
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
          onClick={() => guard.addItem()}
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
    {dialogEl}
    </>
  );
}

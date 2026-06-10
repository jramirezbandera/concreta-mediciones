import { Icon } from '../../components';
import { selectResumen, useObraStore } from '../../store';
import { ResumenSheet } from './ResumenSheet';
import styles from './Resumen.module.css';

/**
 * Vista Resumen (F7.1, front-runea el núcleo de F3): hoja resumen EDITABLE
 * (GG/BI inline + selector de IVA, vía `setRates` — único hogar de edición de
 * GG/BI) + observaciones persistidas en `obra.notes`. El doc de impresión
 * renderiza la misma hoja en solo-lectura desde el mismo selector.
 */
export function ResumenView({ compact }: { compact: boolean }) {
  const data = useObraStore(selectResumen);
  const obraName = useObraStore((s) => s.obra.denominacion);
  const notes = useObraStore((s) => s.obra.notes ?? '');
  const setRates = useObraStore((s) => s.setRates);
  const setObraPath = useObraStore((s) => s.setObraPath);
  const setView = useObraStore((s) => s.setView);

  // Estado vacío (obra sin capítulos): no una hoja a 0,00 (design review F7.1).
  if (data.rows.length === 0) {
    return (
      <div className={`dot-grid ${styles.view} ${styles.emptyWrap}`}>
        <div className={styles.emptyCard}>
          <div className={styles.emptyIcon}>
            <Icon name="grid" size={24} />
          </div>
          <div className={styles.emptyTitle}>Aún no hay presupuesto que resumir</div>
          <p className={styles.emptyText}>
            Importa un .bc3 o crea capítulos y partidas; esta hoja se calcula sola.
          </p>
          <button type="button" className={styles.emptyBtn} onClick={() => setView('presupuesto')}>
            <Icon name="list" size={15} /> Ir al presupuesto
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`dot-grid ${styles.view} ${compact ? styles.compact : ''}`}>
      <div className={styles.page}>
        <div>
          <div className={`caps ${styles.kicker}`}>Resumen de presupuesto</div>
          <h1 className={styles.title}>{obraName}</h1>
        </div>

        <ResumenSheet data={data} onRates={setRates} />

        <div className={styles.notesCard}>
          <div className="sec-head" style={{ marginBottom: 10 }}>
            Observaciones y notas
          </div>
          <textarea
            className={styles.notesArea}
            value={notes}
            aria-label="Observaciones y notas"
            placeholder="Condiciones, plazos, notas de la propiedad, exclusiones, criterios de revisión de precios…"
            onChange={(e) => setObraPath('notes', e.target.value)}
          />
        </div>
        <div className={styles.spacer} />
      </div>
    </div>
  );
}

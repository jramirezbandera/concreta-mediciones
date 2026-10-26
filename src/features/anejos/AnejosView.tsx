import { lazy, Suspense } from 'react';
import { Icon, type IconName } from '../../components';
import { useAnejoStore, type Anejo } from './anejoStore';
import styles from './Anejos.module.css';

// Cada anejo trae su motor y sus tablas: se carga el que se abre.
const ResiduosView = lazy(() => import('../residuos/ResiduosView').then((m) => ({ default: m.ResiduosView })));
const CalidadView = lazy(() => import('../calidad/CalidadView').then((m) => ({ default: m.CalidadView })));

const ANEJOS: Array<[Anejo, string, IconName]> = [
  ['residuos', 'Residuos', 'recycle'],
  ['calidad', 'Control de calidad', 'flask'],
];

/**
 * Vista «Anejos»: los anejos de la memoria que salen del presupuesto, cada uno
 * en su pestaña (D6 del plan de control): el estudio de gestión de residuos y
 * el plan de control de calidad.
 */
export function AnejosView({ compact, onGoPresupuesto }: { compact: boolean; onGoPresupuesto: () => void }) {
  const anejo = useAnejoStore((s) => s.anejo);
  const setAnejo = useAnejoStore((s) => s.setAnejo);
  return (
    <div className={`${styles.anejos} ${compact ? styles.compact : ''}`}>
      <div className={styles.bar}>
        <div className={styles.switch} role="tablist" aria-label="Anejos">
          {ANEJOS.map(([k, label, icon]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={anejo === k}
              className={`tcol ${styles.opt} ${anejo === k ? styles.on : ''}`}
              onClick={() => setAnejo(k)}
            >
              <Icon name={icon} size={14} /> {label}
            </button>
          ))}
        </div>
      </div>
      <Suspense fallback={<div style={{ padding: 24, color: 'var(--text-disabled)' }}>Cargando…</div>}>
        {anejo === 'residuos' ? (
          <ResiduosView compact={compact} onGoPresupuesto={onGoPresupuesto} />
        ) : (
          <CalidadView compact={compact} onGoPresupuesto={onGoPresupuesto} />
        )}
      </Suspense>
    </div>
  );
}

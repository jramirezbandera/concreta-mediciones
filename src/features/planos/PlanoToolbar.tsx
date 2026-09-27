/* ===========================================================================
   PlanoToolbar — Mano · Calibrar │ Longitud · Superficie · Rectángulo ·
   Recuento │ Restar │ zoom − / + / Ajustar (§5.2, §5.10). Las herramientas
   son un `radiogroup`; una deshabilitada sigue enfocable (`aria-disabled`) y al
   pulsarla dice su motivo. Restar es un conmutador (`aria-pressed`).
   =========================================================================== */
import { Icon, type IconName } from '../../components';
import type { Armada } from '../../core/planoCiclo';
import { NOMBRE_HERRAMIENTA } from '../../core/planoMedida';
import type { Herramienta } from '../../core/types';
import { HERRAMIENTAS_MEDIR, TECLA, textoMotivoVisor, type MotivoVisor } from './herramientas';
import styles from './Planos.module.css';

const ICONO: Record<Herramienta, IconName> = {
  longitud: 'ruler',
  superficie: 'pentagon',
  rectangulo: 'squareDashed',
  recuento: 'hash',
};

export function PlanoToolbar({
  armada,
  calibrando,
  motivos,
  motivoCalibrar,
  restar,
  onHerramienta,
  onCalibrar,
  onRestar,
  onZoom,
  onAjustar,
}: {
  armada: Armada;
  calibrando: boolean;
  motivos: Record<Herramienta, MotivoVisor | null>;
  motivoCalibrar: string | null;
  restar: boolean;
  onHerramienta: (h: Armada) => void;
  onCalibrar: () => void;
  onRestar: () => void;
  onZoom: (f: number) => void;
  onAjustar: () => void;
}) {
  const tip = (nombre: string, tecla: string, motivo?: string | null) =>
    `${nombre} (${tecla})${motivo ? ` — ${motivo}` : ''}`;
  return (
    <div className={styles.toolbar}>
      <div role="radiogroup" aria-label="Herramienta" className={styles.toolGroup}>
        <button
          type="button"
          role="radio"
          aria-checked={!calibrando && armada === 'mano'}
          className={`tcol ${styles.tool} ${!calibrando && armada === 'mano' ? styles.toolOn : ''}`}
          title={tip('Mano: mover y seleccionar', TECLA.mano)}
          aria-label="Mano"
          onClick={() => onHerramienta('mano')}
        >
          <Icon name="hand" size={16} />
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={calibrando}
          aria-disabled={motivoCalibrar ? true : undefined}
          className={`tcol ${styles.tool} ${calibrando ? styles.toolOn : ''} ${motivoCalibrar ? styles.toolOff : ''}`}
          title={tip('Calibrar la escala de esta página', TECLA.calibrar, motivoCalibrar)}
          aria-label="Calibrar"
          onClick={onCalibrar}
        >
          <Icon name="crosshair" size={16} />
        </button>
        <span className={styles.toolSep} aria-hidden="true" />
        {HERRAMIENTAS_MEDIR.map((h) => {
          const m = motivos[h];
          const on = !calibrando && armada === h;
          return (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={on}
              aria-disabled={m ? true : undefined}
              className={`tcol ${styles.tool} ${on ? styles.toolOn : ''} ${m ? styles.toolOff : ''}`}
              title={tip(NOMBRE_HERRAMIENTA[h], TECLA[h], m ? textoMotivoVisor(m) : null)}
              aria-label={NOMBRE_HERRAMIENTA[h]}
              onClick={() => onHerramienta(h)}
            >
              <Icon name={ICONO[h]} size={16} />
            </button>
          );
        })}
      </div>
      <span className={styles.toolSep} aria-hidden="true" />
      <button
        type="button"
        aria-pressed={restar}
        className={`tcol ${styles.tool} ${restar ? styles.toolOn : ''}`}
        title={tip('Restar: la medida descuenta (huecos)', TECLA.restar)}
        aria-label="Restar"
        onClick={onRestar}
      >
        <Icon name="minus" size={16} />
      </button>
      <span className={styles.toolFill} />
      <button type="button" className={`tcol ${styles.tool}`} title="Alejar (−)" aria-label="Alejar" onClick={() => onZoom(1 / 1.25)}>
        <Icon name="zoomOut" size={16} />
      </button>
      <button type="button" className={`tcol ${styles.tool}`} title="Acercar (+)" aria-label="Acercar" onClick={() => onZoom(1.25)}>
        <Icon name="zoomIn" size={16} />
      </button>
      <button
        type="button"
        className={`tcol ${styles.tool}`}
        title={`Ajustar a la ventana (${TECLA.ajustar})`}
        aria-label="Ajustar a la ventana"
        onClick={onAjustar}
      >
        <Icon name="scan" size={16} />
      </button>
    </div>
  );
}

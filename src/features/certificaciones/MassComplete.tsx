import { useState } from 'react';
import { Icon, Modal } from '../../components';
import type { CompleteScope } from './completeScope';
import styles from './Certificaciones.module.css';

/**
 * Botón masivo «Completar {alcance}» + confirmación. Alcance WYSIWYG (eng review
 * Issue 5): el padre pasa EXACTAMENTE las partidas visibles ya clasificadas
 * (`scope`) y su nombre; el botón nunca decide qué toca. Deshabilitado (con
 * tooltip) si no hay nada que rellenar. La confirmación desglosa el impacto por
 * categoría antes de aplicar (no sorpresas al sobrescribir cantidades tecleadas).
 */
export function MassComplete({
  scopeName,
  scope,
  onConfirm,
  compact,
}: {
  scopeName: string; // «obra» | «capítulo» | «lo visible»
  scope: CompleteScope;
  onConfirm: (ids: string[]) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const disabled = scope.fill === 0;
  return (
    <>
      <button
        type="button"
        className={`tcol ${styles.massBtn}`}
        disabled={disabled}
        title={disabled ? 'Nada que completar en lo visible' : undefined}
        onClick={() => setOpen(true)}
      >
        <Icon name="check" size={14} />
        Completar {scopeName}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Completar ${scopeName}`}
        subtitle="Se marca al 100% a origen. No reduce cantidades ya tecleadas por encima."
        icon="clipboardCheck"
        compact={compact}
        footer={
          <>
            <button type="button" className={`tcol ${styles.mcCancel}`} onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className={styles.mcConfirm}
              onClick={() => {
                onConfirm(scope.ids);
                setOpen(false);
              }}
            >
              <Icon name="check" size={14} />
              Completar {scope.fill}
            </button>
          </>
        }
      >
        <ul className={styles.massList}>
          <li>
            <b className="mono">{scope.fill}</b> partida{scope.fill === 1 ? '' : 's'} se rellena
            {scope.fill === 1 ? '' : 'n'} al 100%.
          </li>
          {scope.withLines > 0 && (
            <li className={styles.massWarn}>
              <b className="mono">{scope.withLines}</b> se certificaba
              {scope.withLines === 1 ? '' : 'n'} por líneas: se marcan todas sus líneas.
            </li>
          )}
          {scope.already > 0 && (
            <li className={styles.massMuted}>
              <b className="mono">{scope.already}</b> ya al 100% (intacta
              {scope.already === 1 ? '' : 's'}).
            </li>
          )}
          {scope.skipped > 0 && (
            <li className={styles.massMuted}>
              <b className="mono">{scope.skipped}</b> sin cantidad ofertada: se salta
              {scope.skipped === 1 ? '' : 'n'}.
            </li>
          )}
        </ul>
      </Modal>
    </>
  );
}

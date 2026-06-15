/* ===========================================================================
   CowDialog — copy-on-write al editar conceptos referenciados (estilo
   Arquímedes/CYPE). Un ÚNICO cuadro consciente del contexto (eng-review C5):

   · partida `fromBase` (de base/biblioteca) → "para editarla se crea una copia".
   · recurso COMPARTIDO (usado por ≥2 partidas) → forkar copia privada vs. editar
     en todas.

   Cuando se dan las dos a la vez, combina ambas en una sola decisión. La casilla
   "no volver a preguntar en esta partida" (C6) solo aparece en el caso compartido
   (el de partida base se resuelve en la primera edición, que ya quita el chip).

   El chrome (overlay/scrim, cabecera, pie, trap de foco, Esc) lo aporta `Modal`.
   =========================================================================== */
import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import type { CowChoice } from '../../store';
import styles from './CowDialog.module.css';

export interface CowDialogProps {
  /** La partida viene de base (chip BASE) → editar crea una copia. */
  isBase: boolean;
  /** El recurso editado lo usan ≥2 partidas → forkar vs editar en todas. */
  shared: boolean;
  /** Elección del usuario; `remember` guarda la decisión para esta partida. */
  onChoose: (choice: CowChoice, remember: boolean) => void;
  onCancel: () => void;
}

// `isBase` se acepta por completitud de la API; cuando NO es compartido el
// cuadro solo sale para partidas base, así que el texto se decide por `shared`.
export function CowDialog({ shared, onChoose, onCancel }: CowDialogProps) {
  const bp = useBreakpoint();
  const [remember, setRemember] = useState(false);

  const title = shared ? 'Este concepto se usa en varias partidas' : 'Partida de base';
  const subtitle = shared
    ? 'Puedes crear una copia solo para esta partida o cambiarlo en todas las que lo usan.'
    : 'Esta partida viene de una base. Al editarla se convierte en tu copia editable.';

  return (
    <Modal
      open
      onClose={onCancel}
      compact={bp.isMobile}
      icon={shared ? 'layers' : 'pencil'}
      title={title}
      subtitle={subtitle}
      closeOnOverlay={false}
      footer={
        <>
          <button type="button" onClick={onCancel} className={`tcol ${styles.cancel}`}>
            Cancelar
          </button>
          {shared && (
            <button
              type="button"
              onClick={() => onChoose('all', remember)}
              className={`tcol ${styles.secondary}`}
            >
              Editar en todas
            </button>
          )}
          <button
            type="button"
            onClick={() => onChoose('copy', remember)}
            className={styles.confirm}
          >
            Crear copia
          </button>
        </>
      }
    >
      <p className={styles.body}>
        {shared
          ? 'Si creas una copia, el cambio afecta solo a esta partida y las demás quedan intactas.'
          : 'La base original sigue disponible en el panel de Referencia para reutilizarla.'}
      </p>
      {shared && (
        <label className={styles.remember}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          No volver a preguntar en esta partida
        </label>
      )}
    </Modal>
  );
}

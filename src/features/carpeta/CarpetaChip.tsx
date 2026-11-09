/* ===========================================================================
   CarpetaChip — el estado de la obra en su carpeta, junto al nombre de la obra
   (docs/plan-agente-carpeta.md F3). No sale si la obra no está en una carpeta.

     · al día / guardando: «En carpeta»; el título dice cuál y qué fichero.
     · sin permiso: «Conectar la carpeta» (el navegador pide el permiso con un clic).
     · conflicto: «Cambió en la carpeta» → el técnico elige (ConflictoCarpeta).
     · error: el aviso, al pulsar.
   =========================================================================== */
import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import {
  conectarCarpeta,
  quedarmeConLaMia,
  useCarpetaStore,
  usarLaDeLaCarpeta,
} from '../../persist/carpeta';
import { useToastStore } from '../../store';
import styles from './CarpetaChip.module.css';

export function CarpetaChip() {
  const estado = useCarpetaStore((s) => s.estado);
  const [viendoConflicto, setViendoConflicto] = useState(false);
  const bp = useBreakpoint();

  if (estado.tipo === 'sin-carpeta') return null;

  if (estado.tipo === 'sin-permiso') {
    return (
      <button
        type="button"
        className={`tcol ${styles.chip} ${styles.aviso}`}
        onClick={() => void conectarCarpeta()}
        title={`La obra está en la carpeta ${estado.carpeta}. El navegador pide permiso para usarla otra vez.`}
      >
        <Icon name="folder" size={13} />
        <span className={styles.texto}>Conectar</span>
      </button>
    );
  }

  if (estado.tipo === 'conflicto') {
    return (
      <>
        <button
          type="button"
          className={`tcol ${styles.chip} ${styles.aviso}`}
          onClick={() => setViendoConflicto(true)}
          title="La obra cambió en su carpeta mientras tenías cambios sin llevar a ella"
        >
          <Icon name="alert" size={13} />
          <span className={styles.texto}>Revisar</span>
        </button>
        {viendoConflicto && (
          <ConflictoCarpeta
            carpeta={estado.carpeta}
            resumen={estado.resumen}
            compact={bp.isMobile}
            onClose={() => setViendoConflicto(false)}
          />
        )}
      </>
    );
  }

  if (estado.tipo === 'error') {
    return (
      <button
        type="button"
        className={`tcol ${styles.chip} ${styles.aviso}`}
        onClick={() => useToastStore.getState().show(estado.mensaje, undefined, { tone: 'warn' })}
        title={estado.mensaje}
      >
        <Icon name="alert" size={13} />
        <span className={styles.srOnly}>Problema con la carpeta</span>
      </button>
    );
  }

  const titulo =
    estado.tipo === 'conectando'
      ? `Conectando con la carpeta ${estado.carpeta}…`
      : `${estado.tipo === 'guardando' ? 'Guardando en' : 'Al día con'} la carpeta ${estado.carpeta} (${estado.fichero}). Lo que cambie Claude en ella aparece aquí.`;
  // Tranquilo: solo el icono (la barra va justa); lo dice el título y el lector de pantalla.
  return (
    <span className={`${styles.chip} ${styles.quieto}`} title={titulo} role="status">
      <Icon name={estado.tipo === 'al-dia' ? 'folder' : 'loader'} size={13} />
      <span className={styles.srOnly}>{titulo}</span>
    </span>
  );
}

function ConflictoCarpeta({
  carpeta,
  resumen,
  compact,
  onClose,
}: {
  carpeta: string;
  resumen: string;
  compact: boolean;
  onClose: () => void;
}) {
  const elegir = (fn: () => Promise<void>) => () => {
    void fn();
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      compact={compact}
      icon="alert"
      title="La obra cambió en su carpeta"
      subtitle={`Mientras tenías cambios sin llevar a la carpeta ${carpeta}`}
      footer={
        <>
          <button
            type="button"
            className={`tcol ${styles.secundario}`}
            onClick={elegir(quedarmeConLaMia)}
          >
            Quedarme con la mía
          </button>
          <button type="button" className={styles.primario} onClick={elegir(usarLaDeLaCarpeta)}>
            Usar la de la carpeta
          </button>
        </>
      }
    >
      <div className={styles.conflicto}>
        <p>
          La de la carpeta la habrá cambiado Claude. Si la usas, lo que ves aquí cambiaría en:{' '}
          <strong>{resumen || 'detalles'}</strong>.
        </p>
        <ul>
          <li>
            <strong>Usar la de la carpeta</strong>: tus cambios de estos segundos no se pierden, se
            recuperan con Deshacer.
          </li>
          <li>
            <strong>Quedarme con la mía</strong>: la de la carpeta se guarda aparte, en su carpeta{' '}
            <code>.mediciones</code>, y se sustituye por la tuya.
          </li>
        </ul>
      </div>
    </Modal>
  );
}

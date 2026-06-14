import { useState } from 'react';
import { Icon, Modal } from '../../components';
import { fmtCents, fmtNum } from '../../core/money';
import { selectPem, useObraStore } from '../../store';
import { Bc3Dropzone, Bc3ErrorCard, Bc3ResultSummary } from './importShared';
import { useBc3Parse } from './useBc3Parse';
import styles from './Importar.module.css';

/**
 * Vista Importar (F5.3): arrastra/elige un .bc3 (FIEBDC-3), se parsea con la
 * librería `bc3` y se mapea a la obra (`core/bc3import`). Muestra un resumen con
 * el gate de PEM contra el precio raíz; al confirmar REEMPLAZA la obra actual.
 * (La importación como obra de referencia vive en `ReferenciaImportModal`, que
 * comparte el parseo/resumen vía `importShared` pero AÑADE en vez de reemplazar.)
 */
export function ImportarView({ compact }: { compact: boolean }) {
  const loadObra = useObraStore((s) => s.loadObra);
  const { busy, error, diag, result, fileName, handleFile } = useBc3Parse();
  // Lo que se perdería al reemplazar: se enseña en el modal de confirmación.
  const obraActual = useObraStore((s) => s.obra.denominacion);
  const pemActual = useObraStore(selectPem);
  const partidasActuales = useObraStore((s) =>
    Object.values(s.partidas).reduce((a, ps) => a + ps.length, 0),
  );
  const certsConDatos = useObraStore(
    (s) => s.certs.filter((c) => Object.keys(c.data).length > 0).length,
  );
  const [confirming, setConfirming] = useState(false);

  function confirm() {
    if (!result) return;
    setConfirming(false);
    loadObra(result.data); // el store salta a Presupuesto
  }

  return (
    <div className={`fadeUp ${styles.view} ${compact ? styles.compact : ''}`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.headIcon}>
            <Icon name="upload" size={compact ? 22 : 26} />
          </div>
          <h1 className={styles.title}>Importar obra</h1>
          <p className={styles.desc}>
            Arrastra un archivo <strong>.bc3</strong> (FIEBDC-3) de Presto, Arquímedes o CYPE para
            cargar capítulos, partidas, mediciones y banco de recursos.
          </p>
        </header>

        <Bc3Dropzone busy={busy} onFile={handleFile} />

        {error && <Bc3ErrorCard error={error} diag={diag} />}

        {result && (
          <Bc3ResultSummary result={result} fileName={fileName}>
            <div className={styles.actions}>
              <span className={styles.replaceHint}>Reemplazará la obra actual.</span>
              <button
                type="button"
                className={styles.confirm}
                onClick={() => setConfirming(true)}
                disabled={busy}
              >
                <Icon name="arrowLeft" size={15} style={{ transform: 'rotate(90deg)' }} />
                Cargar al presupuesto
              </button>
            </div>
          </Bc3ResultSummary>
        )}
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Reemplazar la obra actual"
        subtitle="Esta acción no se puede deshacer"
        icon="alert"
        compact={compact}
        footer={
          <>
            <button type="button" className={styles.cancel} onClick={() => setConfirming(false)}>
              Cancelar
            </button>
            <button type="button" className={styles.danger} onClick={confirm}>
              Reemplazar y cargar
            </button>
          </>
        }
      >
        <p className={styles.confirmBody}>
          Se reemplazará <strong>{obraActual || 'la obra actual'}</strong> — {fmtNum(partidasActuales, 0)}{' '}
          partidas · PEM {fmtCents(pemActual)}
          {certsConDatos > 0 && (
            <>
              {' '}
              · <strong>{certsConDatos} {certsConDatos > 1 ? 'certificaciones' : 'certificación'} con datos</strong>
            </>
          )}{' '}
          — por <strong>{result?.data.obra.denominacion || fileName}</strong> ({fileName}).
        </p>
      </Modal>
    </div>
  );
}

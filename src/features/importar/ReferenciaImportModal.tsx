/* ===========================================================================
   ReferenciaImportModal — importar un .bc3 como obra de SOLO REFERENCIA desde el
   panel de Referencia, SIN reemplazar la obra que editas. Comparte parseo/resumen
   con ImportarView (`importShared`); la diferencia es la confirmación: en vez de
   `loadObra` (reemplaza) llama `importObraAsReference` (crea obra nueva tag
   `reference`, la selecciona como fuente) y avisa con un toast. Vive como modal
   SOBRE el panel: no cierra el panel ni cambia de vista.

   App vacía (sin obra activa): no hay nada que proteger, así que la importación
   se carga como obra de TRABAJO (ruta `loadObra`) para no dejar al usuario con una
   referencia y ningún presupuesto donde copiar.
   =========================================================================== */
import { useEffect, useState } from 'react';
import { Modal } from '../../components';
import { importObraAsReference, useSessionStore } from '../../persist';
import { useObraStore, useToastStore } from '../../store';
import { Bc3Dropzone, Bc3ErrorCard, Bc3ResultSummary } from './importShared';
import { useBc3Parse } from './useBc3Parse';
import styles from './Importar.module.css';

export function ReferenciaImportModal({
  open,
  onClose,
  compact,
}: {
  open: boolean;
  onClose: () => void;
  compact: boolean;
}) {
  const { busy, error, diag, result, fileName, handleFile, reset } = useBc3Parse();
  const [importing, setImporting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadObra = useObraStore((s) => s.loadObra);
  const setRefSource = useObraStore((s) => s.setRefSource);
  const setRefOpen = useObraStore((s) => s.setRefOpen);
  const activeId = useSessionStore((s) => s.activeId);
  const show = useToastStore((s) => s.show);

  // Al cerrar, limpia el estado para que la próxima apertura empiece en blanco.
  useEffect(() => {
    if (!open) {
      reset();
      setImporting(false);
      setSaveError(null);
    }
  }, [open, reset]);

  async function confirm() {
    if (!result || importing) return;
    const name = result.data.obra.denominacion || fileName;

    // App sin obra activa: cárgala como obra de trabajo (no hay nada que proteger).
    if (activeId === null) {
      loadObra(result.data); // navega a Presupuesto y cierra el panel
      show(`«${name}» cargada`);
      onClose();
      return;
    }

    setImporting(true);
    setSaveError(null);
    try {
      const id = await importObraAsReference(result.data);
      setRefSource(`obra:${id}`);
      setRefOpen(true);
      show(`«${name}» añadida como referencia`);
      onClose();
    } catch {
      setSaveError('No se pudo guardar la obra de referencia. Inténtalo de nuevo.');
      setImporting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Añadir base de referencia"
      subtitle="Se añade como obra nueva para copiar partidas — no reemplaza la actual"
      icon="upload"
      compact={compact}
      footer={
        <>
          <button type="button" className={styles.cancel} onClick={onClose} disabled={importing}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.confirm}
            onClick={confirm}
            disabled={!result || busy || importing}
          >
            {importing ? 'Añadiendo…' : 'Añadir como referencia'}
          </button>
        </>
      }
    >
      <Bc3Dropzone busy={busy} onFile={handleFile} />
      {error && <Bc3ErrorCard error={error} diag={diag} />}
      {result && <Bc3ResultSummary result={result} fileName={fileName} />}
      {saveError && <Bc3ErrorCard error={saveError} diag={[]} />}
    </Modal>
  );
}

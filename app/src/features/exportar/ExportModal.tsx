import type { CSSProperties, ReactNode } from 'react';
import { Icon, Modal, type IconName } from '../../components';
import { useObraStore } from '../../store';
import type { PrintTarget } from '../print';
import styles from './Exportar.module.css';

/** Colores de chip por formato (DESIGN.md). Los formatos llegan por slice:
 *  en F7.1 solo PDF está construido y solo PDF se muestra (design review D2,
 *  "mostrar solo lo que funciona"); DOCX/XLSX/BC3 aparecerán al shipear F7.2+. */
const CHIP_PDF: CSSProperties = { ['--chip' as string]: 'var(--state-warn)' };

function Row({
  icon,
  accent,
  title,
  sub,
  onPdf,
}: {
  icon: IconName;
  accent?: boolean;
  title: string;
  sub: string;
  onPdf: () => void;
}) {
  return (
    <div className={styles.row}>
      <span className={`${styles.rowIcon} ${accent ? styles.accent : ''}`}>
        <Icon name={icon} size={17} />
      </span>
      <div className={styles.rowBody}>
        <div className={styles.rowTitle}>{title}</div>
        <div className={styles.rowSub}>{sub}</div>
      </div>
      <div className={styles.chips}>
        <button
          type="button"
          className={styles.chip}
          style={CHIP_PDF}
          title={`Exportar «${title}» a PDF`}
          aria-label={`Exportar «${title}» a PDF`}
          onClick={onPdf}
        >
          PDF
        </button>
      </div>
    </div>
  );
}

/**
 * Modal Exportar (F7.1): elige listado y formato sobre la primitiva `Modal`
 * (focus-trap de F6.2). `onExportPdf` monta el doc de impresión bajo demanda
 * (→ `window.print()` → "Guardar como PDF" del navegador).
 */
export function ExportModal({
  open,
  onClose,
  compact,
  onExportPdf,
}: {
  open: boolean;
  onClose: () => void;
  compact?: boolean;
  onExportPdf: (target: PrintTarget) => void;
}): ReactNode {
  const certs = useObraStore((s) => s.certs);
  const doPdf = (target: PrintTarget) => {
    onClose();
    onExportPdf(target);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      compact={compact}
      icon="download"
      title="Exportar"
      subtitle="Elige el listado y el formato"
      footer={
        <span className={styles.foot}>
          PDF imprimible al instante (Guardar como PDF del navegador) · Word, Excel y BC3 llegarán
          en próximas fases.
        </span>
      }
    >
      <Row
        icon="doc"
        title="Presupuesto y mediciones"
        sub="Partidas con precio, descripción y líneas de medición"
        onPdf={() => doPdf({ kind: 'presupuesto' })}
      />
      <Row
        icon="list"
        title="Resumen de presupuesto"
        sub="Importes y porcentajes por capítulo"
        onPdf={() => doPdf({ kind: 'resumen' })}
      />
      {certs.length > 0 && (
        <>
          <div className={`sec-head ${styles.secHead}`}>Certificaciones de obra</div>
          {certs.map((c, i) => {
            const congelados = c.snapshotAt
              ? ` · precios congelados ${new Date(c.snapshotAt).toLocaleDateString('es-ES')}`
              : '';
            return (
              <Row
                key={c.id}
                icon="clipboardCheck"
                accent
                title={`Certificación nº ${c.num}`}
                sub={`${c.period || 'sin periodo'} · a origen${congelados}`}
                onPdf={() => doPdf({ kind: 'cert', index: i })}
              />
            );
          })}
        </>
      )}
    </Modal>
  );
}

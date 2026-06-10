import type { CSSProperties, ReactNode } from 'react';
import { Icon, Modal, type IconName } from '../../components';
import { useObraStore } from '../../store';
import type { PrintTarget } from '../print';
import styles from './Exportar.module.css';

/** Colores de chip por formato (DESIGN.md: PDF=warn, XLSX=ok, DOCX=accent,
 *  BC3=mq). Los formatos llegan por slice ("mostrar solo lo que funciona",
 *  design review D2): PDF (F7.1), Excel (F7.2) y Word (F7.3); BC3 en F7.4. */
const CHIP_PDF: CSSProperties = { ['--chip' as string]: 'var(--state-warn)' };
const CHIP_XLSX: CSSProperties = { ['--chip' as string]: 'var(--state-ok)' };
const CHIP_DOCX: CSSProperties = { ['--chip' as string]: 'var(--accent)' };

function Chip({
  label,
  fmt,
  doc,
  style,
  onClick,
}: {
  label: string;
  fmt: string;
  doc: string;
  style: CSSProperties;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.chip}
      style={style}
      title={`Exportar «${doc}» a ${fmt}`}
      aria-label={`Exportar «${doc}» a ${fmt}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function Row({
  icon,
  accent,
  title,
  sub,
  onPdf,
  onXlsx,
  onDocx,
}: {
  icon: IconName;
  accent?: boolean;
  title: string;
  sub: string;
  onPdf: () => void;
  onXlsx: () => void;
  onDocx: () => void;
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
        <Chip label="PDF" fmt="PDF" doc={title} style={CHIP_PDF} onClick={onPdf} />
        <Chip label="Word" fmt="Word" doc={title} style={CHIP_DOCX} onClick={onDocx} />
        <Chip label="Excel" fmt="Excel" doc={title} style={CHIP_XLSX} onClick={onXlsx} />
      </div>
    </div>
  );
}

/**
 * Modal Exportar (F7.1–F7.3): elige listado y formato sobre la primitiva
 * `Modal` (focus-trap de F6.2). `onExportPdf` monta el doc de impresión bajo
 * demanda (→ `window.print()` → "Guardar como PDF" del navegador);
 * `onExportXlsx`/`onExportDocx` generan y descargan el archivo.
 */
export function ExportModal({
  open,
  onClose,
  compact,
  onExportPdf,
  onExportXlsx,
  onExportDocx,
}: {
  open: boolean;
  onClose: () => void;
  compact?: boolean;
  onExportPdf: (target: PrintTarget) => void;
  onExportXlsx: (target: PrintTarget) => void;
  onExportDocx: (target: PrintTarget) => void;
}): ReactNode {
  const certs = useObraStore((s) => s.certs);
  const doPdf = (target: PrintTarget) => {
    onClose();
    onExportPdf(target);
  };
  const doXlsx = (target: PrintTarget) => {
    onClose();
    onExportXlsx(target);
  };
  const doDocx = (target: PrintTarget) => {
    onClose();
    onExportDocx(target);
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
          PDF imprimible al instante (Guardar como PDF del navegador) · Word y Excel descargan el
          archivo · BC3 (FIEBDC-3) llegará en una fase posterior.
        </span>
      }
    >
      <Row
        icon="doc"
        title="Presupuesto y mediciones"
        sub="Partidas con precio, descripción y líneas de medición"
        onPdf={() => doPdf({ kind: 'presupuesto' })}
        onXlsx={() => doXlsx({ kind: 'presupuesto' })}
        onDocx={() => doDocx({ kind: 'presupuesto' })}
      />
      <Row
        icon="list"
        title="Resumen de presupuesto"
        sub="Importes y porcentajes por capítulo"
        onPdf={() => doPdf({ kind: 'resumen' })}
        onXlsx={() => doXlsx({ kind: 'resumen' })}
        onDocx={() => doDocx({ kind: 'resumen' })}
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
                onXlsx={() => doXlsx({ kind: 'cert', index: i })}
                onDocx={() => doDocx({ kind: 'cert', index: i })}
              />
            );
          })}
        </>
      )}
    </Modal>
  );
}

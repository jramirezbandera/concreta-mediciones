import type { CSSProperties, ReactNode } from 'react';
import { Icon, Modal, type IconName } from '../../components';
import { useObraStore } from '../../store';
import type { PrintTarget } from '../print';
import styles from './Exportar.module.css';

/** Colores de chip por formato (DESIGN.md: PDF=warn, XLSX=ok, DOCX=accent,
 *  BC3=mq). Los formatos llegaron por slice ("mostrar solo lo que funciona",
 *  design review D2): PDF (F7.1), Excel (F7.2), Word (F7.3) y BC3 (F7.4). */
const CHIP_PDF: CSSProperties = { ['--chip' as string]: 'var(--state-warn)' };
const CHIP_XLSX: CSSProperties = { ['--chip' as string]: 'var(--state-ok)' };
const CHIP_DOCX: CSSProperties = { ['--chip' as string]: 'var(--accent)' };
const CHIP_BC3: CSSProperties = { ['--chip' as string]: 'var(--state-mq)' };

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
  onBc3,
}: {
  icon: IconName;
  accent?: boolean;
  title: string;
  sub: string;
  onPdf: () => void;
  onXlsx: () => void;
  onDocx: () => void;
  /** Solo las filas que también salen en .bc3 (las mediciones sin precios). */
  onBc3?: () => void;
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
        {onBc3 && <Chip label="BC3" fmt="BC3 (FIEBDC-3)" doc={title} style={CHIP_BC3} onClick={onBc3} />}
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
  onExportBc3,
}: {
  open: boolean;
  onClose: () => void;
  compact?: boolean;
  onExportPdf: (target: PrintTarget) => void;
  onExportXlsx: (target: PrintTarget) => void;
  onExportDocx: (target: PrintTarget) => void;
  /** `sinPrecios`: las mediciones para pedir ofertas (docs/plan-ofertas.md). */
  onExportBc3: (sinPrecios?: boolean) => void;
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
  const doBc3 = (sinPrecios = false) => {
    onClose();
    onExportBc3(sinPrecios);
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
          archivo · BC3 (FIEBDC-3) abre en Presto, Arquímedes y otros.
        </span>
      }
    >
      {/* Cabecera: la obra completa en el formato de intercambio del sector. */}
      <div className={styles.row}>
        <span className={styles.rowIcon}>
          <Icon name="download" size={17} />
        </span>
        <div className={styles.rowBody}>
          <div className={styles.rowTitle}>Obra completa</div>
          <div className={styles.rowSub}>Presupuesto y mediciones en FIEBDC-3 (.bc3)</div>
        </div>
        <div className={styles.chips}>
          <Chip label="BC3" fmt="BC3 (FIEBDC-3)" doc="Obra completa" style={CHIP_BC3} onClick={() => doBc3()} />
        </div>
      </div>
      <Row
        icon="doc"
        title="Presupuesto y mediciones"
        sub="Partidas con precio, descripción y líneas de medición"
        onPdf={() => doPdf({ kind: 'presupuesto' })}
        onXlsx={() => doXlsx({ kind: 'presupuesto' })}
        onDocx={() => doDocx({ kind: 'presupuesto' })}
      />
      <Row
        icon="send"
        title="Mediciones sin precios"
        sub="Para pedir ofertas: el Excel y el BC3 llevan el precio en blanco para rellenar"
        onPdf={() => doPdf({ kind: 'mediciones' })}
        onXlsx={() => doXlsx({ kind: 'mediciones' })}
        onDocx={() => doDocx({ kind: 'mediciones' })}
        onBc3={() => doBc3(true)}
      />
      <Row
        icon="list"
        title="Resumen de presupuesto"
        sub="Importes y porcentajes por capítulo"
        onPdf={() => doPdf({ kind: 'resumen' })}
        onXlsx={() => doXlsx({ kind: 'resumen' })}
        onDocx={() => doDocx({ kind: 'resumen' })}
      />
      <Row
        icon="hash"
        title="Cuadro de precios nº 1"
        sub="Precio de cada partida en cifra y en letra"
        onPdf={() => doPdf({ kind: 'cuadro1' })}
        onXlsx={() => doXlsx({ kind: 'cuadro1' })}
        onDocx={() => doDocx({ kind: 'cuadro1' })}
      />
      <Row
        icon="layers"
        title="Cuadro de precios nº 2"
        sub="Precio de cada partida descompuesto"
        onPdf={() => doPdf({ kind: 'cuadro2' })}
        onXlsx={() => doXlsx({ kind: 'cuadro2' })}
        onDocx={() => doDocx({ kind: 'cuadro2' })}
      />
      {certs.length > 0 && (
        <>
          <div className={`sec-head ${styles.secHead}`}>Certificaciones de obra</div>
          <Row
            icon="check"
            accent
            title="Liquidación final"
            sub={`Presupuestado frente a ejecutado según la certificación nº ${certs[certs.length - 1]!.num}`}
            onPdf={() => doPdf({ kind: 'liquidacion' })}
            onXlsx={() => doXlsx({ kind: 'liquidacion' })}
            onDocx={() => doDocx({ kind: 'liquidacion' })}
          />
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

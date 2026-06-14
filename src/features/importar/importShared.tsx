/* ===========================================================================
   importShared — componentes reutilizables del flujo de importación .bc3,
   compartidos por la vista a pantalla completa (ImportarView, REEMPLAZA la obra)
   y el modal del panel de Referencia (ReferenciaImportModal, AÑADE como obra de
   referencia). El estado/parseo vive en `useBc3Parse`; lo único que cambia entre
   superficies es la acción de confirmación y su copy.
   =========================================================================== */
import { useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../components';
import { type Bc3ImportResult } from '../../core/bc3import';
import { fmtCents, fmtNum, toEur } from '../../core/money';
import styles from './Importar.module.css';

/** Zona de soltar/elegir un .bc3 (con input file accesible). */
export function Bc3Dropzone({
  busy,
  onFile,
}: {
  busy: boolean;
  onFile: (file: File | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`${styles.drop} ${over ? styles.over : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files?.[0]);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Soltar o elegir un archivo .bc3"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".bc3"
        className={styles.fileInput}
        onChange={(e) => onFile(e.target.files?.[0] ?? undefined)}
      />
      <Icon name={busy ? 'loader' : 'upload'} size={28} className={busy ? styles.spin : ''} />
      <div className={styles.dropTitle}>{busy ? 'Procesando…' : 'Suelta el .bc3 aquí'}</div>
      <div className={styles.dropHint}>o haz clic para elegir un archivo</div>
    </div>
  );
}

/** Tarjeta de error de importación (mensaje + diagnósticos). */
export function Bc3ErrorCard({ error, diag }: { error: string; diag: string[] }) {
  return (
    <div className={`${styles.card} ${styles.errorCard}`}>
      <div className={styles.errorHead}>
        <Icon name="alert" size={16} /> No se pudo importar
      </div>
      <p className={styles.errorMsg}>{error}</p>
      {diag.length > 0 && (
        <ul className={styles.diagList}>
          {diag.slice(0, 8).map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Una fila de dato del resumen de importación. */
function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={styles.stat}>
      <div className={`caps ${styles.statLabel}`}>{label}</div>
      <div className={`mono ${styles.statVal} ${accent ? styles.accent : ''}`}>{value}</div>
    </div>
  );
}

/** Resumen del .bc3 parseado (cabecera + stats + gate de PEM + avisos). El slot
 *  `children` es la fila de acción específica de cada superficie (o nada, si la
 *  acción vive en el pie de un modal). */
export function Bc3ResultSummary({
  result,
  fileName,
  children,
}: {
  result: Bc3ImportResult;
  fileName: string;
  children?: ReactNode;
}) {
  const r = result.report;
  const deltaEur = r.deltaCents != null ? toEur(r.deltaCents) : null;
  return (
    <div className={`${styles.card} ${styles.resultCard}`}>
      <div className={styles.resultHead}>
        <span className={styles.resultFile}>
          <Icon name="doc" size={15} /> {fileName}
        </span>
        <span className={styles.resultMeta}>
          {r.program ?? '—'} · {r.version ?? 'FIEBDC-3'} · {r.charset}
        </span>
      </div>

      <div className={styles.stats}>
        <Stat label="Capítulos" value={String(r.chapters)} />
        <Stat label="Partidas" value={String(r.partidas)} />
        <Stat label="Recursos" value={String(r.recursos)} />
        {/* El CI del ~K entra como línea «Costes indirectos» en cada partida
            (K queda en 1). Se muestra el % si lo hay. */}
        {r.ciPct > 0 ? (
          <Stat label="Costes indir." value={`${fmtNum(r.ciPct, 2)} %`} />
        ) : (
          <Stat label="Coef. K" value={`×${fmtNum(r.coefK, 4)}`} />
        )}
        <Stat label="PEM" value={fmtCents(r.pemCents)} accent />
        {r.rootPriceCents != null && <Stat label="PEM en el .bc3" value={fmtCents(r.rootPriceCents)} />}
      </div>

      {deltaEur != null && (
        <div className={`${styles.gate} ${Math.abs(deltaEur) < 1 ? styles.ok : styles.warn}`}>
          <Icon name={Math.abs(deltaEur) < 1 ? 'check' : 'alert'} size={14} />
          {Math.abs(deltaEur) < 1
            ? `El PEM cuadra con el archivo (Δ ${fmtNum(deltaEur)} €, redondeo).`
            : `Desviación de PEM: ${fmtNum(deltaEur)} € — revisa el archivo.`}
        </div>
      )}

      {r.warnings.length > 0 && (
        <ul className={styles.warnList}>
          {r.warnings.map((w, i) => (
            <li key={i}>
              <Icon name="alert" size={12} /> {w}
            </li>
          ))}
        </ul>
      )}

      {children}
    </div>
  );
}

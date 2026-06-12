import { useRef, useState } from 'react';
import { Icon, Modal } from '../../components';
import { Bc3ImportError, type Bc3ImportResult } from '../../core/bc3import';
import { fmtCents, fmtNum, toEur } from '../../core/money';
import { selectPem, useObraStore } from '../../store';
import { parseBc3 } from './parseBc3';
import styles from './Importar.module.css';

/** Lee un File como bytes. Usa `arrayBuffer()` si existe; si no, `FileReader`
 *  (compatible con todos los navegadores y con jsdom en los tests). */
function readBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer().then((b) => new Uint8Array(b));
  }
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(new Uint8Array(fr.result as ArrayBuffer));
    fr.onerror = () => rej(fr.error ?? new Error('No se pudo leer el archivo.'));
    fr.readAsArrayBuffer(file);
  });
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

/**
 * Vista Importar (F5.3): arrastra/elige un .bc3 (FIEBDC-3), se parsea con la
 * librería `bc3` y se mapea a la obra (`core/bc3import`). Muestra un resumen con
 * el gate de PEM contra el precio raíz; al confirmar reemplaza la obra actual.
 */
export function ImportarView({ compact }: { compact: boolean }) {
  const loadObra = useObraStore((s) => s.loadObra);
  // Lo que se perdería al reemplazar: se enseña en el modal de confirmación.
  const obraActual = useObraStore((s) => s.obra.denominacion);
  const pemActual = useObraStore(selectPem);
  const partidasActuales = useObraStore((s) =>
    Object.values(s.partidas).reduce((a, ps) => a + ps.length, 0),
  );
  const certsConDatos = useObraStore(
    (s) => s.certs.filter((c) => Object.keys(c.data).length > 0).length,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diag, setDiag] = useState<string[]>([]);
  const [result, setResult] = useState<Bc3ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [confirming, setConfirming] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setDiag([]);
    setResult(null);
    try {
      const bytes = await readBytes(file);
      const res = await parseBc3(bytes); // Web Worker: la UI no se congela
      setResult(res);
      setFileName(file.name);
    } catch (e) {
      if (e instanceof Bc3ImportError) {
        setError(e.message);
        setDiag(e.diagnostics);
      } else {
        setError('No se pudo leer el archivo.');
      }
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  function confirm() {
    if (!result) return;
    setConfirming(false);
    loadObra(result.data); // el store salta a Presupuesto
  }

  const r = result?.report;
  const deltaEur = r?.deltaCents != null ? toEur(r.deltaCents) : null;

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

        <div
          className={`${styles.drop} ${over ? styles.over : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            if (!over) setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
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
            onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)}
          />
          <Icon name={busy ? 'loader' : 'upload'} size={28} className={busy ? styles.spin : ''} />
          <div className={styles.dropTitle}>{busy ? 'Procesando…' : 'Suelta el .bc3 aquí'}</div>
          <div className={styles.dropHint}>o haz clic para elegir un archivo</div>
        </div>

        {error && (
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
        )}

        {r && result && (
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
              <Stat label="Coef. K" value={`×${fmtNum(r.coefK, 4)}`} />
              <Stat label="PEM" value={fmtCents(r.pemCents)} accent />
              {r.rootPriceCents != null && (
                <Stat label="PEM en el .bc3" value={fmtCents(r.rootPriceCents)} />
              )}
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
          </div>
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

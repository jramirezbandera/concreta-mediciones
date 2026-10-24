/* ===========================================================================
   ReferenciaImportModal — importar un .bc3 como obra de SOLO REFERENCIA desde el
   panel de Referencia, SIN reemplazar la obra que editas. Comparte parseo/resumen
   con ImportarView (`importShared`); la diferencia es la confirmación: en vez de
   `loadObra` (reemplaza) llama `importObraAsReference` (crea obra nueva tag
   `reference`, la selecciona como fuente) y avisa con un toast. Vive como modal
   SOBRE el panel: no cierra el panel ni cambia de vista.

   App vacía (sin obra activa): no hay nada que proteger, así que un .bc3 soltado
   se carga como obra de TRABAJO (ruta `loadObra`) para no dejar al usuario con una
   referencia y ningún presupuesto donde copiar.

   Bases oficiales (docs/plan-bases-oficiales.md): encima de la zona de soltar, el
   catálogo de `core/basesOficiales`. «Descargar y añadir» la baja de la web
   oficial (`descargaBase`) y sigue por el mismo parseo. Reglas:
     · una operación cada vez: mientras descarga, filas, zona de soltar y
       «Añadir» se desactivan; la fuente va atada a la operación y se borra con
       la siguiente (D7, D13);
     · cerrar el modal lo DESMONTA (App): el aborto va en la limpieza del efecto;
     · si la descarga falla, o la base no se puede bajar (Madrid), «Abrir página
       oficial» y la zona de soltar queda asociada a esa base: acepta .bc3 o .zip
       y lo soltado entra con su fuente (D14);
     · una base oficial nunca entra como presupuesto: sin obra activa se crea
       antes una en blanco (D9); se llama como el catálogo (D15).
   =========================================================================== */
import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components';
import {
  BASES_OFICIALES,
  baseOficial,
  esFuenteOficial,
  fuenteDe,
  nombreReferencia,
  type BaseOficial,
} from '../../core/basesOficiales';
import type { FuenteOficial } from '../../core/types';
import { importObraAsReference, newObra, useSessionStore } from '../../persist';
import { esCuotaLlena, espacioNavegador } from '../../persist/planos';
import { useObraStore, useToastStore } from '../../store';
import { ErrorDescarga, bc3DeFichero, descargarBase, type ProgresoDescarga } from './descargaBase';
import { Bc3Dropzone, Bc3ErrorCard, Bc3ResultSummary } from './importShared';
import { useBc3Parse } from './useBc3Parse';
import styles from './Importar.module.css';

const ERROR_GUARDAR = 'No se pudo guardar la obra de referencia. Inténtalo de nuevo.';
const ERROR_CUOTA = 'No cabe en el navegador: borra alguna referencia o libera espacio de planos.';
/** Margen sobre lo medido en el catálogo para el aviso de espacio (D8). */
const MARGEN_ESPACIO = 1.2;

const mb = (n: number) => `${(n / 1_000_000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB`;

interface Descarga {
  baseId: string;
  progreso: ProgresoDescarga | null;
}

interface AvisoBase {
  base: BaseOficial;
  texto: string;
  /** Aviso de espacio: ofrece descargar igualmente. */
  espacio?: boolean;
}

function textoError(e: unknown): string {
  if (e instanceof ErrorDescarga) {
    if (e.motivo === 'zip') return e.message;
    if (e.motivo === 'http') return `${e.message} Puede que haya cambiado el enlace.`;
  }
  return 'No se pudo descargar desde la web oficial: sin conexión, o la web no deja descargarla desde aquí.';
}

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
  const [descarga, setDescarga] = useState<Descarga | null>(null);
  /** Fuente de la operación en curso: la del resultado que hay en pantalla. */
  const [fuenteOp, setFuenteOp] = useState<FuenteOficial | null>(null);
  /** Base a la que queda asociada la zona de soltar (plan B, D14). */
  const [asociada, setAsociada] = useState<BaseOficial | null>(null);
  const [aviso, setAviso] = useState<AvisoBase | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadObra = useObraStore((s) => s.loadObra);
  const setRefSource = useObraStore((s) => s.setRefSource);
  const setRefOpen = useObraStore((s) => s.setRefOpen);
  const activeId = useSessionStore((s) => s.activeId);
  const obras = useSessionStore((s) => s.obras);
  const show = useToastStore((s) => s.show);

  const ocupado = busy || importing || descarga !== null;

  // Al cerrar, limpia el estado para que la próxima apertura empiece en blanco.
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      reset();
      setImporting(false);
      setSaveError(null);
      setDescarga(null);
      setFuenteOp(null);
      setAsociada(null);
      setAviso(null);
    }
  }, [open, reset]);
  // Cerrar desmonta el modal (App): sin esto la descarga seguiría viva.
  useEffect(() => () => abortRef.current?.abort(), []);

  /** La referencia que ya tienes de esa base y edición, si la hay. */
  function yaLaTienes(b: BaseOficial): string | null {
    const m = obras.find(
      (o) => o.kind === 'reference' && esFuenteOficial(o.fuente) && o.fuente.baseId === b.id && o.fuente.edicion === b.edicion,
    );
    return m?.id ?? null;
  }
  /** Edición que tienes de esa base, si es otra que la del catálogo. */
  function otraEdicion(b: BaseOficial): string | null {
    const m = obras.find(
      (o) => esFuenteOficial(o.fuente) && o.fuente.baseId === b.id && o.fuente.edicion !== b.edicion,
    );
    return m && esFuenteOficial(m.fuente) ? m.fuente.edicion : null;
  }

  /** Sin obra activa, una base oficial necesita una obra en blanco donde copiar (D9). */
  async function asegurarObra(): Promise<boolean> {
    if (useSessionStore.getState().activeId !== null) return true;
    return (await newObra()) !== null;
  }

  async function usar(b: BaseOficial, id: string) {
    if (ocupado) return;
    setImporting(true);
    if (!(await asegurarObra())) {
      setImporting(false);
      return; // `newObra` ya avisó de que no pudo guardar
    }
    setRefSource(`obra:${id}`);
    setRefOpen(true);
    show(`«${nombreReferencia(b)}» seleccionada`);
    onClose();
  }

  async function descargar(b: BaseOficial, forzar = false) {
    if (ocupado || !b.descarga) return;
    // Operación nueva: fuera el resumen, el aviso y la fuente de la anterior (D13).
    reset();
    setFuenteOp(null);
    setSaveError(null);
    setAviso(null);
    setAsociada(null);
    setDescarga({ baseId: b.id, progreso: null });

    if (!forzar) {
      const e = await espacioNavegador();
      if (e && e.cuota - e.usado < b.descarga.ocupa * MARGEN_ESPACIO) {
        setDescarga(null);
        setAviso({
          base: b,
          espacio: true,
          texto: `Puede que no quepa: ya importada ocupa unos ${mb(b.descarga.ocupa)} y el navegador tiene libres ${mb(Math.max(0, e.cuota - e.usado))}. Borra alguna referencia o libera espacio de planos.`,
        });
        return;
      }
    }

    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      const file = await descargarBase(b, {
        signal: ctl.signal,
        onProgreso: (p) => setDescarga((d) => (d && d.baseId === b.id ? { ...d, progreso: p } : d)),
      });
      if (ctl.signal.aborted) return;
      setDescarga(null);
      setFuenteOp(fuenteDe(b, new Date()));
      await handleFile(file);
    } catch (e) {
      if (ctl.signal.aborted || (e instanceof ErrorDescarga && e.motivo === 'abortada')) return;
      setDescarga(null);
      setAviso({ base: b, texto: textoError(e) });
      setAsociada(b);
    } finally {
      if (abortRef.current === ctl) abortRef.current = null;
      if (ctl.signal.aborted) setDescarga(null);
    }
  }

  function cancelarDescarga() {
    abortRef.current?.abort();
  }

  function abrirPagina(b: BaseOficial) {
    window.open(b.pagina, '_blank', 'noopener');
    setAviso(null);
    setAsociada(b);
  }

  async function soltar(file: File | undefined) {
    if (!file || ocupado) return;
    setSaveError(null);
    if (!asociada) {
      setFuenteOp(null); // un .bc3 cualquiera: sin fuente oficial
      await handleFile(file);
      return;
    }
    // Plan B: lo soltado es una operación nueva de la base asociada (D14).
    reset();
    setFuenteOp(null);
    let bc3: File;
    try {
      bc3 = await bc3DeFichero(file);
    } catch (e) {
      setAviso({ base: asociada, texto: textoError(e) });
      return;
    }
    setAviso(null);
    setFuenteOp(fuenteDe(asociada, new Date()));
    await handleFile(bc3);
  }

  async function confirm() {
    if (!result || ocupado) return;
    const base = fuenteOp ? baseOficial(fuenteOp.baseId) : undefined;

    // Un .bc3 cualquiera con la app vacía: se carga como obra de trabajo (no hay
    // nada que proteger). Una base oficial nunca (D9).
    if (activeId === null && !base) {
      const name = result.data.obra.denominacion || fileName;
      loadObra(result.data); // navega a Presupuesto y cierra el panel
      show(`«${name}» cargada`);
      onClose();
      return;
    }

    const data = base ? { ...result.data, obra: { ...result.data.obra, denominacion: nombreReferencia(base) } } : result.data;
    const name = data.obra.denominacion || fileName;
    setImporting(true);
    setSaveError(null);
    try {
      if (!(await asegurarObra())) {
        setImporting(false);
        return; // `newObra` ya avisó de que no pudo guardar
      }
      const id = await importObraAsReference(data, fuenteOp ?? undefined);
      setRefSource(`obra:${id}`);
      setRefOpen(true);
      show(`«${name}» añadida como referencia`);
      onClose();
    } catch (e) {
      setSaveError(esCuotaLlena(e) ? ERROR_CUOTA : ERROR_GUARDAR);
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
          <button type="button" className={styles.confirm} onClick={confirm} disabled={!result || ocupado}>
            {importing ? 'Añadiendo…' : 'Añadir como referencia'}
          </button>
        </>
      }
    >
      <section className={styles.bases} aria-label="Bases oficiales">
        <h3 className={styles.basesTitle}>Bases oficiales gratuitas</h3>
        {BASES_OFICIALES.map((b) => {
          const tienes = yaLaTienes(b);
          const otra = tienes ? null : otraEdicion(b);
          const bajando = descarga?.baseId === b.id ? descarga : null;
          return (
            <div key={b.id} className={styles.base} data-base={b.id}>
              <div className={styles.baseInfo}>
                <span className={styles.baseName}>{b.nombre}</span>
                <span className={styles.baseMeta}>
                  {b.organismo} · {b.edicion}
                  {b.descarga ? ` · ${mb(b.descarga.bytes)}` : ''}
                </span>
                <span className={styles.baseCond}>{b.condiciones}</span>
                {tienes && <span className={styles.baseTienes}>Ya la tienes como referencia.</span>}
                {otra && <span className={styles.baseTienes}>Tienes la edición {otra}: esta se añade aparte.</span>}
                {bajando && (
                  <div className={styles.progreso}>
                    <div
                      className={styles.barra}
                      role="progressbar"
                      aria-label={`Descargando ${b.nombreCorto}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={
                        bajando.progreso?.fraccion != null ? Math.round(bajando.progreso.fraccion * 100) : undefined
                      }
                    >
                      <div
                        className={styles.barraLlena}
                        style={{ width: `${Math.round((bajando.progreso?.fraccion ?? 0) * 100)}%` }}
                      />
                    </div>
                    <div className={styles.progresoFila}>
                      <span>
                        {bajando.progreso === null
                          ? 'Preparando la descarga…'
                          : bajando.progreso.fraccion !== null
                            ? `Descargando… ${Math.round(bajando.progreso.fraccion * 100)} %`
                            : `Descargando… ${mb(bajando.progreso.leidos)}`}
                      </span>
                      <button type="button" className={styles.linkBtn} onClick={cancelarDescarga}>
                        Cancelar descarga
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {tienes ? (
                <button type="button" className={styles.baseBtn} disabled={ocupado} onClick={() => usar(b, tienes)}>
                  Usar
                </button>
              ) : b.descarga ? (
                <button type="button" className={styles.baseBtn} disabled={ocupado} onClick={() => descargar(b)}>
                  Descargar y añadir
                </button>
              ) : (
                <button type="button" className={styles.baseBtn} disabled={ocupado} onClick={() => abrirPagina(b)}>
                  Abrir página oficial
                </button>
              )}
            </div>
          );
        })}
      </section>

      {aviso && (
        <div className={styles.aviso} role="alert">
          <span>{aviso.texto}</span>
          <div className={styles.avisoAcciones}>
            {aviso.espacio ? (
              <button type="button" className={styles.linkBtn} onClick={() => descargar(aviso.base, true)}>
                Descargar igualmente
              </button>
            ) : (
              <button type="button" className={styles.linkBtn} onClick={() => abrirPagina(aviso.base)}>
                Abrir página oficial
              </button>
            )}
          </div>
        </div>
      )}

      {asociada && (
        <div className={styles.progresoFila}>
          <span>Descarga el fichero de {asociada.nombreCorto} en su web y suéltalo aquí abajo (.bc3 o .zip).</span>
          <button type="button" className={styles.linkBtn} onClick={() => setAsociada(null)} disabled={ocupado}>
            No es esta base
          </button>
        </div>
      )}

      <Bc3Dropzone
        busy={busy}
        onFile={soltar}
        disabled={descarga !== null || importing}
        title={asociada ? `Suelta aquí el fichero de ${asociada.nombreCorto}` : undefined}
        accept={asociada ? '.bc3,.zip' : '.bc3'}
      />
      {error && <Bc3ErrorCard error={error} diag={diag} />}
      {result && <Bc3ResultSummary result={result} fileName={fileName} />}
      {saveError && <Bc3ErrorCard error={saveError} diag={[]} />}
    </Modal>
  );
}

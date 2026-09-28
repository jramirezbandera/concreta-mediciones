import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { planoLegible } from '../../core/planoDatos';
import type { PlanoMeta } from '../../core/types';
import {
  ImportError,
  descargarCopia,
  descargarCopiaZip,
  descargarPdfsSueltos,
  esCopiaZip,
  importarSobreActiva,
  leerCopiaZip,
  parseObraJson,
  planCopiaZip,
  readFileText,
  restaurarZipSobreActiva,
  usePersistStore,
  volverAObraGuardada,
  type ImportarResult,
  type MotivoNoRestaurado,
  type PlanCopiaZip,
  type PlanoRestaurado,
  type RestaurarResult,
} from '../../persist';
import { toSerializable, useObraStore, useToastStore } from '../../store';
import { planosTexto as planos, tamanoCopia as tamano, textoCopiaHecha } from './copiaTextos';
import { useEstadoCopia } from './recordatorioCopia';
import styles from './ProjectBackup.module.css';

const ERROR_MSG: Record<string, string> = {
  malformado: 'El archivo no es un proyecto Concreta válido (JSON dañado o con otra estructura).',
  'version-desconocida':
    'El archivo viene de una versión más nueva de Concreta y aún no se puede abrir aquí.',
  'demasiado-grande':
    'El archivo tiene más planos o medidas de las que Concreta admite (máx. 200 planos, 50 000 líneas medidas).',
};

function textoError(err: unknown): string {
  if (!(err instanceof ImportError)) return 'No se pudo leer el archivo.';
  if (err.kind === 'zip-rechazado') return `No se puede restaurar esta copia. ${err.detalle ?? ''}`.trim();
  return ERROR_MSG[err.kind]!;
}

/** Por qué la importación no terminó bien (todo menos `ok`). */
const IMPORT_MSG: Record<Exclude<ImportarResult['kind'], 'ok'>, string> = {
  'solo-lectura': 'Esta pestaña está en solo lectura: aquí no se puede importar.',
  'sin-guardar-actual':
    'No se pudo guardar la obra actual y no se ha importado nada, para no perder sus cambios. Libera espacio y reinténtalo.',
  'sin-guardar':
    'La obra importada está en pantalla pero NO se ha podido guardar: si recargas, se pierde. La copia de la obra anterior está en tus descargas.',
};

/** [A1] Por qué la restauración de un .zip no terminó (todo menos `ok`). */
const RESTAURAR_MSG: Record<Exclude<RestaurarResult['kind'], 'ok'>, string> = {
  'solo-lectura': IMPORT_MSG['solo-lectura'],
  'sin-guardar-actual': IMPORT_MSG['sin-guardar-actual'],
  revertida:
    'La obra de la copia no cabe en este navegador ni sin sus planos: se ha vuelto a la obra anterior y no se ha restaurado nada. Libera espacio y reinténtalo.',
};

/** [A1] Por qué un plano quedó «no disponible» tras restaurar (§7.2). */
const MOTIVO: Record<MotivoNoRestaurado, string> = {
  huella: 'el PDF no cuadra con su huella: vuelve a adjuntarlo.',
  danado: 'el PDF está dañado en la copia: vuelve a adjuntarlo.',
  cuota: 'no cupo en el navegador: libera espacio y vuelve a adjuntarlo.',
  falta: 'no venía en la copia: vuelve a adjuntarlo.',
  error: 'no se pudo guardar en este navegador: vuelve a adjuntarlo.',
};

/** ¿Puede el navegador borrar las obras por su cuenta? (`persist/durability`).
 *  Mientras no se sepa (`unknown`), no dice nada. */
function DurabilityNote() {
  const durability = usePersistStore((s) => s.durability);
  if (durability === 'unknown') return null;
  if (durability === 'persisted')
    return (
      <div className={`${styles.note} ${styles.noteOk}`}>
        <Icon name="check" size={14} />
        Este navegador no borrará tus obras por su cuenta. La copia te sirve para cambiar de equipo.
      </div>
    );
  return (
    <div className={`${styles.note} ${styles.noteWarn}`}>
      <Icon name="alert" size={14} />
      {durability === 'unsupported'
        ? 'Este navegador puede borrar tus obras si le falta espacio. Exporta una copia a menudo.'
        : 'Este navegador puede borrar tus obras si le falta espacio o si pasas tiempo sin abrir la app. Exporta una copia a menudo; en Chrome o Edge, guardar la app en marcadores ayuda a protegerlas.'}
    </div>
  );
}

export interface ProjectBackupProps {
  /** Se invoca tras un import correcto (la obra ya está reemplazada): cierra el modal. */
  onImported?: () => void;
}

/**
 * Copia de seguridad del proyecto (F6.3): exporta e importa la obra, y la
 * importación REEMPLAZA la actual → confirma y descarga una copia de la actual
 * ANTES de pisar. Solo cierra si la obra importada llegó a disco; si no, lo
 * dice y deja volver a la anterior (Etapa 0). Enseña cuándo se descargó la
 * última copia (recordatorio de copia).
 *
 * [A1] Con planos, la copia completa es un .zip con los PDF (§9.2) y es la
 * acción principal («42 MB · 3 planos»); el .json queda como «Solo
 * presupuesto». Importar acepta los dos. Restaurar un .zip que deja planos
 * «no disponibles» no cierra: enseña un resumen plano a plano, con
 * [Adjuntar PDF] en cada uno que falta.
 */
export function ProjectBackup({ onImported }: ProjectBackupProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  // La importada no llegó a disco y la anterior sigue guardada: se ofrece volver.
  const [puedeVolver, setPuedeVolver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanCopiaZip | null>(null);
  const [resumen, setResumen] = useState<PlanoRestaurado[] | null>(null);
  /** El plano del resumen al que se está volviendo a adjuntar el PDF. */
  const reenlazarA = useRef<string | null>(null);
  const copia = useEstadoCopia();
  // Las huellas de los planos en uso: al cambiar, se rehace el plan del .zip.
  const huellas = useObraStore((s) =>
    s.planos
      .filter((p): p is PlanoMeta => planoLegible(p) && !p.quitado)
      .map((p) => p.huella)
      .join(','),
  );
  const conPlanos = huellas !== '';

  useEffect(() => {
    if (!conPlanos) {
      setPlan(null);
      return;
    }
    let vivo = true;
    void planCopiaZip(toSerializable(useObraStore.getState()))
      .then((p) => vivo && setPlan(p))
      .catch(() => vivo && setPlan(null));
    return () => {
      vivo = false;
    };
  }, [conPlanos, huellas]);

  function empezar() {
    setError(null);
    setPuedeVolver(false);
    setResumen(null);
    setBusy(true);
  }
  function terminar() {
    setBusy(false);
    setProgreso(null);
  }

  async function exportarZip() {
    empezar();
    try {
      const r = await descargarCopiaZip(undefined, (i, n) => setProgreso(`Empaquetando ${planos(n)}… ${i + 1}/${n}`));
      if (r.kind === 'ok') useToastStore.getState().show(textoCopiaHecha(r));
      else if (r.kind === 'no-cabe')
        setError(`${r.motivo} Descarga el presupuesto (.json) y guarda los PDF por separado.`);
      else setError('No se pudo hacer la copia .zip. La copia .json sigue disponible.');
    } finally {
      terminar();
    }
  }

  async function pdfsSueltos() {
    empezar();
    try {
      const n = await descargarPdfsSueltos(toSerializable(useObraStore.getState()));
      useToastStore.getState().show(n ? `Descargados ${n} PDF` : 'Ningún PDF está en este navegador');
    } finally {
      terminar();
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reelegir el mismo archivo
    if (!file) return;
    empezar();
    try {
      if (await esCopiaZip(file)) await importarZip(file);
      else await importarJson(file);
    } catch (err) {
      setError(textoError(err));
    } finally {
      terminar();
    }
  }

  async function importarJson(file: File) {
    const text = await readFileText(file);
    const data = parseObraJson(text); // valida estructura + schemaVersion
    const ok = window.confirm(
      'Importar este proyecto reemplazará TODO el trabajo actual.\n\n' +
        'Se descargará una copia de seguridad del proyecto actual antes de continuar.\n\n' +
        '¿Continuar?',
    );
    if (!ok) return;
    // Guarda la actual, descarga su copia, carga la importada y comprueba que
    // llegó a disco: un guardado fallido ya no se da por bueno.
    const res = await importarSobreActiva(data);
    if (res.kind === 'ok') {
      onImported?.();
      return;
    }
    setError(IMPORT_MSG[res.kind]);
    setPuedeVolver(res.kind === 'sin-guardar' && res.puedeVolver);
  }

  async function importarZip(file: File) {
    setProgreso('Leyendo la copia…');
    const copiaZip = await leerCopiaZip(file); // valida nombres, topes y el presupuesto SIN escribir nada
    const n = copiaZip.pdfs.size;
    const ok = window.confirm(
      `Restaurar esta copia${n ? ` (con ${planos(n)})` : ''} reemplazará TODO el trabajo actual.\n\n` +
        'Se descargará una copia de seguridad del proyecto actual antes de continuar.\n\n' +
        '¿Continuar?',
    );
    if (!ok) return;
    setProgreso('Restaurando…');
    const res = await restaurarZipSobreActiva(copiaZip, (i, total) => setProgreso(`Restaurando planos… ${i + 1}/${total}`));
    if (res.kind !== 'ok') {
      setError(RESTAURAR_MSG[res.kind]);
      return;
    }
    if (res.planos.every((p) => p.disponible)) {
      useToastStore
        .getState()
        .show(`Copia restaurada: la obra${res.planos.length ? ` y ${planos(res.planos.length)}` : ''}`);
      onImported?.();
      return;
    }
    setResumen(res.planos); // restauración parcial: el resumen se queda
  }

  /** [Adjuntar PDF] de un plano del resumen: el reenlace de siempre. */
  async function onPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const planoId = reenlazarA.current;
    if (!file || !planoId) return;
    setError(null);
    setBusy(true);
    try {
      const { adjuntarPlano } = await import('../planos/adjuntar');
      const r = await adjuntarPlano(file, { destino: planoId });
      if (r.kind === 'reenlazado')
        setResumen((rs) => rs?.map((p) => (p.planoId === planoId ? { planoId, nombre: p.nombre, disponible: true } : p)) ?? null);
      else if (r.kind === 'no-identico') setError('Este PDF no es idéntico al original.');
      else if (r.kind === 'error') setError(r.texto);
    } finally {
      setBusy(false);
    }
  }

  async function volver() {
    setBusy(true);
    try {
      if (await volverAObraGuardada()) {
        setError(null);
        setPuedeVolver(false);
      } else setError('No se pudo leer la obra anterior. Usa la copia que está en tus descargas.');
    } finally {
      setBusy(false);
    }
  }

  const importar = (
    <>
      <button type="button" className={`t150 ${styles.btn}`} onClick={() => fileRef.current?.click()} disabled={busy}>
        <Icon name="upload" size={14} />
        Importar copia
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json,application/zip,.zip"
        onChange={onPick}
        className={styles.hidden}
        aria-label="Importar copia (.zip o .json)"
      />
    </>
  );

  return (
    <section className={styles.wrap}>
      <div className={styles.text}>
        <div className={styles.title}>Copia de seguridad del proyecto</div>
        <div className={styles.sub}>
          {conPlanos
            ? 'Guarda o restaura todo el proyecto, con sus planos. Importar reemplaza el proyecto actual.'
            : 'Guarda o restaura todo el proyecto como archivo .json. Importar reemplaza el proyecto actual.'}
        </div>
      </div>
      {copia.registrada && (
        <div className={`${styles.note} ${copia.vencida ? styles.noteWarn : ''}`}>
          <Icon name="backup" size={14} />
          {copia.texto}
        </div>
      )}
      <DurabilityNote />
      {conPlanos ? (
        <>
          {plan?.noCabe ? (
            <div className={`${styles.note} ${styles.noteWarn}`}>
              <Icon name="alert" size={14} />
              <span>
                {plan.noCabe} Una copia .zip no se podría restaurar: descarga el presupuesto (.json) y guarda los PDF por
                separado.{' '}
                <button type="button" className={styles.link} onClick={pdfsSueltos} disabled={busy}>
                  Descargar los PDF
                </button>
              </span>
            </div>
          ) : (
            <div className={styles.principal}>
              <button type="button" className={`t150 ${styles.btn} ${styles.btnPrimario}`} onClick={exportarZip} disabled={busy}>
                <Icon name="download" size={14} />
                Copia completa con planos (.zip)
              </button>
              <span className={styles.meta}>
                {plan ? `${tamano(plan.tamano)} · ${planos(plan.planos)}` : 'Calculando…'}
              </span>
            </div>
          )}
          {plan && !plan.noCabe && plan.faltan.length > 0 && (
            <div className={`${styles.note} ${styles.noteWarn}`}>
              <Icon name="alert" size={14} />
              Saldrá incompleta: falta {plan.faltan.join(', ')} (su PDF no está en este navegador).
            </div>
          )}
          <div className={styles.actions}>
            <button type="button" className={`t150 ${styles.btn}`} onClick={() => descargarCopia()} disabled={busy}>
              <Icon name="download" size={14} />
              Solo presupuesto (.json)
            </button>
            {importar}
          </div>
          <div className={styles.note}>
            <Icon name="doc" size={14} />
            El .json no lleva los PDF: si se pierden, vuelve a adjuntarlos. Tus líneas medidas sobreviven y recuperan
            escala y capa al volver a adjuntar el mismo PDF.
          </div>
        </>
      ) : (
        <div className={styles.actions}>
          <button type="button" className={`t150 ${styles.btn}`} onClick={() => descargarCopia()} disabled={busy}>
            <Icon name="download" size={14} />
            Exportar .json
          </button>
          {importar}
        </div>
      )}
      {progreso && (
        <div className={styles.note} role="status">
          <Icon name="loader" size={14} />
          {progreso}
        </div>
      )}
      {resumen && (
        <div className={styles.resumen} role="status">
          <div className={styles.title}>
            Obra restaurada · planos disponibles: {resumen.filter((p) => p.disponible).length} de {resumen.length}
          </div>
          <ul className={styles.resumenLista}>
            {resumen.map((p) => (
              <li key={p.planoId} className={`${styles.resumenFila} ${p.disponible ? styles.resumenOk : ''}`}>
                <Icon name={p.disponible ? 'check' : 'alert'} size={14} />
                <span className={styles.resumenTexto}>
                  <strong>{p.nombre}</strong>
                  {p.disponible ? ' · disponible' : ` · no disponible: ${MOTIVO[p.motivo ?? 'falta']}`}
                </span>
                {!p.disponible && (
                  <button
                    type="button"
                    className={styles.link}
                    disabled={busy}
                    onClick={() => {
                      reenlazarA.current = p.planoId;
                      pdfRef.current?.click();
                    }}
                  >
                    Adjuntar PDF
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className={styles.note}>Las líneas medidas conservan sus números; al adjuntar el PDF vuelven la escala y la capa.</div>
          <input
            ref={pdfRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={onPdf}
            className={styles.hidden}
            aria-label="Adjuntar el PDF de un plano"
          />
        </div>
      )}
      {error && (
        <div className={styles.error} role="alert">
          <Icon name="alert" size={14} />
          <span>
            {error}
            {puedeVolver && (
              <>
                {' '}
                <button type="button" className={styles.link} onClick={volver} disabled={busy}>
                  Volver a la obra anterior
                </button>
              </>
            )}
          </span>
        </div>
      )}
    </section>
  );
}

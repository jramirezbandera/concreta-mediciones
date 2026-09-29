/* ===========================================================================
   LiberarEspacio — «Liberar espacio» en la lista de planos (§9.4, A1): los PDF
   de este navegador que no usa ninguna obra, con su tamaño, para borrarlos
   tras confirmar. Aparte, los de planos quitados que Deshacer aún recupera
   («Liberar ya»), sin marcar. Buscar y borrar viven en `persist/liberar`.
   =========================================================================== */
import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components';
import { fmtNum } from '../../core/money';
import { buscarPdfSinUso, liberarPdf, type Busqueda, type PdfSinUso } from '../../persist';
import { useToastStore } from '../../store';
import styles from './Planos.module.css';

const MB = 1024 * 1024;
const tam = (n: number) => `${fmtNum(n / MB, n < 10 * MB ? 1 : 0)} MB`;
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-ES');

export function DialogoLiberar({ onCerrar }: { onCerrar: (liberado: boolean) => void }) {
  const [busqueda, setBusqueda] = useState<Busqueda | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const cancelar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let vivo = true;
    buscarPdfSinUso().then(
      (b) => {
        if (!vivo) return;
        setBusqueda(b);
        // Los que no usa nadie, marcados; los del historial, no.
        if (b.kind === 'ok') setMarcados(new Set(b.libres.map((p) => p.huella)));
      },
      () => vivo && setBusqueda({ kind: 'detenida', motivo: 'Limpieza detenida: no se pudo leer el almacén de planos.' }),
    );
    return () => {
      vivo = false;
    };
  }, []);

  const ok = busqueda?.kind === 'ok' ? busqueda : null;
  /** Buscado y sin nada que ofrecer (o detenido): solo se cierra. */
  const nada = busqueda !== null && (!ok || (!ok.libres.length && !ok.historial.length));
  const elegidos = ok
    ? [...ok.libres, ...ok.historial.map((p) => ({ ...p, delHistorial: true }))].filter((p) => marcados.has(p.huella))
    : [];
  const total = elegidos.reduce((s, p) => s + p.tamano, 0);
  const marcar = (h: string, si: boolean) =>
    setMarcados((m) => {
      const x = new Set(m);
      if (si) x.add(h);
      else x.delete(h);
      return x;
    });

  async function liberar() {
    setBusy(true);
    const r = await liberarPdf(elegidos);
    setBusy(false);
    onCerrar(r.kind === 'ok' && r.liberados > 0);
    const toast = useToastStore.getState();
    if (r.kind === 'detenida') return toast.show(r.motivo, undefined, { tone: 'error' });
    const n = r.conservados;
    toast.show(
      `Liberados ${tam(r.bytes)} (${r.liberados} PDF)` +
        (n ? `. ${n === 1 ? 'Uno se ha vuelto a usar y se conserva' : `${n} se han vuelto a usar y se conservan`}.` : ''),
    );
  }

  const fila = (p: PdfSinUso, texto: string) => (
    <li key={p.huella}>
      <label className={styles.checkLinea}>
        <input type="checkbox" checked={marcados.has(p.huella)} disabled={busy} onChange={(e) => marcar(p.huella, e.target.checked)} />
        {texto}
      </label>
    </li>
  );

  return (
    <Modal
      open
      onClose={() => onCerrar(false)}
      title="Liberar espacio"
      icon="trash"
      initialFocus={cancelar}
      footer={
        nada ? (
          <button ref={cancelar} type="button" className={styles.btn} onClick={() => onCerrar(false)}>
            Cerrar
          </button>
        ) : (
          <>
            <button ref={cancelar} type="button" className={styles.btn} onClick={() => onCerrar(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPeligro}`}
              disabled={!elegidos.length || busy}
              onClick={() => void liberar()}
            >
              {elegidos.length ? `Liberar ${tam(total)}` : 'Liberar'}
            </button>
          </>
        )
      }
    >
      <div className={styles.recalculo}>
        {!busqueda && (
          <p className={styles.franjaTexto} role="status">
            Buscando PDF que ninguna obra usa…
          </p>
        )}
        {busqueda?.kind === 'detenida' && <p className={styles.recalculoAviso}>{busqueda.motivo}</p>}
        {ok && !ok.libres.length && !ok.historial.length && <p>Ningún PDF sin usar: no hay nada que liberar.</p>}
        {ok && ok.libres.length > 0 && (
          <>
            <p>
              PDF que no usa ninguna obra de este navegador. Se borran de aquí; si vuelves a necesitar uno, adjúntalo otra vez.
            </p>
            <ul className={styles.recalculoPartidas}>
              {ok.libres.map((p) => fila(p, `${p.nombre ?? 'PDF sin nombre'} · ${tam(p.tamano)} · último uso ${fecha(p.tocadoEn)}`))}
            </ul>
          </>
        )}
        {ok && ok.historial.length > 0 && (
          <>
            <p className={styles.franjaTexto}>Planos quitados que Deshacer aún puede recuperar:</p>
            <ul className={styles.recalculoPartidas}>
              {ok.historial.map((p) =>
                fila(
                  p,
                  `Liberar ya ${p.nombre ? `«${p.nombre}»` : 'este PDF'} (${tam(p.tamano)}): ${
                    p.lineas
                      ? `Deshacer ya no recuperará la capa de ${p.lineas} ${p.lineas === 1 ? 'línea' : 'líneas'}`
                      : 'Deshacer ya no recuperará este plano'
                  }`,
                ),
              )}
            </ul>
          </>
        )}
        {ok && ok.recientes > 0 && (
          <p className={styles.franjaTexto}>
            {ok.recientes === 1
              ? 'Un PDF adjuntado en las últimas 24 h no se ofrece.'
              : `${ok.recientes} PDF adjuntados en las últimas 24 h no se ofrecen.`}
          </p>
        )}
      </div>
    </Modal>
  );
}

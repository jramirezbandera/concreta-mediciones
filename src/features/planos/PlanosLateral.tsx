/* ===========================================================================
   PlanosLateral — lo que el hueco lateral monta para «Planos»: una frontera de
   errores LOCAL alrededor del chunk diferido del visor (§5.9). El presupuesto
   nunca se queda en blanco:
     · si el chunk no llega (hay una versión nueva publicada): «Hay una versión
       nueva de Concreta: recarga la página» con [Recargar];
     · cualquier otro fallo: su causa y [Cerrar].
   Este fichero va en el bundle principal; el visor y pdf.js, no.
   =========================================================================== */
import { Component, Suspense, lazy, useState, type ReactNode } from 'react';
import { Icon } from '../../components';
import { flushPending } from '../../persist';
import { useToastStore } from '../../store';
import { RELOAD_FAILED, reloadToLatest } from '../../update/appVersion';
import { esFalloDeChunk } from './textos';
import styles from './Planos.module.css';

const PlanosPanel = lazy(() => import('./PlanosPanel'));

function Recargar() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={`${styles.btn} ${styles.btnPrimario}`}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void reloadToLatest({ beforeReload: flushPending }).then((res) => {
          if (res === 'ok') return;
          setBusy(false);
          useToastStore.getState().show(RELOAD_FAILED[res]);
        });
      }}
    >
      {busy ? 'Recargando…' : 'Recargar'}
    </button>
  );
}

export class FronteraPlanos extends Component<{ children: ReactNode; onCerrar: () => void }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  componentDidCatch(error: unknown) {
    console.error('Visor de planos:', error);
  }
  render() {
    const { error } = this.state;
    if (error == null) return this.props.children;
    const chunk = esFalloDeChunk(error);
    return (
      <div className={styles.panel}>
        <div className={styles.estadoLienzo} role="alert">
          <Icon name="alert" size={20} />
          <p>
            {chunk
              ? 'Hay una versión nueva de Concreta: recarga la página.'
              : `No se pudo abrir el visor de planos: ${(error as Error)?.message ?? String(error)}.`}
          </p>
          {chunk ? (
            <Recargar />
          ) : (
            <button type="button" className={styles.btn} onClick={this.props.onCerrar}>
              Cerrar
            </button>
          )}
        </div>
      </div>
    );
  }
}

export function PlanosLateral({ estrecha, onCerrar }: { estrecha: boolean; onCerrar: () => void }) {
  return (
    <FronteraPlanos onCerrar={onCerrar}>
      <Suspense
        fallback={
          <div className={styles.panel}>
            <div className={styles.estadoLienzo}>Cargando planos…</div>
          </div>
        }
      >
        <PlanosPanel estrecha={estrecha} onCerrar={onCerrar} />
      </Suspense>
    </FronteraPlanos>
  );
}

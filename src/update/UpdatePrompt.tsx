import { useState } from 'react';
import { Icon } from '../components';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { flushPending } from '../persist';
import { useToastStore } from '../store';
import { RELOAD_FAILED, reloadToLatest } from './appVersion';
import { selectUpdateVisible, useUpdateStore } from './updateStore';
import styles from './UpdatePrompt.module.css';

/**
 * Aviso «Nueva versión disponible» con «Actualizar» / «Más tarde». Tarjeta
 * flotante NO modal: no roba el foco (puede aparecer a mitad de teclear una
 * medición) ni bloquea la obra. «Actualizar» guarda lo pendiente y recarga al
 * build publicado sin tener que vaciar la caché. Se monta fuera del
 * AppErrorBoundary (ver main.tsx), así que resuelve el breakpoint por su cuenta.
 */
export function UpdatePrompt() {
  const compact = useBreakpoint().isMobile;
  const visible = useUpdateStore(selectUpdateVisible);
  const broken = useUpdateStore((s) => s.broken);
  const dismiss = useUpdateStore((s) => s.dismiss);
  const [busy, setBusy] = useState(false);

  if (!visible) return null;

  const update = () => {
    setBusy(true);
    void reloadToLatest({ beforeReload: flushPending }).then((res) => {
      if (res === 'ok') return; // la página se está recargando
      setBusy(false);
      useToastStore.getState().show(RELOAD_FAILED[res]);
    });
  };

  return (
    <div
      className={`no-print ${styles.card} ${compact ? styles.compact : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className={styles.iconChip}>
        <Icon name="refresh" size={16} />
      </span>
      <div className={styles.content}>
        <div className={styles.title}>Nueva versión disponible</div>
        <p className={styles.text}>
          {broken
            ? 'Esta pestaña se ha quedado en una versión anterior y parte de la app ya no carga. Actualiza para seguir.'
            : 'Actualiza para usar la última versión de Concreta.'}{' '}
          Lo que tengas sin guardar se guarda antes de recargar; si no se puede guardar, no se
          recarga.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.later} onClick={dismiss} disabled={busy}>
            Más tarde
          </button>
          <button type="button" className={styles.update} onClick={update} disabled={busy}>
            <Icon
              name={busy ? 'loader' : 'refresh'}
              size={14}
              className={busy ? styles.spin : ''}
            />
            {busy ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>
    </div>
  );
}

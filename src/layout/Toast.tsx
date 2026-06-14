import { useEffect, useState } from 'react';
import { Icon } from '../components';
import { useToastStore } from '../store';
import styles from './ClipboardToast.module.css';

/**
 * Aviso transitorio genérico (éxito/info), disparado por `useToastStore.show()`.
 * Complementa al `ClipboardToast` (específico de copiar): este sirve para acciones
 * puntuales como "obra añadida como referencia". Reusa el estilo del toast de
 * portapapeles. Se autodescarta a ~2,2 s y reaparece con cada `show` (vía `tick`).
 */
export function Toast() {
  const tick = useToastStore((s) => s.tick);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (tick === 0) return; // todavía no se ha mostrado nada
    setMsg(useToastStore.getState().msg);
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [tick]);

  if (!msg) return null;
  return (
    <div className={`no-print ${styles.toast}`} role="status" aria-live="polite">
      <Icon name="check" size={14} /> {msg}
    </div>
  );
}

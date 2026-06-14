import { useEffect, useState } from 'react';
import { Icon } from '../components';
import { useClipboardStore } from '../store';
import styles from './ClipboardToast.module.css';

/**
 * Aviso transitorio "Copiado al portapapeles" tras copiar una partida (teclado o
 * menú). Sirve en escritorio y móvil (complementa el chip persistente de la
 * StatusBar, que solo existe en escritorio). Se dispara con `copyTick` para
 * reaparecer aunque se recopie la misma partida; se autodescarta a ~1,9 s.
 */
export function ClipboardToast() {
  const tick = useClipboardStore((s) => s.copyTick);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (tick === 0) return; // todavía no se ha copiado nada
    const head = useClipboardStore.getState().items?.[0]?.partida;
    setMsg(head?.code ? `${head.code} copiada al portapapeles` : 'Copiado al portapapeles');
    const t = setTimeout(() => setMsg(null), 1900);
    return () => clearTimeout(t);
  }, [tick]);

  if (!msg) return null;
  return (
    <div className={`no-print ${styles.toast}`} role="status" aria-live="polite">
      <Icon name="check" size={14} /> {msg}
    </div>
  );
}

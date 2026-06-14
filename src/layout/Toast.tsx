import { useEffect, useState } from 'react';
import { Icon } from '../components';
import { useToastStore, type ToastAction } from '../store';
import styles from './ClipboardToast.module.css';

interface Shown {
  msg: string;
  action: ToastAction | null;
}

/**
 * Aviso transitorio genérico (éxito/info), disparado por `useToastStore.show()`.
 * Admite una acción opcional («Deshacer»): con acción dura más (~6 s) y muestra
 * un botón; sin acción, ~2,2 s. Reaparece con cada `show` (vía `tick`).
 */
export function Toast() {
  const tick = useToastStore((s) => s.tick);
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(() => {
    if (tick === 0) return; // todavía no se ha mostrado nada
    const { msg, action } = useToastStore.getState();
    if (!msg) return;
    setShown({ msg, action });
    const t = setTimeout(() => setShown(null), action ? 6000 : 2200);
    return () => clearTimeout(t);
  }, [tick]);

  if (!shown) return null;
  return (
    <div className={`no-print ${styles.toast}`} role="status" aria-live="polite">
      <Icon name="check" size={14} /> {shown.msg}
      {shown.action && (
        <button
          type="button"
          className={styles.toastAction}
          onClick={() => {
            shown.action!.run();
            setShown(null);
          }}
        >
          {shown.action.label}
        </button>
      )}
    </div>
  );
}

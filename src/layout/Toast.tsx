import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Icon } from '../components';
import { useToastStore } from '../store';
import styles from './Toast.module.css';

/**
 * Aviso transitorio genérico, disparado por `useToastStore.show()`. Un solo
 * hueco en pantalla: el aviso de «copiada» también pasa por aquí.
 *
 * Es REACTIVO al store (antes cacheaba el mensaje y un `clear()` —undo, cambio
 * de obra— dejaba a la vista un «Deshacer» muerto). Con acción dura ~6 s y sin
 * ella ~2,2 s; con el ratón encima o el foco dentro no se cierra. Tres tonos:
 * éxito/info, advertencia y error (este último se anuncia como `alert`).
 */
export function Toast() {
  const { msg, action, tone, tick } = useToastStore(
    useShallow((s) => ({ msg: s.msg, action: s.action, tone: s.tone, tick: s.tick })),
  );
  // Retenido por hover/foco. Atado al tick: un aviso nuevo no hereda la retención.
  const [heldTick, setHeldTick] = useState<number | null>(null);
  const held = heldTick === tick;
  const ref = useRef<HTMLDivElement>(null);

  // Apilado de abajo arriba: barras inferiores, barra de selección de líneas,
  // aviso. Solo si la barra de selección ocupa el hueco del aviso (pegada al
  // fondo de la vista) el aviso sube por encima; si no, se queda donde siempre.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.bottom = '';
    const bar = document.querySelector<HTMLElement>('[data-medbar]')?.getBoundingClientRect();
    if (!bar || bar.height === 0) return;
    const own = el.getBoundingClientRect();
    if (bar.top < own.bottom + 8 && bar.bottom > own.top - 8)
      el.style.bottom = `${window.innerHeight - bar.top + 8}px`;
  }, [tick, msg]);

  useEffect(() => {
    if (!msg || held) return;
    const t = setTimeout(() => useToastStore.getState().clear(), action ? 6000 : 2200);
    return () => clearTimeout(t);
  }, [tick, msg, action, held]);

  if (!msg) return null;
  const hold = () => setHeldTick(tick);
  const release = () => setHeldTick(null);
  return (
    <div
      key={tick}
      ref={ref}
      className={`no-print ${styles.toast} ${styles[tone]}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={hold}
      onMouseLeave={release}
      onFocus={hold}
      onBlur={release}
    >
      <Icon name={tone === 'ok' ? 'check' : 'alert'} size={14} />
      <span className={styles.msg}>{msg}</span>
      {action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            useToastStore.getState().clear();
            action.run();
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

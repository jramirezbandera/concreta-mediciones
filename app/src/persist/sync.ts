/* ===========================================================================
   persist/sync — hidratación + autosave (F6.1). Pega la capa `persist` al store
   de dominio. Diseño de eng-review F6:
     · `hydrate()` corre ANTES de `createRoot().render()` (main.tsx): muta el
       store si hay datos sanos, deja la demo en memoria si está vacío, y NO pisa
       si está corrupto (marca recuperación). Idempotente (StrictMode-safe).
     · El autosave se ARMA tras hidratar, escucha SOLO el slice de dominio
       (navegar no guarda), debounced, y persiste solo tras la 1ª mutación real
       (la demo no se fosiliza). Las escrituras van por la cola de `persist`.
   =========================================================================== */
import { shallow } from 'zustand/shallow';
import { fromSerializable, toSerializable, useObraStore, type ObraState } from '../store';
import { flush, loadObraEnvelope, saveObra } from './persist';
import { usePersistStore } from './persistStore';

const DEBOUNCE_MS = 600;

let armed = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let unsub: (() => void) | null = null;

/** Slice de DOMINIO: el autosave solo reacciona a estos (no a la navegación). */
function domainSlice(s: ObraState) {
  return [s.chapters, s.partidas, s.recursos, s.certs, s.rates, s.obra] as const;
}

function persistNow(): Promise<void> {
  const data = toSerializable(useObraStore.getState());
  usePersistStore.getState().setStatus('saving');
  return saveObra(data).then(
    () => usePersistStore.getState().setStatus('saved'),
    () => usePersistStore.getState().setStatus('error'),
  );
}

/** Arma el autosave una sola vez. Suscribe al slice de dominio con shallow-eq;
 *  el primer cambio de dominio (1ª edición) dispara el primer guardado. */
export function armAutosave(): void {
  if (armed) return; // idempotente: StrictMode no duplica la suscripción
  armed = true;
  unsub = useObraStore.subscribe(
    domainSlice,
    () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void persistNow();
      }, DEBOUNCE_MS);
    },
    { equalityFn: shallow },
  );
}

/** Fuerza el guardado pendiente y espera a la cola. Para operaciones de riesgo
 *  (importar, reset, cerrar pestaña): no perder la última edición por el debounce. */
export function flushPending(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    void persistNow();
  }
  return flush();
}

/** Carga la obra persistida y arma el autosave. Llamar antes de render. */
export async function hydrate(): Promise<void> {
  try {
    const res = await loadObraEnvelope();
    if (res.kind === 'ok') {
      try {
        const data = fromSerializable(res.envelope.data); // migra por schemaVersion
        useObraStore.getState().loadObra(data);
      } catch {
        // versión no soportada → recuperación, NO pisar, NO armar autosave
        usePersistStore.getState().setRecovery(res.envelope);
        return;
      }
    } else if (res.kind === 'corrupt') {
      usePersistStore.getState().setRecovery(res.raw);
      return; // datos corruptos: no pisar con la demo, esperar decisión del usuario
    }
    // 'empty' (demo en memoria, sin persistir aún) u 'ok' (obra cargada): armar.
    armAutosave();
  } catch {
    // IndexedDB no disponible (incógnito/bloqueado/cuota): seguimos en memoria.
    usePersistStore.getState().setStatus('error');
  }
}

/** Reset de testing: desuscribe, olvida el armado y el debounce (no toca IDB). */
export function __resetSyncForTests(): void {
  if (unsub) unsub();
  unsub = null;
  armed = false;
  if (timer) clearTimeout(timer);
  timer = null;
}

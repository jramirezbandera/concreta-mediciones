/* ===========================================================================
   persist/sync — hidratación + autosave (F6.1 → multi-obra T-10). Pega la capa
   `persist` + `registry` al store de dominio.
     · `hydrate()` corre ANTES de `createRoot().render()` (main.tsx): migra el
       proyecto legacy al registro, reconcilia índice↔blobs, y carga PEREZOSAMENTE
       solo la obra ACTIVA (D7: arranque plano). Si la activa falla, cae a la
       primera obra que cargue (fallback por obra). Si ninguna carga, marca
       recuperación y NO pisa la demo. Idempotente (StrictMode-safe).
     · El autosave se ARMA tras hidratar, escucha SOLO el slice de dominio
       (navegar no guarda), debounced, y persiste la obra activa bajo su clave.
       La 1ª edición de la demo (instalación nueva) le asigna un id y crea el
       registro (la demo no se fosiliza hasta entonces).
   =========================================================================== */
import { shallow } from 'zustand/shallow';
import { fromSerializable, toSerializable, useObraStore, type ObraState } from '../store';
import { flush, loadObraEnvelope, obraKey } from './persist';
import {
  loadIndex,
  migrateLegacy,
  newObraId,
  reconcile,
  saveActiveObra,
  setActiveId,
  type ObraIndex,
} from './registry';
import { usePersistStore } from './persistStore';

const DEBOUNCE_MS = 600;

let armed = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let unsub: (() => void) | null = null;
/** Última persistencia COMPLETA en vuelo (blob + índice). `flush()` de `persist`
 *  solo cubre el blob; el índice se escribe DESPUÉS en `saveActiveObra`, así que
 *  `flushPending` debe esperar a esta promesa o la obra activa queda sin sellar. */
let lastPersist: Promise<void> = Promise.resolve();
/** Id de la obra activa (la que se autoguarda). `null` = demo en memoria aún sin
 *  registrar (instalación nueva, antes de la 1ª edición). */
let activeId: string | null = null;

/** Id de la obra activa en memoria (lo necesita PR2 para conmutar). */
export function getActiveObraId(): string | null {
  return activeId;
}

/** Slice de DOMINIO: el autosave solo reacciona a estos (no a la navegación). */
function domainSlice(s: ObraState) {
  return [s.chapters, s.partidas, s.recursos, s.certs, s.rates, s.obra] as const;
}

function persistNow(): Promise<void> {
  const data = toSerializable(useObraStore.getState());
  if (!activeId) activeId = newObraId(); // 1ª edición de la demo: nace su id
  usePersistStore.getState().setStatus('saving');
  lastPersist = saveActiveObra(activeId, data).then(
    () => usePersistStore.getState().setStatus('saved'),
    () => usePersistStore.getState().setStatus('error'),
  );
  return lastPersist;
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
 *  (importar, reset, conmutar, cerrar pestaña): no perder la última edición por el debounce. */
export function flushPending(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    void persistNow();
  }
  // Espera al blob (cola de persist) Y al índice (continuación de saveActiveObra).
  return Promise.all([flush(), lastPersist]).then(() => undefined);
}

/** Las obras a intentar cargar, la activa primero (resto como fallback). */
function orderActiveFirst(idx: ObraIndex): string[] {
  const ids = idx.obras.map((m) => m.id);
  if (idx.activeId && ids.includes(idx.activeId)) {
    return [idx.activeId, ...ids.filter((id) => id !== idx.activeId)];
  }
  return ids;
}

/** Migra/reconcilia el registro y carga la obra activa. Llamar antes de render. */
export async function hydrate(): Promise<void> {
  try {
    await migrateLegacy(); // one-shot, idempotente
    const idx = await reconcile(await loadIndex());

    // Instalación nueva (sin obras): demo en memoria, arma autosave. La 1ª
    // edición creará el registro; la demo NO se fosiliza hasta entonces.
    if (idx.obras.length === 0) {
      activeId = null;
      armAutosave();
      return;
    }

    // Carga la activa; si falla, cae a la primera obra que cargue (fallback por
    // obra, Codex). Recuerda la 1ª corrupta para ofrecer recuperación si NINGUNA carga.
    let firstCorrupt: { raw: unknown; key: string } | null = null;
    for (const id of orderActiveFirst(idx)) {
      const key = obraKey(id);
      const res = await loadObraEnvelope(key);
      if (res.kind === 'ok') {
        try {
          useObraStore.getState().loadObra(fromSerializable(res.envelope.data));
          activeId = id;
          if (idx.activeId !== id) await setActiveId(id); // el fallback cambió la activa
          armAutosave(); // tras cargar (la mutación de loadObra no debe disparar guardado)
          return;
        } catch {
          if (!firstCorrupt) firstCorrupt = { raw: res.envelope, key }; // versión no soportada
        }
      } else if (res.kind === 'corrupt') {
        if (!firstCorrupt) firstCorrupt = { raw: res.raw, key };
      }
    }

    // Ninguna obra cargó → recuperación (no pisar la demo, no armar autosave).
    if (firstCorrupt) usePersistStore.getState().setRecovery(firstCorrupt.raw, firstCorrupt.key);
  } catch {
    // IndexedDB no disponible (incógnito/bloqueado/cuota): seguimos en memoria.
    usePersistStore.getState().setStatus('error');
  }
}

/** Reset de testing: desuscribe, olvida el armado, el debounce y la obra activa. */
export function __resetSyncForTests(): void {
  if (unsub) unsub();
  unsub = null;
  armed = false;
  if (timer) clearTimeout(timer);
  timer = null;
  activeId = null;
  lastPersist = Promise.resolve();
}

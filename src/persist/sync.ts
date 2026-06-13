/* ===========================================================================
   persist/sync — hidratación + autosave + ORQUESTACIÓN multi-obra (T-10).
   Pega `persist` + `registry` + `sessionStore` al store de dominio.
     · `hydrate()` (antes de render): migra el legacy, reconcilia índice↔blobs y
       carga PEREZOSAMENTE solo la obra ACTIVA (D7). Fallback por obra si la
       activa falla. Puebla `sessionStore` (lista + activa) para el selector.
     · El autosave escucha SOLO el slice de dominio, debounced, y guarda la obra
       activa bajo su clave. La 1ª edición de la demo le asigna id y la registra.
     · Conmutar/crear/borrar obra (PR2): orquestadas aquí porque tocan a la vez
       persistencia (registry), dominio (loadObra) y autosave (suppression). La
       UI (selector) solo llama a estas funciones y lee `sessionStore`.
   =========================================================================== */
import { shallow } from 'zustand/shallow';
import {
  blankObraData,
  fromSerializable,
  toSerializable,
  useObraStore,
  type ObraState,
} from '../store';
import { flush, loadObraEnvelope, loadRaw, obraKey } from './persist';
import {
  createObra,
  deleteObra as registryDeleteObra,
  loadIndex,
  migrateLegacy,
  newObraId,
  reconcile,
  saveActiveObra,
  setActiveId as persistActiveId,
  type ObraIndex,
} from './registry';
import { usePersistStore } from './persistStore';
import { useSessionStore } from './sessionStore';

const DEBOUNCE_MS = 600;

let armed = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let unsub: (() => void) | null = null;
/** Mientras es true, el autosave NO reacciona a las mutaciones de dominio. Lo
 *  activa la carga de obra (hidratar/conmutar/crear): `loadObra` muta el dominio
 *  y NO debe disparar un guardado de la obra recién cargada (Codex). */
let suppress = false;
/** Última persistencia COMPLETA en vuelo (blob + índice). `flush()` solo cubre el
 *  blob; el índice se escribe DESPUÉS en `saveActiveObra`. */
let lastPersist: Promise<void> = Promise.resolve();

const activeId = (): string | null => useSessionStore.getState().activeId;

/** Id de la obra activa en memoria. */
export function getActiveObraId(): string | null {
  return activeId();
}

/** Slice de DOMINIO: el autosave solo reacciona a estos (no a la navegación). */
function domainSlice(s: ObraState) {
  return [s.chapters, s.partidas, s.recursos, s.certs, s.rates, s.obra] as const;
}

function persistNow(): Promise<void> {
  const data = toSerializable(useObraStore.getState());
  let id = activeId();
  if (!id) {
    id = newObraId(); // 1ª edición de la demo: nace su id
    useSessionStore.getState().setActiveId(id);
  }
  const target = id;
  usePersistStore.getState().setStatus('saving');
  lastPersist = saveActiveObra(target, data).then(
    async () => {
      // Refresca la lista del selector (nombre/fecha) leyendo solo el índice (barato).
      useSessionStore.getState().setObras((await loadIndex()).obras);
      usePersistStore.getState().setStatus('saved');
    },
    () => usePersistStore.getState().setStatus('error'),
  );
  return lastPersist;
}

/** Arma el autosave una sola vez. Suscribe al slice de dominio con shallow-eq. */
export function armAutosave(): void {
  if (armed) return; // idempotente: StrictMode no duplica la suscripción
  armed = true;
  unsub = useObraStore.subscribe(
    domainSlice,
    () => {
      if (suppress) return; // carga de obra en curso: no autoguardar
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void persistNow();
      }, DEBOUNCE_MS);
    },
    { equalityFn: shallow },
  );
}

/** Fuerza el guardado pendiente y espera a la cola (blob + índice). */
export function flushPending(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    void persistNow();
  }
  return Promise.all([flush(), lastPersist]).then(() => undefined);
}

/** Cancela un autosave pendiente SIN guardarlo (descartar ediciones de una obra
 *  que se va a borrar). No toca la cola ya en vuelo. */
function cancelPending(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/* ---- carga de una obra en el store de dominio ----------------------------- */
/** Carga el blob de `id` en el store (migrando schema), con el autosave
 *  SUPRIMIDO durante la mutación. `false` si el blob falta o no es válido. */
async function loadObraIntoStore(id: string): Promise<boolean> {
  const res = await loadObraEnvelope(obraKey(id));
  if (res.kind !== 'ok') return false;
  let data;
  try {
    data = fromSerializable(res.envelope.data);
  } catch {
    return false; // versión no soportada
  }
  suppress = true;
  try {
    useObraStore.getState().loadObra(data);
  } finally {
    suppress = false;
  }
  return true;
}

/* ---- hidratación ---------------------------------------------------------- */
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
    useSessionStore.getState().setObras(idx.obras);

    // Instalación nueva (sin obras): demo en memoria, arma autosave. La 1ª
    // edición creará el registro; la demo NO se fosiliza hasta entonces.
    if (idx.obras.length === 0) {
      useSessionStore.getState().setActiveId(null);
      armAutosave();
      return;
    }

    // Carga la activa; si falla, cae a la primera obra que cargue (fallback por
    // obra). Si NINGUNA carga, marca recuperación.
    let firstCorrupt: { raw: unknown; key: string } | null = null;
    for (const id of orderActiveFirst(idx)) {
      const key = obraKey(id);
      const res = await loadObraEnvelope(key);
      if (res.kind === 'ok') {
        if (await loadObraIntoStore(id)) {
          useSessionStore.getState().setActiveId(id);
          if (idx.activeId !== id) await persistActiveId(id); // el fallback cambió la activa
          armAutosave();
          return;
        }
        if (!firstCorrupt) firstCorrupt = { raw: res.envelope, key }; // versión no soportada
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

/* ---- orquestación multi-obra (PR2) ---------------------------------------- */
/**
 * Conmuta a otra obra: guarda la actual (blob+índice), carga la destino y solo
 * ENTONCES marca la activa (Codex: no marcar activa antes de cargar; si el
 * destino falla, no perder la obra en pantalla). No-op si ya es la activa.
 */
export async function switchObra(id: string): Promise<void> {
  if (id === activeId()) return;
  useSessionStore.getState().setSwitching(true);
  try {
    await flushPending(); // guarda la obra actual antes de soltarla
    if (!(await loadObraIntoStore(id))) {
      // destino corrupto/ausente: NO cambiar la activa; ofrecer recuperación
      usePersistStore.getState().setRecovery(await loadRaw(obraKey(id)), obraKey(id));
      return;
    }
    useSessionStore.getState().setActiveId(id); // solo tras carga OK
    await persistActiveId(id); // sella la activa en el índice
    useSessionStore.getState().setObras((await loadIndex()).obras);
  } finally {
    useSessionStore.getState().setSwitching(false);
  }
}

/** Crea una obra EN BLANCO, la persiste y conmuta a ella. Devuelve su id. */
export async function newObra(name?: string): Promise<string> {
  await flushPending(); // guarda la actual
  const data = blankObraData(name);
  const id = await createObra(data); // persiste + registra (no activa aún)
  suppress = true;
  try {
    useObraStore.getState().loadObra(data);
  } finally {
    suppress = false;
  }
  useSessionStore.getState().setActiveId(id);
  await persistActiveId(id);
  useSessionStore.getState().setObras((await loadIndex()).obras);
  armAutosave(); // por si veníamos de un arranque vacío sin armar
  return id;
}

/**
 * Borra una obra. Si era la activa, descarta sus ediciones pendientes y carga la
 * siguiente. No se puede borrar la ÚLTIMA: se reemplaza por una obra en blanco
 * (siempre queda ≥1 obra). Borrar una NO activa conserva intactas (y sin perder
 * el autosave) las ediciones de la obra en pantalla.
 */
export async function deleteObraById(id: string): Promise<void> {
  const wasActive = id === activeId();
  const onlyOne = useSessionStore.getState().obras.length <= 1;

  if (onlyOne) {
    // Reemplazar la última por una en blanco SIN re-guardar la que se borra.
    cancelPending();
    const data = blankObraData();
    await registryDeleteObra(id);
    const newId = await createObra(data);
    suppress = true;
    try {
      useObraStore.getState().loadObra(data);
    } finally {
      suppress = false;
    }
    useSessionStore.getState().setActiveId(newId);
    await persistActiveId(newId);
    useSessionStore.getState().setObras((await loadIndex()).obras);
    return;
  }

  if (wasActive) cancelPending(); // descarta ediciones de la obra que se borra
  await registryDeleteObra(id); // borra blob+entrada; avanza activeId si era la activa
  const idx = await loadIndex();
  useSessionStore.getState().setObras(idx.obras);
  if (wasActive && idx.activeId) {
    if (await loadObraIntoStore(idx.activeId)) {
      useSessionStore.getState().setActiveId(idx.activeId);
    }
  }
}

/** Reset de testing: desuscribe, olvida armado/debounce/activa/supresión. */
export function __resetSyncForTests(): void {
  if (unsub) unsub();
  unsub = null;
  armed = false;
  suppress = false;
  if (timer) clearTimeout(timer);
  timer = null;
  lastPersist = Promise.resolve();
  useSessionStore.setState({ obras: [], activeId: null, switching: false });
}

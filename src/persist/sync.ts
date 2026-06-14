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
  toSerializable,
  useObraStore,
  type ObraData,
  type ObraState,
} from '../store';
import { OBRA_KEY_PREFIX, clearObra, flush, loadObraEnvelope, loadRaw, obraKey } from './persist';
import {
  createObra,
  deleteObra as registryDeleteObra,
  loadObraData,
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
    (idx) => {
      // saveActiveObra ya devuelve el índice escrito → refresca el selector sin re-leer.
      useSessionStore.getState().setObras(idx.obras);
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
/** Vuelca un `ObraData` ya decodificado en el store con el autosave SUPRIMIDO
 *  durante la mutación (loadObra muta el dominio y no debe disparar guardado). */
function loadDataIntoStore(data: ObraData): void {
  suppress = true;
  try {
    useObraStore.getState().loadObra(data);
  } finally {
    suppress = false;
  }
}

/** Carga el blob de `id` en el store (migrando schema). `false` si falta/inválido. */
async function loadObraIntoStore(id: string): Promise<boolean> {
  const data = await loadObraData(id);
  if (!data) return false;
  loadDataIntoStore(data);
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
    const idx = await reconcile();
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
/** Serializa las operaciones de obra (conmutar/crear/borrar) para que no se
 *  solapen entre sí (doble clic, conmutar a mitad de un borrado…). El índice ya
 *  es atómico por su lado (registry.updateIndex); esto evita además que se
 *  entrelacen loadObra/setActiveId de dos operaciones. */
let opsChain: Promise<unknown> = Promise.resolve();
function serializeOp<T>(fn: () => Promise<T>): Promise<T> {
  const run = opsChain.then(fn);
  opsChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Conmuta a otra obra: guarda la actual (blob+índice), carga la destino y solo
 * ENTONCES marca la activa (Codex: no marcar activa antes de cargar; si el
 * destino falla, no perder la obra en pantalla). No-op si ya es la activa.
 */
export function switchObra(id: string): Promise<void> {
  return serializeOp(() => switchObraImpl(id));
}
async function switchObraImpl(id: string): Promise<void> {
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
    const idx = await persistActiveId(id); // sella la activa y devuelve el índice
    useSessionStore.getState().setObras(idx.obras);
  } finally {
    useSessionStore.getState().setSwitching(false);
  }
}

/** Crea una obra EN BLANCO, la persiste y conmuta a ella. Devuelve su id. */
export function newObra(name?: string): Promise<string> {
  return serializeOp(() => newObraImpl(name));
}
async function newObraImpl(name?: string): Promise<string> {
  await flushPending(); // guarda la actual
  const data = blankObraData(name);
  const id = await createObra(data); // persiste + registra (no activa aún)
  loadDataIntoStore(data);
  useSessionStore.getState().setActiveId(id);
  const idx = await persistActiveId(id);
  useSessionStore.getState().setObras(idx.obras);
  armAutosave(); // por si veníamos de un arranque vacío sin armar
  return id;
}

/**
 * Borra una obra. Si era la activa, descarta sus ediciones pendientes y carga la
 * siguiente. No se puede borrar la ÚLTIMA: se reemplaza por una obra en blanco
 * (siempre queda ≥1 obra). Borrar una NO activa conserva intactas (y sin perder
 * el autosave) las ediciones de la obra en pantalla.
 */
export function deleteObraById(id: string): Promise<void> {
  return serializeOp(() => deleteObraByIdImpl(id));
}
async function deleteObraByIdImpl(id: string): Promise<void> {
  const wasActive = id === activeId();
  const onlyOne = useSessionStore.getState().obras.length <= 1;

  if (onlyOne) {
    // Reemplazar la última por una en blanco SIN re-guardar la que se borra.
    cancelPending();
    const data = blankObraData();
    await registryDeleteObra(id);
    const newId = await createObra(data);
    loadDataIntoStore(data);
    useSessionStore.getState().setActiveId(newId);
    const idx = await persistActiveId(newId);
    useSessionStore.getState().setObras(idx.obras);
    return;
  }

  if (wasActive) cancelPending(); // descarta ediciones de la obra que se borra
  const idx = await registryDeleteObra(id); // borra blob+entrada; avanza activeId si era la activa
  useSessionStore.getState().setObras(idx.obras);
  if (!wasActive) return;

  // Borramos la activa: carga la nueva activa; si está corrupta, cae a otra obra
  // que cargue; si NINGUNA carga, marca recuperación (no dejar una activa fantasma).
  const candidates = [idx.activeId, ...idx.obras.map((m) => m.id)].filter(
    (x): x is string => x != null,
  );
  for (const cand of candidates) {
    if (await loadObraIntoStore(cand)) {
      useSessionStore.getState().setActiveId(cand);
      if (cand !== idx.activeId) await persistActiveId(cand);
      return;
    }
  }
  if (idx.activeId) {
    usePersistStore
      .getState()
      .setRecovery(await loadRaw(obraKey(idx.activeId)), obraKey(idx.activeId));
  }
}

/**
 * Descarta una obra en recuperación (banner de datos dañados). Para una obra del
 * registro REUSA `deleteObraById` (borra blob + entrada del índice, carga la
 * siguiente o crea una en blanco si era la única) → no deja una obra fantasma en
 * el selector. Para la clave legacy solo borra el blob. Arma el autosave (la
 * hidratación no lo armó en la rama de recuperación).
 */
export async function discardRecovery(key: string): Promise<void> {
  if (key.startsWith(OBRA_KEY_PREFIX)) {
    await deleteObraById(key.slice(OBRA_KEY_PREFIX.length));
  } else {
    await clearObra(key); // legacy (concreta.obra.v1)
  }
  armAutosave();
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

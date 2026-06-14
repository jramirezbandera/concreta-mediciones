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
import type { ImportedObra } from '../core/bc3import';
import {
  SCHEMA_VERSION,
  blankObraData,
  toSerializable,
  useObraStore,
  type ObraData,
  type ObraState,
} from '../store';
import { OBRA_KEY, OBRA_KEY_PREFIX, clearObra, flush, loadObraEnvelope, loadRaw, obraKey } from './persist';
import {
  createObra,
  deleteObra as registryDeleteObra,
  loadObraData,
  metaOf,
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

/**
 * Importa un .bc3 ya parseado como obra NUEVA de SOLO REFERENCIA: la persiste y
 * registra (tag `reference`) SIN activarla, sin tocar la obra en pantalla ni su
 * autosave. Devuelve su id para que el panel la seleccione como fuente.
 *
 * `result.data` es un `ImportedObra` (sin `schemaVersion` a propósito: lo estampa
 * `loadObra` en la ruta normal). Aquí saltamos `loadObra`, así que ESTAMPAMOS el
 * schema antes de persistir — sin ello el blob/índice quedarían inválidos. La
 * lista del selector se refresca con `upsertObra` (no `loadIndex`+`setObras`
 * entero, que podría regresar la meta de la activa si entra un autosave en medio).
 */
export function importObraAsReference(data: ImportedObra): Promise<string> {
  return serializeOp(() => importObraAsReferenceImpl(data));
}
async function importObraAsReferenceImpl(data: ImportedObra): Promise<string> {
  const obraData: ObraData = { schemaVersion: SCHEMA_VERSION, ...data };
  const id = await createObra(obraData, 'reference');
  useSessionStore.getState().upsertObra(metaOf(id, obraData, 'reference'));
  return id;
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
 * Tras quedarse SIN obra activa (borrado/descarte): activa la PRIMERA obra de
 * `ids` que cargue (sella la activa + arma autosave). Si quedan obras pero
 * NINGUNA carga, marca recuperación con la primera corrupta (el banner reaparece;
 * descartar de nuevo procesa la siguiente). Si no queda ninguna, crea una obra en
 * blanco (invariante "siempre ≥1 obra"). Compartida por borrar-la-activa y
 * descartar-recuperación.
 */
async function activateFirstLoadable(ids: string[]): Promise<void> {
  let firstCorrupt: { raw: unknown; key: string } | null = null;
  for (const m of ids) {
    if (await loadObraIntoStore(m)) {
      useSessionStore.getState().setActiveId(m);
      await persistActiveId(m);
      armAutosave();
      return;
    }
    if (!firstCorrupt) firstCorrupt = { raw: await loadRaw(obraKey(m)), key: obraKey(m) };
  }
  if (firstCorrupt) {
    // Quedan obras pero todas corruptas: recuperación (no armar; no activar fantasma).
    useSessionStore.getState().setActiveId(null);
    usePersistStore.getState().setRecovery(firstCorrupt.raw, firstCorrupt.key);
    return;
  }
  // No queda ninguna obra → una en blanco.
  const data = blankObraData();
  const newId = await createObra(data);
  loadDataIntoStore(data);
  useSessionStore.getState().setActiveId(newId);
  const idx = await persistActiveId(newId);
  useSessionStore.getState().setObras(idx.obras);
  armAutosave();
}

/**
 * Borra una obra. Si era la activa, descarta sus ediciones pendientes y activa la
 * siguiente que cargue (o una en blanco si no queda ninguna — invariante ≥1).
 * Borrar una NO activa conserva intactas (sin perder el autosave) las ediciones
 * de la obra en pantalla.
 */
export function deleteObraById(id: string): Promise<void> {
  return serializeOp(() => deleteObraByIdImpl(id));
}
async function deleteObraByIdImpl(id: string): Promise<void> {
  const wasActive = id === activeId();
  if (wasActive) cancelPending(); // descarta ediciones de la obra que se borra
  const idx = await registryDeleteObra(id); // borra blob+entrada; avanza activeId si procede
  useSessionStore.getState().setObras(idx.obras);
  if (!wasActive) return;
  // `idx.obras` excluye la borrada y su primer elemento es la nueva activeId
  // (registry la promovió) → sin duplicar como hacía la lista anterior.
  await activateFirstLoadable(idx.obras.map((m) => m.id));
}

/**
 * Descarta una obra en recuperación (banner de datos dañados). Borra esa obra del
 * registro y activa la siguiente que cargue (o una en blanco). Si quedaban VARIAS
 * obras corruptas, `activateFirstLoadable` vuelve a poner en recuperación la
 * siguiente → descartar de nuevo la procesa (no deja fantasmas). Para la clave
 * legacy (`concreta.obra.v1`, sin entrada en el registro) solo borra el blob.
 */
export function discardRecovery(key: string): Promise<void> {
  return serializeOp(() => discardRecoveryImpl(key));
}
async function discardRecoveryImpl(key: string): Promise<void> {
  // `discardRecovery` es dueño del banner: lo cierra aquí; si quedan obras
  // corruptas, `activateFirstLoadable` lo vuelve a abrir para la siguiente.
  usePersistStore.getState().setRecovery(null);
  // OBRA_KEY también empieza por OBRA_KEY_PREFIX → excluirla explícitamente.
  if (key.startsWith(OBRA_KEY_PREFIX) && key !== OBRA_KEY) {
    const idx = await registryDeleteObra(key.slice(OBRA_KEY_PREFIX.length));
    useSessionStore.getState().setObras(idx.obras);
    await activateFirstLoadable(idx.obras.map((m) => m.id));
  } else {
    await clearObra(key); // legacy: solo blob (no hay entrada de registro)
    armAutosave();
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

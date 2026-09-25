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
  useToastStore,
  type ObraData,
  type ObraState,
} from '../store';
import { DOMAIN_KEYS } from '../store/schema';
import { __resetHistoryForTests } from '../store/temporal';
import { OBRA_KEY, OBRA_KEY_PREFIX, clearObra, flush, loadObraEnvelope, obraKey } from './persist';
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
  setUltimaCopia,
  type LoadObraResult,
  type ObraIndex,
} from './registry';
import { usePersistStore } from './persistStore';
import { useSessionStore, type ReadonlyMotivo } from './sessionStore';
import { claimObra, releaseActiveLock } from './tabLock';
import { exportObraJson } from './transfer';

/** T1.3a: debounce más largo (la edición llega en ráfagas; no hace falta guardar a
 *  media palabra) + el guardado pesado se difiere a `requestIdleCallback` para no
 *  bloquear la interacción tras cada edición. El flush en `pagehide`/`visibilitychange`
 *  (App.tsx) cubre el cierre de pestaña, así que alargar el debounce no pierde datos. */
const DEBOUNCE_MS = 1500;

/** Difiere el clone+write de IndexedDB a tiempo ocioso (con techo de 2 s para que
 *  no se quede sin ejecutar). Fallback a `setTimeout` donde no haya rIC (jsdom,
 *  Safari viejo). Detectado una vez para mantener consistentes request/cancel. */
const hasIdle = typeof requestIdleCallback === 'function';
const requestIdle = (cb: () => void): number =>
  hasIdle ? requestIdleCallback(cb, { timeout: 2000 }) : (setTimeout(cb, 0) as unknown as number);
const cancelIdle = (h: number): void => (hasIdle ? cancelIdleCallback(h) : clearTimeout(h));

let armed = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let idleHandle: number | null = null;
/** Hay un guardado PROGRAMADO (debounce o idle) aún sin ejecutar. `flushPending`
 *  lo usa para forzar `persistNow` tras cancelar lo pendiente. */
let dirty = false;
let unsub: (() => void) | null = null;
/** Mientras es true, el autosave NO reacciona a las mutaciones de dominio. Lo
 *  activa la carga de obra (hidratar/conmutar/crear): `loadObra` muta el dominio
 *  y NO debe disparar un guardado de la obra recién cargada (Codex). */
let suppress = false;
/** Última persistencia COMPLETA en vuelo (blob + índice). `flush()` solo cubre el
 *  blob; el índice se escribe DESPUÉS en `saveActiveObra`. Resuelve a si el
 *  guardado ATERRIZÓ (A-04): nunca rechaza (no envenena cadenas), pero el
 *  `false` permite a `switchObra` no soltar una obra con cambios sin guardar. */
let lastPersist: Promise<boolean> = Promise.resolve(true);
/** ¿Esta pestaña es la DUEÑA de la obra activa? (T-19). Si `false`, la obra la
 *  tiene otra pestaña → el autosave NO escribe (evita pisarla). Optimista: por
 *  defecto `true` y solo baja a `false` si la sonda del lock encuentra contienda,
 *  así la pestaña dueña no parpadea a solo-lectura en cada arranque. */
let isOwner = true;

/** Programa un guardado: debounce → idle → `persistNow`. Reinicia el anterior. */
function scheduleSave(): void {
  if (!isOwner) return; // solo-lectura (otra pestaña es dueña): no autosalvar (T-19)
  dirty = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    idleHandle = requestIdle(() => {
      idleHandle = null;
      dirty = false;
      void persistNow();
    });
  }, DEBOUNCE_MS);
}

/** Cancela el guardado programado (debounce + idle) SIN ejecutarlo. */
function clearScheduled(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (idleHandle !== null) {
    cancelIdle(idleHandle);
    idleHandle = null;
  }
}

const activeId = (): string | null => useSessionStore.getState().activeId;

/** Id de la obra activa en memoria. */
export function getActiveObraId(): string | null {
  return activeId();
}

/** Slice de DOMINIO: el autosave solo reacciona a estos (no a la navegación).
 *  Derivado de `DOMAIN_KEYS` (fuente única en schema, compartida con el
 *  historial de undo): la lista manual omitía `bajas` y divergía de lo que el
 *  undo restaura — un undo cuyo único delta fuese `bajas` no se persistía
 *  (auditoría 2026-07-05). */
function domainSlice(s: ObraState) {
  return DOMAIN_KEYS.map((k) => s[k]);
}

function persistNow(): Promise<boolean> {
  if (!isOwner) return Promise.resolve(true); // solo-lectura: nada que escribir (T-19)
  const data = toSerializable(useObraStore.getState());
  let id = activeId();
  if (!id) {
    id = newObraId(); // 1ª edición de la demo: nace su id
    useSessionStore.getState().setActiveId(id);
  }
  const target = id;
  usePersistStore.getState().setStatus('saving');
  lastPersist = saveActiveObra(target, data).then(
    (res) => {
      if (res.kind === 'version-conflict') {
        // TERMINAL (Etapa 0): en disco hay una versión más nueva de esta obra y
        // no se ha tocado. La pestaña pasa a solo lectura; como en solo lectura
        // no queda nada que escribir, se resuelve a `true` (recargar o conmutar
        // no deben quedarse bloqueados esperando un guardado imposible). Lo
        // explica el aviso de «más nueva»; el chip «Sin guardar» lo repetiría y
        // taparía su botón «Recargar» (los dos van abajo a la derecha).
        marcarMasNueva(target);
        usePersistStore.getState().setStatus('idle');
        return true;
      }
      // saveActiveObra ya devuelve el índice escrito → refresca el selector sin re-leer.
      useSessionStore.getState().setObras(res.index.obras);
      usePersistStore.getState().setStatus('saved');
      return true;
    },
    () => {
      usePersistStore.getState().setStatus('error');
      return false;
    },
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
      scheduleSave();
    },
    { equalityFn: shallow },
  );
}

/** Esta pestaña deja de escribir la obra activa (y olvida lo programado). */
function enterReadonly(motivo: ReadonlyMotivo): void {
  isOwner = false;
  cancelPending();
  useSessionStore.getState().setReadonly(true, motivo);
}

/** Esta pestaña pasa a ser la dueña de la obra activa: autosave activo. */
function becomeOwner(): void {
  isOwner = true;
  useSessionStore.getState().setReadonly(false);
  armAutosave();
}

/** Anota que la obra `id` la guardó una versión MÁS NUEVA de Concreta: aviso sin
 *  «Descartar». Si es la obra en pantalla, esta pestaña pasa a solo lectura y ya
 *  no la vuelve a escribir. */
function marcarMasNueva(id: string): void {
  const nombre = useSessionStore.getState().obras.find((m) => m.id === id)?.name ?? 'Obra sin nombre';
  usePersistStore.getState().setMasNueva({ id, nombre });
  if (id === activeId()) enterReadonly('mas-nueva');
}

/**
 * Reclama la propiedad de la obra `id` entre PESTAÑAS (T-19) y refleja el
 * resultado: DUEÑA → autosave activo; SOLO-LECTURA → autosave inhibido
 * (`isOwner=false`). En el TRASPASO (la otra pestaña soltó el lock) recarga la
 * obra de disco antes de retomar el autosave, por si la ex-dueña dejó datos más
 * nuevos (no pisarla con el estado viejo en memoria). Optimista: `isOwner` queda
 * en `true` hasta que la sonda del lock confirme contienda, así la dueña no
 * parpadea a solo-lectura. Sin Web Locks → siempre dueña (pestaña única).
 */
function claimActive(id: string): void {
  claimObra(id, {
    onOwner: (reason) => {
      if (reason === 'initial') {
        becomeOwner();
        return;
      }
      // TRASPASO (Etapa 0): la pestaña sigue en solo lectura hasta que la recarga
      // devuelve `ok`. El autosave ya estaba armado desde `hydrate`, así que ser
      // dueña ANTES de recargar dejaría que la siguiente edición pisara en disco
      // lo que la ex-dueña guardó (u otra versión más nueva de la obra).
      void serializeOp(async () => {
        if (activeId() !== id) return; // se conmutó entre medias: manda el reclamo nuevo
        let res: LoadObraResult | null = null;
        try {
          res = await loadObraIntoStore(id);
        } catch {
          // IndexedDB no responde: sigue en solo lectura (abajo).
        }
        if (res?.kind === 'ok') return becomeOwner();
        if (res?.kind === 'mas-nueva') return marcarMasNueva(id);
        if (res?.kind === 'danada') usePersistStore.getState().setRecovery(res.raw, obraKey(id));
        useSessionStore.getState().setReadonly(true, 'sin-recargar');
      });
    },
    onReadonly: () => {
      isOwner = false;
      useSessionStore.getState().setReadonly(true);
    },
  });
}

/** Fuerza el guardado pendiente y espera a la cola (blob + índice). Cancela el
 *  debounce/idle programado y persiste YA si quedaban cambios sin guardar.
 *  Devuelve si TODO aterrizó (A-04): `false` = hay trabajo en memoria que no
 *  llegó a disco. Si el último guardado había FALLADO y no había nada nuevo
 *  programado, reintenta una vez (la cuota puede haberse liberado). */
export function flushPending(): Promise<boolean> {
  clearScheduled();
  const hadDirty = dirty;
  if (dirty) {
    dirty = false;
    void persistNow();
  }
  return Promise.all([flush(), lastPersist]).then(([, ok]) => {
    if (ok || hadDirty) return ok;
    return persistNow(); // reintento único del guardado fallido
  });
}

/** Cancela un autosave pendiente SIN guardarlo (descartar ediciones de una obra
 *  que se va a borrar). No toca la cola ya en vuelo. Exportada para el
 *  ErrorBoundary raíz (E-03): tras un crash de render NO se fosiliza el estado
 *  que (quizá) lo provocó. */
export function cancelPending(): void {
  clearScheduled();
  dirty = false;
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

/** Carga el blob de `id` en el store (migrando schema) si se puede leer; si no,
 *  deja el store como estaba y devuelve por qué. */
async function loadObraIntoStore(id: string): Promise<LoadObraResult> {
  const res = await loadObraData(id);
  if (res.kind === 'ok') loadDataIntoStore(res.data);
  return res;
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
    // obra). Si NINGUNA carga, marca recuperación. Una obra de una versión MÁS
    // NUEVA no es «dañada»: se salta sin ofrecer descartarla y se avisa aparte.
    let firstCorrupt: { raw: unknown; key: string } | null = null;
    let firstNewer: string | null = null;
    for (const id of orderActiveFirst(idx)) {
      const res = await loadObraIntoStore(id);
      if (res.kind === 'ok') {
        useSessionStore.getState().setActiveId(id);
        if (idx.activeId !== id) await persistActiveId(id); // el fallback cambió la activa
        armAutosave();
        claimActive(id); // T-19: propiedad entre pestañas (puede bajar a solo-lectura)
        // A-10: si la ACTIVA original estaba corrupta y caímos a otra obra, el
        // cambio silencioso desconcierta («¿dónde está mi obra?»). El banner de
        // recuperación convive con la obra cargada: exportar copia o descartar.
        if (firstCorrupt)
          usePersistStore.getState().setRecovery(firstCorrupt.raw, firstCorrupt.key);
        if (firstNewer) marcarMasNueva(firstNewer);
        return;
      }
      if (res.kind === 'mas-nueva') firstNewer ??= id;
      else if (res.kind === 'danada' && !firstCorrupt) firstCorrupt = { raw: res.raw, key: obraKey(id) };
    }

    // Ninguna obra cargó → recuperación. El autosave SÍ se arma (auditoría A-01):
    // sin obra activa `persistNow` genera un id NUEVO —nunca escribe sobre la
    // clave corrupta ni sobre la más nueva—, así editar la demo o restaurar un
    // backup .json desde el banner persiste de verdad (antes: éxito aparente sin
    // guardar nada, ni siquiera el chip «Sin guardar»).
    if (firstNewer) marcarMasNueva(firstNewer);
    if (firstCorrupt) usePersistStore.getState().setRecovery(firstCorrupt.raw, firstCorrupt.key);
    if (firstCorrupt || firstNewer) armAutosave();
  } catch {
    // IndexedDB no disponible (incógnito/bloqueado/cuota): seguimos en memoria.
    usePersistStore.getState().setStatus('error');
  }
}

/* ---- orquestación multi-obra (PR2) ---------------------------------------- */
/** Aviso cuando la obra actual no llega a disco y por eso no se sustituye. */
const NO_GUARDADA =
  'No se pudo guardar esta obra; se queda abierta para no perder cambios. Libera espacio y reintenta.';

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
    // A-04 (decisión: BLOQUEAR): si el guardado de la obra actual no aterriza
    // (cuota llena, IDB caído), NO se conmuta — la edición en riesgo se queda a
    // la vista en vez de esfumarse tras el cambio. Antes `flushPending` tragaba
    // el fallo y se conmutaba igual, con el chip «Sin guardar» como única señal.
    if (!(await flushPending())) {
      useToastStore.getState().show(NO_GUARDADA);
      return;
    }
    const res = await loadObraIntoStore(id);
    if (res.kind === 'mas-nueva') {
      marcarMasNueva(id); // NO cambiar la activa; el aviso pide recargar, sin descartar
      return;
    }
    if (res.kind !== 'ok') {
      // destino corrupto/ausente: NO cambiar la activa; ofrecer recuperación
      usePersistStore.getState().setRecovery(res.kind === 'danada' ? res.raw : null, obraKey(id));
      return;
    }
    useSessionStore.getState().setActiveId(id); // solo tras carga OK
    const idx = await persistActiveId(id); // sella la activa y devuelve el índice
    useSessionStore.getState().setObras(idx.obras);
    claimActive(id); // T-19: re-reclama el lock de la obra destino (libera la previa)
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
  const obraData: ObraData = { schemaVersion: SCHEMA_VERSION, bajas: {}, ...data };
  const id = await createObra(obraData, 'reference');
  useSessionStore.getState().upsertObra(metaOf(id, obraData, 'reference'));
  return id;
}

/** Crea una obra EN BLANCO, la persiste y conmuta a ella. Devuelve su id, o
 *  `null` si no se pudo guardar la actual (entonces no se crea nada). */
export function newObra(name?: string): Promise<string | null> {
  return serializeOp(() => newObraImpl(name));
}
async function newObraImpl(name?: string): Promise<string | null> {
  // Como al conmutar (A-04): si la actual no llega a disco, no se sustituye en
  // pantalla por una obra en blanco (sus cambios se perderían sin aviso).
  if (!(await flushPending())) {
    useToastStore.getState().show(NO_GUARDADA);
    return null;
  }
  const data = blankObraData(name);
  const id = await createObra(data); // persiste + registra (no activa aún)
  loadDataIntoStore(data);
  useSessionStore.getState().setActiveId(id);
  const idx = await persistActiveId(id);
  useSessionStore.getState().setObras(idx.obras);
  armAutosave(); // por si veníamos de un arranque vacío sin armar
  claimActive(id); // T-19: obra nueva → lock libre → dueña
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
  let firstNewer: string | null = null;
  for (const m of ids) {
    const res = await loadObraIntoStore(m);
    if (res.kind === 'ok') {
      useSessionStore.getState().setActiveId(m);
      await persistActiveId(m);
      armAutosave();
      claimActive(m); // T-19
      if (firstNewer) marcarMasNueva(firstNewer);
      return;
    }
    // Una obra de una versión más nueva se salta y se avisa: nunca pasa por el
    // banner de recuperación, que ofrece descartarla.
    if (res.kind === 'mas-nueva') firstNewer ??= m;
    else if (!firstCorrupt) firstCorrupt = { raw: res.kind === 'danada' ? res.raw : undefined, key: obraKey(m) };
  }
  if (firstNewer) marcarMasNueva(firstNewer);
  if (firstCorrupt) {
    // Quedan obras pero todas corruptas: recuperación (no armar; no activar fantasma).
    useSessionStore.getState().setActiveId(null);
    usePersistStore.getState().setRecovery(firstCorrupt.raw, firstCorrupt.key);
    return;
  }
  // No queda ninguna obra que se pueda abrir → una en blanco (las de una versión
  // más nueva siguen en disco, intactas).
  const data = blankObraData();
  const newId = await createObra(data);
  loadDataIntoStore(data);
  useSessionStore.getState().setActiveId(newId);
  const idx = await persistActiveId(newId);
  useSessionStore.getState().setObras(idx.obras);
  armAutosave();
  claimActive(newId); // T-19
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
  if (usePersistStore.getState().masNueva?.id === id) usePersistStore.getState().setMasNueva(null);
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
  const isObraKey = key.startsWith(OBRA_KEY_PREFIX) && key !== OBRA_KEY;
  // Etapa 0: lo que hay AHORA en disco puede ser de una versión más nueva (otra
  // pestaña actualizada lo reescribió). Eso nunca se descarta.
  if ((await loadObraEnvelope(key)).kind === 'newer') {
    if (isObraKey) marcarMasNueva(key.slice(OBRA_KEY_PREFIX.length));
    return;
  }
  if (isObraKey) {
    const discardedId = key.slice(OBRA_KEY_PREFIX.length);
    const wasActive = discardedId === activeId();
    const idx = await registryDeleteObra(discardedId);
    useSessionStore.getState().setObras(idx.obras);
    // A-10: si la corrupta NO era la obra en pantalla (banner conviviendo con
    // una obra sana ya cargada), no hay nada que reactivar — tocar la activa
    // recargaría de disco y descartaría la última edición en memoria.
    if (wasActive || activeId() == null)
      await activateFirstLoadable(idx.obras.map((m) => m.id));
  } else {
    await clearObra(key); // legacy: solo blob (no hay entrada de registro)
    armAutosave();
  }
}

/* ---- copia .json e importación sobre la obra activa ----------------------- */
/** Sella (o borra) la fecha de copia en el índice y refresca el selector. Un
 *  fallo del índice no se propaga: el recordatorio seguirá avisando. */
async function sellarCopia(id: string, at: string | null): Promise<void> {
  try {
    useSessionStore.getState().setObras((await setUltimaCopia(id, at)).obras);
  } catch {
    // índice no disponible
  }
}

/**
 * Descarga la copia .json de la obra en pantalla y sella su `ultimaCopia` en el
 * índice (recordatorio de copia). El id se captura AL EXPORTAR: si después se
 * conmuta de obra, la fecha va a la que se copió. Se sella la descarga
 * INICIADA; el navegador no confirma que el fichero llegara a guardarse.
 */
export function descargarCopia(filename?: string): void {
  const id = activeId();
  exportObraJson(filename);
  if (id) void sellarCopia(id, new Date().toISOString());
}

/** Cómo acabó importar un .json sobre la obra activa. */
export type ImportarResult =
  /** La obra importada está en pantalla y en disco. */
  | { kind: 'ok' }
  /** La pestaña está en solo lectura: aquí no se guardaría nada. */
  | { kind: 'solo-lectura' }
  /** La obra actual no llegó a disco: no se importa (sus cambios siguen a la vista). */
  | { kind: 'sin-guardar-actual' }
  /** La importada está en pantalla pero NO en disco. `puedeVolver`: la anterior
   *  sigue guardada y `volverAObraGuardada` la trae de vuelta. */
  | { kind: 'sin-guardar'; puedeVolver: boolean };

/**
 * Importa un `ObraData` ya validado SUSTITUYENDO la obra activa (misma entrada
 * del registro). Antes guarda la actual y descarga su copia (que sella la obra
 * ANTERIOR); después comprueba que la importada llegó a disco, en vez de darla
 * por buena. La importada empieza sin fecha de copia.
 */
export function importarSobreActiva(data: ObraData): Promise<ImportarResult> {
  return serializeOp(() => importarSobreActivaImpl(data));
}
async function importarSobreActivaImpl(data: ObraData): Promise<ImportarResult> {
  if (!isOwner) return { kind: 'solo-lectura' };
  if (!(await flushPending())) return { kind: 'sin-guardar-actual' };
  const prevId = activeId();
  descargarCopia('concreta-copia-antes-de-importar.json');
  // Se guarda a mano, sin esperar al autosave: puede no estar armado (IndexedDB
  // no respondía al arrancar) y entonces nada la guardaría. `isOwner` puede caer
  // durante el guardado (una versión más nueva en disco), y en solo lectura
  // `persistNow` da `true` sin haber escrito nada.
  loadDataIntoStore(data);
  if (!(await persistNow()) || !isOwner) return { kind: 'sin-guardar', puedeVolver: prevId !== null };
  const id = activeId();
  if (id) await sellarCopia(id, null);
  return { kind: 'ok' };
}

/** Tras una importación que no llegó a disco: recarga en pantalla la obra activa
 *  tal como está guardada (la anterior). `false` si no se pudo leer. */
export function volverAObraGuardada(): Promise<boolean> {
  return serializeOp(async () => {
    const id = activeId();
    if (!id) return false;
    cancelPending();
    if ((await loadObraIntoStore(id)).kind !== 'ok') return false;
    lastPersist = Promise.resolve(true); // lo que se ve es lo que hay en disco
    usePersistStore.getState().setStatus('idle');
    return true;
  });
}

/** Reset de testing: desuscribe, olvida armado/debounce/activa/supresión. */
export function __resetSyncForTests(): void {
  if (unsub) unsub();
  unsub = null;
  armed = false;
  suppress = false;
  clearScheduled();
  dirty = false;
  lastPersist = Promise.resolve(true);
  releaseActiveLock(); // T-19: suelta el lock de obra entre pestañas
  isOwner = true;
  useSessionStore.setState({
    obras: [],
    activeId: null,
    switching: false,
    readonly: false,
    readonlyMotivo: null,
  });
  usePersistStore.setState({ masNueva: null });
  // El historial de undo es plumbing hermano del autosave (misma suscripción de
  // dominio): resetear uno sin el otro filtraría suscripción + pilas entre tests
  // (seam exigido por el diseño; auditoría 2026-07-05).
  __resetHistoryForTests();
}

/* ===========================================================================
   registry — registro multi-obra (T-10). Un ÍNDICE persistido pequeño con los
   metadatos de cada obra (id/nombre/fecha/versión) + un `activeId`; los blobs de
   dominio viven en `persist` bajo `concreta.obra.<id>`.

   Decisión eng-review 2026-06-13 (D7, cross-model): índice persistido + carga
   PEREZOSA de la obra activa, NO derivar la lista leyendo todos los blobs. El
   criterio es rendimiento de arranque: al iniciar se lee un blob pequeño de
   metadatos + se hidrata solo la obra activa; las demás se cargan al conmutar.
   El coste (doble escritura índice↔blob) se cubre con `reconcile`, que compara
   las claves de IndexedDB (baratо, sin leer valores) contra el índice y auto-cura
   desincronizaciones (blob sin entrada, entrada sin blob).

   Espacio v6 (planos PDF, §1.1 de la especificación):
     · el índice v6 nace del v5 (misma lista, orden, activa y meta) con cada obra
       `porMigrar`; `reconcile` añade al final las obras v5 que una pestaña
       antigua cree después;
     · una obra `porMigrar` se lee de su clave v5 y se migra en memoria; solo la
       pestaña DUEÑA la escribe en v6 (`saveActiveObra` con `migracion`), sella
       `concreta.version.<id> = 6` y apunta `migracionV5` en la meta;
     · la clave v5 se queda como copia; `limpiarCopiasV5` la borra 30 días
       después si nadie la tocó, y `hayCambiosAntiguos` avisa si una pestaña
       antigua siguió guardando en ella.
   =========================================================================== */
import { del, get, set } from 'idb-keyval';
import { rawUuid } from '../core/id';
import { SCHEMA_VERSION, fromSerializable, type ObraData } from '../store';
import {
  OBRA_KEY,
  OBRA_KEY_PREFIX,
  V5_OBRA_KEY_PREFIX,
  clearObra,
  loadObraEnvelope,
  loadRaw,
  obraKey,
  obraKeys,
  saveObra,
  v5ObraKey,
  v5ObraKeys,
  v5VersionKey,
} from './persist';
import { usePersistStore } from './persistStore';

/** Clave del índice de obras v6 (metadatos + obra activa). */
export const INDEX_KEY = 'concreta6.obras.index';
/** Índice v5: solo se lee para migrar (y se toca al borrar o limpiar una obra). */
export const V5_INDEX_KEY = 'concreta.obras.index.v1';
/** Días que la copia v5 de una obra migrada se conserva sin cambios antes de borrarla. */
export const DIAS_COPIA_V5 = 30;

/** Tipo de obra: de trabajo (la editas/certificas) o solo de referencia
 *  (importada para copiar partidas; no aparece en el selector de obras). Las
 *  entradas legacy sin `kind` se tratan como `'obra'`. */
export type ObraKind = 'obra' | 'reference';

/** Metadatos de una obra para listar/pintar pestañas SIN leer su blob entero. */
export interface ObraMeta {
  id: string;
  name: string;
  savedAt: string; // ISO 8601
  schemaVersion: number;
  /** Ausente = obra de trabajo (compat). `'reference'` = solo fuente de copia. */
  kind?: ObraKind;
  /** Cuándo se DESCARGÓ la última copia .json de esta obra (ISO 8601). Vive en
   *  la meta y no en `ObraData`: no es dominio ni viaja en la copia. Ausente =
   *  nunca. El navegador no confirma que el fichero se guardara. */
  ultimaCopia?: string;
  /** Su sobre sigue solo en la clave v5 (§1.1): se migra al abrirla. */
  porMigrar?: true;
  /** Estado de la copia v5 al migrar (o al último «Ignorar» / «Abrir aparte»):
   *  el `savedAt` del sobre v5 y el de su meta en el índice v5 (no coinciden:
   *  `metaOf` sella el del índice DESPUÉS de guardar el sobre) y cuándo. El
   *  aviso de cambios antiguos compara el del índice; la limpieza, los dos. */
  migracionV5?: MigracionV5;
}

export interface MigracionV5 {
  savedAt: string;
  indiceSavedAt: string;
  at: string;
}

/** Índice persistido: la obra activa + los metadatos de todas las guardadas. */
export interface ObraIndex {
  activeId: string | null;
  obras: ObraMeta[];
}

const EMPTY_INDEX: ObraIndex = { activeId: null, obras: [] };

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}
function isMeta(x: unknown): x is ObraMeta {
  return (
    isRecord(x) &&
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    typeof x.savedAt === 'string' &&
    typeof x.schemaVersion === 'number' &&
    (x.kind === undefined || x.kind === 'obra' || x.kind === 'reference')
  );
}
function isIndex(x: unknown): x is ObraIndex {
  return (
    isRecord(x) &&
    (x.activeId === null || typeof x.activeId === 'string') &&
    Array.isArray(x.obras) &&
    x.obras.every(isMeta)
  );
}

/** Id único de obra (mismo origen de unicidad que los ids del dominio). */
export function newObraId(): string {
  return rawUuid();
}

/** Resultado de leer una obra guardada. `mas-nueva` = la guardó una versión
 *  posterior de Concreta: no se carga, no se descarta y no se pisa. Con `v5`,
 *  la obra salió de su clave v5 migrada EN MEMORIA: aún no está en v6. */
export type LoadObraResult =
  | { kind: 'ok'; data: ObraData; v5?: { savedAt: string; indiceSavedAt: string } }
  | { kind: 'vacia' }
  | { kind: 'danada'; raw: unknown }
  | { kind: 'mas-nueva'; raw: unknown; version: number };

/**
 * Carga el blob de la obra `id` y migra su esquema (`fromSerializable`). Punto
 * único de decodificación: lo comparten la carga al store
 * (`sync.loadObraIntoStore`) y la carga como fuente de Referencia
 * (`obraSource.loadObraRefSource`). La versión se mira ANTES que la forma. Si
 * la obra aún no está en v6, la lee de su clave v5 y la migra en memoria, SIN
 * escribir nada: migrar es cosa de la pestaña dueña (`saveActiveObra`).
 */
export async function loadObraData(id: string): Promise<LoadObraResult> {
  let res = await loadObraEnvelope(obraKey(id));
  let v5: { savedAt: string; indiceSavedAt: string } | undefined;
  if (res.kind === 'empty') {
    res = await loadObraEnvelope(v5ObraKey(id));
    if (res.kind === 'ok') {
      const meta5 = (await loadV5Index()).obras.find((m) => m.id === id);
      v5 = { savedAt: res.envelope.savedAt, indiceSavedAt: meta5?.savedAt ?? res.envelope.savedAt };
    }
  }
  if (res.kind === 'empty') return { kind: 'vacia' };
  if (res.kind === 'newer') return { kind: 'mas-nueva', raw: res.raw, version: res.version };
  if (res.kind === 'corrupt') return { kind: 'danada', raw: res.raw };
  try {
    const data = fromSerializable(res.envelope.data);
    return v5 ? { kind: 'ok', data, v5 } : { kind: 'ok', data };
  } catch {
    return { kind: 'danada', raw: res.envelope }; // versión antigua sin ruta de migración
  }
}

const nameOf = (data: ObraData): string => data.obra.denominacion || 'Obra sin nombre';

/* ---- índice: lectura/escritura -------------------------------------------- */
export async function loadIndex(): Promise<ObraIndex> {
  const raw = await get(INDEX_KEY);
  return isIndex(raw) ? raw : { ...EMPTY_INDEX };
}

/** Índice v5 (lectura barata, sin sobres). */
export async function loadV5Index(): Promise<ObraIndex> {
  const raw = await get(V5_INDEX_KEY);
  return isIndex(raw) ? raw : { ...EMPTY_INDEX };
}

async function saveIndex(idx: ObraIndex): Promise<void> {
  await set(INDEX_KEY, idx);
}

/**
 * Read-modify-write ATÓMICO del índice. Las escrituras de blobs van por la cola
 * de `persist`, pero el índice es UN blob que varias operaciones tocan
 * (autosave + crear/borrar/conmutar). Sin serializar, dos que se solapen en sus
 * `await` leen el mismo snapshot y la última pisa a la primera (pierde una obra
 * o revierte la activa). Esta cola de un carril garantiza que cada
 * load→mutate→save corre entero antes del siguiente. Guarda solo si cambió la
 * referencia (el mutador devuelve el mismo objeto = sin cambios → sin escritura).
 */
let indexChain: Promise<unknown> = Promise.resolve();
/** RMW del índice bajo Web Lock (auditoría A-09): `indexChain` serializa DENTRO
 *  de la pestaña, pero dos pestañas (obras distintas, ambas dueñas legítimas)
 *  podían entrelazar load→mutate→save y la última escritura pisaba a la primera
 *  (entrada desaparecida del selector hasta el `reconcile` del siguiente
 *  arranque). Sin Web Locks (jsdom, contexto no seguro) degrada al
 *  comportamiento anterior — que `reconcile` ya auto-cura. */
function withIndexLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = globalThis.navigator?.locks;
  if (locks?.request) return locks.request('concreta.obras.index', fn) as Promise<T>;
  return fn();
}

function updateIndex(mutate: (idx: ObraIndex) => ObraIndex | Promise<ObraIndex>): Promise<ObraIndex> {
  const run = indexChain.then(() =>
    withIndexLock(async () => {
      const idx = await loadIndex();
      const next = await mutate(idx);
      if (next !== idx) await saveIndex(next);
      return next;
    }),
  );
  indexChain = run.then(
    () => undefined,
    () => undefined, // un fallo no envenena la cadena (la siguiente op reintenta)
  );
  return run;
}

/** Read-modify-write del índice v5, con el MISMO Web Lock que usan las
 *  pestañas antiguas para él. Nunca anidado dentro de `updateIndex` (mismo lock). */
function updateV5Index(mutate: (idx: ObraIndex) => ObraIndex): Promise<void> {
  const run = indexChain.then(() =>
    withIndexLock(async () => {
      const raw = await get(V5_INDEX_KEY);
      if (!isIndex(raw)) return;
      const next = mutate(raw);
      if (next !== raw) await set(V5_INDEX_KEY, next);
    }),
  );
  indexChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Quita una obra del índice v5 (borrar una obra, limpiar su copia v5). */
function quitarDeV5Index(id: string): Promise<void> {
  return updateV5Index((idx) =>
    idx.obras.some((m) => m.id === id)
      ? {
          activeId: idx.activeId === id ? (idx.obras.find((m) => m.id !== id)?.id ?? null) : idx.activeId,
          obras: idx.obras.filter((m) => m.id !== id),
        }
      : idx,
  );
}

/* ---- reconciliación índice ↔ blobs (auto-cura) ---------------------------- */
/**
 * Alinea el índice con los blobs realmente presentes en IndexedDB:
 *   · quita del índice las obras cuyo blob ya no existe (entrada huérfana); una
 *     `porMigrar` se conserva mientras exista su clave v5;
 *   · añade los blobs presentes que no estaban en el índice (blob huérfano),
 *     leyendo SU sobre (solo los huérfanos, no todos);
 *   · añade al final, `porMigrar`, las obras del índice v5 que no están en el
 *     v6 (una pestaña antigua pudo crear una);
 *   · garantiza que `activeId` apunta a una obra real (o al primero, o null).
 * Persiste el índice solo si cambió. Lee claves (barato) y, como mucho, los
 * blobs huérfanos — no escanea todas las obras.
 */
export function reconcile(): Promise<ObraIndex> {
  return updateIndex(async (idx) => {
    const present = new Set((await obraKeys()).map((k) => k.slice(OBRA_KEY_PREFIX.length)));
    const present5 = new Set((await v5ObraKeys()).map((k) => k.slice(V5_OBRA_KEY_PREFIX.length)));
    // 1) entradas con blob presente, en su orden original (con el sobre v6 ya
    //    escrito, una `porMigrar` deja de serlo)
    const obras: ObraMeta[] = idx.obras
      .filter((m) => present.has(m.id) || (m.porMigrar && present5.has(m.id)))
      .map((m) => {
        if (!(m.porMigrar && present.has(m.id))) return m;
        const { porMigrar: _p, ...resto } = m;
        void _p;
        return resto;
      });
    // 2) blobs huérfanos (no en el índice) → leer su sobre y registrarlos
    const known = new Set(obras.map((m) => m.id));
    for (const id of present) {
      if (known.has(id)) continue;
      const res = await loadObraEnvelope(obraKey(id));
      if (res.kind === 'ok') {
        obras.push({
          id,
          name: nameOf(res.envelope.data),
          savedAt: res.envelope.savedAt,
          schemaVersion: res.envelope.schemaVersion,
        });
      }
      // huérfano corrupto: fuera del índice (no listable), pero el blob se conserva
      // para recuperación manual.
    }
    // 2b) obras v5 que el índice v6 aún no conoce → al final, por migrar
    const conocidas = new Set(obras.map((m) => m.id));
    for (const m of (await loadV5Index()).obras) {
      if (conocidas.has(m.id) || !present5.has(m.id)) continue;
      obras.push({ ...m, porMigrar: true });
      conocidas.add(m.id);
    }
    // 3) activeId válido, o el primero, o null
    const activeId =
      idx.activeId && obras.some((m) => m.id === idx.activeId)
        ? idx.activeId
        : (obras[0]?.id ?? null);
    const next: ObraIndex = { activeId, obras };
    // Sin cambios → devuelve el MISMO objeto para que updateIndex no reescriba.
    return JSON.stringify(next) === JSON.stringify(idx) ? idx : next;
  });
}

/* ---- migración one-shot del proyecto único legacy ------------------------- */
/**
 * Crea el índice v6 si aún no existe. IDEMPOTENTE: solo corre sin índice v6.
 *   · Con índice v5: el v6 nace de él (misma lista, orden, activa y meta), con
 *     cada obra `porMigrar` (se migra al abrirla, §1.1).
 *   · Si no, migra el proyecto único legacy (clave `OBRA_KEY`) al registro:
 *     tras migrar, el índice queda escrito y la clave legacy borrada → reboots
 *     posteriores no re-migran (Codex: dejar la legacy duplicaría obras en cada
 *     arranque). Si la legacy está corrupta, deja el blob (para recuperación
 *     manual) pero sella un índice vacío para no reintentar.
 */
export async function migrateLegacy(): Promise<void> {
  if (isIndex(await get(INDEX_KEY))) return; // ya hay registro → nada que migrar
  const v5 = await get(V5_INDEX_KEY);
  if (isIndex(v5)) {
    await saveIndex({ activeId: v5.activeId, obras: v5.obras.map((m) => ({ ...m, porMigrar: true as const })) });
    return;
  }
  const legacy = await loadObraEnvelope(OBRA_KEY);
  if (legacy.kind === 'ok') {
    const id = newObraId();
    // copia el sobre TAL CUAL (preserva savedAt/appVersion) bajo la clave por id;
    // la migración de schemaVersion la hace `fromSerializable` al cargar (sync).
    await set(obraKey(id), legacy.envelope);
    await saveIndex({
      activeId: id,
      obras: [
        {
          id,
          name: nameOf(legacy.envelope.data),
          savedAt: legacy.envelope.savedAt,
          schemaVersion: legacy.envelope.schemaVersion,
        },
      ],
    });
    await del(OBRA_KEY); // ya copiada; el índice presente impide re-migrar
  } else if (legacy.kind === 'corrupt') {
    await saveIndex({ ...EMPTY_INDEX }); // no reintentar; conservar el blob legacy
    // A-03: conservar el blob no basta — hay que ANUNCIARLO. Sin esto la app
    // arrancaba con la demo como si nada y el usuario percibía pérdida total
    // (el banner ya soportaba la clave legacy vía `recoveryKey ?? OBRA_KEY`,
    // pero nadie lo disparaba: era código muerto).
    usePersistStore.getState().setRecovery(legacy.raw, OBRA_KEY);
  }
  // 'empty' (instalación nueva): NO escribir índice → la demo en memoria no se
  // fosiliza hasta la 1ª edición (que crea el registro vía `saveActiveObra`).
}

/* ---- CRUD de obras -------------------------------------------------------- */
export async function listObras(): Promise<ObraMeta[]> {
  return (await reconcile()).obras;
}

export async function getActiveId(): Promise<string | null> {
  return (await loadIndex()).activeId;
}

export function setActiveId(id: string | null): Promise<ObraIndex> {
  return updateIndex((idx) => ({ ...idx, activeId: id }));
}

/** Crea una obra: persiste su blob INMEDIATAMENTE (Codex: no esperar a la 1ª
 *  edición) y la registra. NO la marca activa (eso lo decide el llamador).
 *  `kind` marca las obras de solo-referencia (importadas para copiar). */
export async function createObra(data: ObraData, kind?: ObraKind): Promise<string> {
  const id = newObraId();
  await saveObra(obraKey(id), data);
  await updateIndex((idx) => ({
    activeId: idx.activeId,
    obras: [...idx.obras.filter((m) => m.id !== id), metaOf(id, data, kind)],
  }));
  return id;
}

/** Resultado de guardar la obra activa: el índice escrito, o el rechazo terminal
 *  porque en disco hay una versión más nueva (entonces el índice no se toca). */
export type SaveActiveResult =
  | { kind: 'ok'; index: ObraIndex }
  | { kind: 'version-conflict' };

/** Guarda la obra ACTIVA (blob + meta en el índice). Lo usa el autosave. Si la
 *  obra aún no estaba registrada (1ª edición de la demo), la registra y la marca
 *  activa. FUSIONA la meta EN SITIO: no altera el orden de las pestañas ni pierde
 *  lo que no sale del blob (`kind`, `ultimaCopia`, campos de versiones futuras).
 *
 *  Con `migracion` (la obra se leyó de su clave v5), este guardado ES la
 *  migración: escribe el sobre v6, apunta `migracionV5` en la meta y sella
 *  `concreta.version.<id> = 6`. Una obra `porMigrar` guardada sin esos datos
 *  también se sella: su sobre v6 ya existe. */
export async function saveActiveObra(
  id: string,
  data: ObraData,
  migracion?: { savedAt: string; indiceSavedAt: string },
): Promise<SaveActiveResult> {
  if ((await saveObra(obraKey(id), data)) === 'version-conflict') return { kind: 'version-conflict' };
  let sellarV5 = !!migracion;
  const index = await updateIndex((idx) => {
    const prev = idx.obras.find((m) => m.id === id);
    if (prev?.porMigrar) sellarV5 = true;
    const meta = metaOf(id, data, undefined, prev);
    delete meta.porMigrar;
    if (migracion) meta.migracionV5 = { ...migracion, at: new Date().toISOString() };
    const obras = prev
      ? idx.obras.map((m) => (m.id === id ? meta : m))
      : [...idx.obras, meta];
    return { activeId: id, obras };
  });
  if (sellarV5) await set(v5VersionKey(id), SCHEMA_VERSION);
  return { kind: 'ok', index };
}

/** Sella (`at`, ISO) o borra (`null`) la fecha de la última copia descargada de
 *  la obra `id`. Sin entrada en el índice no hace nada: la obra aún no existe en
 *  disco (la demo antes de su primera edición). */
export function setUltimaCopia(id: string, at: string | null): Promise<ObraIndex> {
  return updateIndex((idx) => {
    const prev = idx.obras.find((m) => m.id === id);
    if (!prev || (prev.ultimaCopia ?? null) === at) return idx;
    const meta: ObraMeta = { ...prev };
    if (at) meta.ultimaCopia = at;
    else delete meta.ultimaCopia;
    return { ...idx, obras: idx.obras.map((m) => (m.id === id ? meta : m)) };
  });
}

/** Borra una obra: blob + entrada del índice. Si era la activa, salta a la
 *  primera restante (o null). NO aplica la política "no borrar la última" — eso
 *  es del store (crea una semilla nueva). Borra también sus claves v5 y su
 *  entrada del índice v5: si no, `reconcile` la volvería a traer «por migrar». */
export async function deleteObra(id: string): Promise<ObraIndex> {
  await clearObra(obraKey(id));
  await clearObra(v5ObraKey(id));
  await quitarDeV5Index(id);
  return updateIndex((idx) => {
    const obras = idx.obras.filter((m) => m.id !== id);
    const activeId = idx.activeId === id ? (obras[0]?.id ?? null) : idx.activeId;
    return { activeId, obras };
  });
}

/** Construye la meta de índice de una obra. Exportada para que la orquestación
 *  (importar como referencia) refresque `sessionStore` con la MISMA forma de meta
 *  sin re-leer el índice. `kind` ausente = obra de trabajo (compat). Con `prev`
 *  FUSIONA: conserva sus campos y solo renueva los que salen del blob. */
export function metaOf(id: string, data: ObraData, kind?: ObraKind, prev?: ObraMeta): ObraMeta {
  return {
    ...prev,
    id,
    name: nameOf(data),
    savedAt: new Date().toISOString(),
    schemaVersion: data.schemaVersion,
    ...(kind ? { kind } : {}),
  };
}

/* ---- la copia v5 de una obra migrada ---------------------------------------- */

const savedAtDe = (raw: unknown): string | null =>
  isRecord(raw) && typeof raw.savedAt === 'string' ? raw.savedAt : null;

/**
 * ¿Una versión antigua de Concreta guardó cambios en la obra `id` DESPUÉS de
 * migrarla? Compara el `savedAt` de su meta en el índice v5 (lectura barata,
 * sin el sobre) con el que se apuntó al migrar. Una obra migrada sin cambios
 * no avisa: los dos son el mismo `savedAt` del índice.
 */
export async function hayCambiosAntiguos(meta: ObraMeta): Promise<boolean> {
  const m = meta.migracionV5;
  if (!m) return false;
  const meta5 = (await loadV5Index()).obras.find((x) => x.id === meta.id);
  return !!meta5 && Date.parse(meta5.savedAt) > Date.parse(m.indiceSavedAt);
}

/** Vuelve a sellar `migracionV5` con el estado v5 de AHORA: el aviso no se
 *  repite por los mismos cambios y la limpieza cuenta 30 días desde aquí. */
export async function resellarMigracion(id: string): Promise<ObraIndex> {
  const savedAt = savedAtDe(await loadRaw(v5ObraKey(id)));
  const meta5 = (await loadV5Index()).obras.find((x) => x.id === id);
  const at = new Date().toISOString();
  return updateIndex((idx) => {
    const prev = idx.obras.find((m) => m.id === id);
    if (!prev?.migracionV5) return idx;
    const migracionV5: MigracionV5 = {
      savedAt: savedAt ?? prev.migracionV5.savedAt,
      indiceSavedAt: meta5?.savedAt ?? prev.migracionV5.indiceSavedAt,
      at,
    };
    return { ...idx, obras: idx.obras.map((m) => (m.id === id ? { ...m, migracionV5 } : m)) };
  });
}

/**
 * «Abrir esos cambios como obra aparte»: crea una obra v6 NUEVA desde la clave
 * v5 de `id`, migrada, con el nombre «<nombre> (cambios de la versión
 * antigua)», y vuelve a sellar la migración de la original. `null` si la copia
 * v5 ya no se puede leer.
 */
export async function abrirCambiosAntiguos(
  id: string,
  nombre: string,
): Promise<{ id: string; meta: ObraMeta; index: ObraIndex } | null> {
  const res = await loadObraEnvelope(v5ObraKey(id));
  if (res.kind !== 'ok') return null;
  let data: ObraData;
  try {
    data = fromSerializable(res.envelope.data);
  } catch {
    return null;
  }
  data = { ...data, obra: { ...data.obra, denominacion: `${nombre} (cambios de la versión antigua)` } };
  const nuevo = await createObra(data);
  const index = await resellarMigracion(id);
  const meta = index.obras.find((m) => m.id === nuevo) ?? metaOf(nuevo, data);
  return { id: nuevo, meta, index };
}

/**
 * Limpieza de las copias v5, en reposo al arrancar: 30 días después de
 * `migracionV5.at`, si la meta v5 sigue con `indiceSavedAt` y el sobre v5,
 * leído entonces, sigue con `savedAt`, borra la clave v5 de la obra, su clave de
 * versión y su entrada del índice v5. Si una pestaña antigua la tocó, no borra
 * nada (el aviso de cambios antiguos lo dirá). Devuelve los ids limpiados.
 */
export async function limpiarCopiasV5(ahora = Date.now()): Promise<string[]> {
  const idx = await loadIndex();
  const v5 = await loadV5Index();
  const hechos: string[] = [];
  for (const meta of idx.obras) {
    const m = meta.migracionV5;
    if (!m || ahora - Date.parse(m.at) < DIAS_COPIA_V5 * 86_400_000) continue;
    const meta5 = v5.obras.find((x) => x.id === meta.id);
    if (!meta5 || meta5.savedAt !== m.indiceSavedAt) continue;
    if (savedAtDe(await loadRaw(v5ObraKey(meta.id))) !== m.savedAt) continue;
    await clearObra(v5ObraKey(meta.id));
    await quitarDeV5Index(meta.id);
    hechos.push(meta.id);
  }
  return hechos;
}

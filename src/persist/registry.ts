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
   =========================================================================== */
import { del, get, set } from 'idb-keyval';
import type { ObraData } from '../store';
import {
  OBRA_KEY,
  OBRA_KEY_PREFIX,
  clearObra,
  loadObraEnvelope,
  obraKey,
  obraKeys,
  saveObra,
} from './persist';

/** Clave del índice de obras (metadatos + obra activa). */
export const INDEX_KEY = 'concreta.obras.index.v1';

/** Metadatos de una obra para listar/pintar pestañas SIN leer su blob entero. */
export interface ObraMeta {
  id: string;
  name: string;
  savedAt: string; // ISO 8601
  schemaVersion: number;
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
    typeof x.schemaVersion === 'number'
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
  const c = globalThis.crypto;
  return c?.randomUUID
    ? c.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

const nameOf = (data: ObraData): string => data.obra.denominacion || 'Obra sin nombre';

/* ---- índice: lectura/escritura -------------------------------------------- */
export async function loadIndex(): Promise<ObraIndex> {
  const raw = await get(INDEX_KEY);
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
function updateIndex(mutate: (idx: ObraIndex) => ObraIndex | Promise<ObraIndex>): Promise<ObraIndex> {
  const run = indexChain.then(async () => {
    const idx = await loadIndex();
    const next = await mutate(idx);
    if (next !== idx) await saveIndex(next);
    return next;
  });
  indexChain = run.then(
    () => undefined,
    () => undefined, // un fallo no envenena la cadena (la siguiente op reintenta)
  );
  return run;
}

/* ---- reconciliación índice ↔ blobs (auto-cura) ---------------------------- */
/**
 * Alinea el índice con los blobs realmente presentes en IndexedDB:
 *   · quita del índice las obras cuyo blob ya no existe (entrada huérfana);
 *   · añade los blobs presentes que no estaban en el índice (blob huérfano),
 *     leyendo SU sobre (solo los huérfanos, no todos);
 *   · garantiza que `activeId` apunta a una obra real (o al primero, o null).
 * Persiste el índice solo si cambió. Lee claves (barato) y, como mucho, los
 * blobs huérfanos — no escanea todas las obras.
 */
export function reconcile(): Promise<ObraIndex> {
  return updateIndex(async (idx) => {
    const present = new Set((await obraKeys()).map((k) => k.slice(OBRA_KEY_PREFIX.length)));
    // 1) entradas con blob presente, en su orden original
    const obras: ObraMeta[] = idx.obras.filter((m) => present.has(m.id));
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
 * Migra el proyecto único legacy (clave `OBRA_KEY`) al registro. IDEMPOTENTE:
 * solo corre si el índice AÚN no existe; tras migrar, el índice queda escrito y
 * la clave legacy borrada → reboots posteriores no re-migran (Codex: dejar la
 * legacy duplicaría obras en cada arranque). Si la legacy está corrupta, deja el
 * blob (para recuperación manual) pero sella un índice vacío para no reintentar.
 */
export async function migrateLegacy(): Promise<void> {
  if (isIndex(await get(INDEX_KEY))) return; // ya hay registro → nada que migrar
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

export async function setActiveId(id: string | null): Promise<void> {
  await updateIndex((idx) => ({ ...idx, activeId: id }));
}

/** Crea una obra: persiste su blob INMEDIATAMENTE (Codex: no esperar a la 1ª
 *  edición) y la registra. NO la marca activa (eso lo decide el llamador). */
export async function createObra(data: ObraData): Promise<string> {
  const id = newObraId();
  await saveObra(obraKey(id), data);
  await updateIndex((idx) => ({
    activeId: idx.activeId,
    obras: [...idx.obras.filter((m) => m.id !== id), metaOf(id, data)],
  }));
  return id;
}

/** Guarda la obra ACTIVA (blob + meta en el índice). Lo usa el autosave. Si la
 *  obra aún no estaba registrada (1ª edición de la demo), la registra y la marca
 *  activa. Actualiza la meta EN SITIO para no alterar el orden de las pestañas. */
export async function saveActiveObra(id: string, data: ObraData): Promise<void> {
  await saveObra(obraKey(id), data);
  await updateIndex((idx) => {
    const meta = metaOf(id, data);
    const obras = idx.obras.some((m) => m.id === id)
      ? idx.obras.map((m) => (m.id === id ? meta : m))
      : [...idx.obras, meta];
    return { activeId: id, obras };
  });
}

/** Borra una obra: blob + entrada del índice. Si era la activa, salta a la
 *  primera restante (o null). NO aplica la política "no borrar la última" — eso
 *  es del store (crea una semilla nueva). */
export async function deleteObra(id: string): Promise<void> {
  await clearObra(obraKey(id));
  await updateIndex((idx) => {
    const obras = idx.obras.filter((m) => m.id !== id);
    const activeId = idx.activeId === id ? (obras[0]?.id ?? null) : idx.activeId;
    return { activeId, obras };
  });
}

function metaOf(id: string, data: ObraData): ObraMeta {
  return {
    id,
    name: nameOf(data),
    savedAt: new Date().toISOString(),
    schemaVersion: data.schemaVersion,
  };
}

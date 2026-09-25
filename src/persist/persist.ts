/* ===========================================================================
   persist — capa de persistencia local (F6.1 → multi-obra T-10). Guarda blobs
   `ObraData` en IndexedDB vía `idb-keyval`, UNO POR OBRA bajo la clave
   `concreta.obra.<id>`. Lo envuelve en un ENVELOPE con metadatos
   (`savedAt`/`appVersion`) para diagnóstico y migración futura.

   Garantías:
   · Escrituras SERIALIZADAS por una cola de UN SOLO CARRIL → un autosave lento
     nunca aterriza después de uno más nuevo (eng-review Codex #2).
   · Coalescing POR CLAVE: si llegan varias para la MISMA obra mientras una está
     en vuelo, solo se escribe la última; obras distintas NO se pisan entre sí
     (eng-review multi-obra D5 / Codex: la clave se captura con el dato al
     encolar). Invariante de la arquitectura "conmuta": solo la obra ACTIVA se
     autoguarda, y `switchObra` espera al `flush` antes de cargar otra, así que
     en la práctica nunca hay dos claves de obra en vuelo a la vez.
   · `flush()` espera a que la cola se vacíe (para import/reset/cerrar pestaña).
   · Validación ESTRUCTURAL antes de aceptar un blob cargado (Codex #11): un JSON
     de versión correcta pero malformado NO debe brickear los selectores.
   · Versión MÁS NUEVA (Etapa 0 del plan de planos): un sobre guardado por una
     Concreta posterior se reconoce ANTES de validar su forma (`newer`, nunca
     `corrupt`) y `saveObra` no lo pisa (`version-conflict`). Así una pestaña con
     la app antigua pasa a solo lectura en vez de borrar o reinterpretar la obra.
   =========================================================================== */
import { createStore, delMany, get, keys as idbKeys, promisifyRequest } from 'idb-keyval';
import type { ObraData } from '../store';
import { SCHEMA_VERSION } from '../store/schema';

/** Clave LEGACY del proyecto único (pre multi-obra). La migración (registry) la
 *  mueve a `concreta.obra.<id>` y la borra. Exportada para esa ruta y para tests. */
export const OBRA_KEY = 'concreta.obra.v1';
/** Prefijo de las claves de obra por id (multi-obra, T-10). */
export const OBRA_KEY_PREFIX = 'concreta.obra.';
/** Clave del blob de una obra por id. */
export const obraKey = (id: string): string => `${OBRA_KEY_PREFIX}${id}`;
/** Clave PEQUEÑA con el `schemaVersion` del último sobre escrito en `key`: el
 *  guardado compara contra ella sin leer el sobre entero. Fuera del prefijo de
 *  obra para que `obraKeys` no la liste como una obra. */
export const versionKey = (key: string): string =>
  `concreta.version.${key.startsWith(OBRA_KEY_PREFIX) ? key.slice(OBRA_KEY_PREFIX.length) : key}`;
/** Versión de la app estampada en los sobres (diagnóstico). FUENTE ÚNICA:
 *  `transfer` la importa de aquí (antes había dos literales que podían divergir). */
export const APP_VERSION = '0.6';

/** Sobre persistido: el dominio + metadatos para diagnóstico/migración. */
export interface ObraEnvelope {
  schemaVersion: number;
  savedAt: string; // ISO 8601, sellado al guardar
  appVersion: string;
  data: ObraData;
}

/* ---- validación estructural (gate antes de reemplazar el store) ----------- */
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/** ¿Es `x` un `ObraData` estructuralmente sano? (no valida cada número, sí la
 *  forma: arrays/maps presentes, rates finitos, obra con denominación). */
export function isObraData(x: unknown): x is ObraData {
  if (!isRecord(x)) return false;
  const o = x;
  if (typeof o.schemaVersion !== 'number') return false;
  if (!Array.isArray(o.chapters)) return false;
  if (!isRecord(o.partidas) || !isRecord(o.recursos)) return false;
  if (!Array.isArray(o.certs)) return false;
  const r = o.rates;
  if (
    !isRecord(r) ||
    !Number.isFinite(r.iva) ||
    !Number.isFinite(r.gg) ||
    !Number.isFinite(r.bi) ||
    !Number.isFinite(r.coefK)
  )
    return false;
  if (!isRecord(o.obra) || typeof o.obra.denominacion !== 'string') return false;
  // partidas: cada valor es un array (las partidas por capítulo)
  for (const v of Object.values(o.partidas)) if (!Array.isArray(v)) return false;
  // `bajas` (tombstones, v3) es opcional AQUÍ: un blob v2 no lo trae y la
  // migración lo estrena; si viene, que al menos sea un mapa.
  if (o.bajas != null && !isRecord(o.bajas)) return false;
  // Un nivel MÁS de forma (auditoría A-02): `certs: [null]`, `chapters: [null]`
  // o un recurso nulo pasaban el gate, hidrataban SIN banner de recuperación y
  // el primer selector reventaba en render — con el blob recargándose «sano» en
  // cada arranque (bucle de brick). Elementos, no cada campo: sigue siendo un
  // gate estructural barato, no un validador de esquema.
  for (const c of o.chapters as unknown[]) {
    if (!isRecord(c) || typeof c.id !== 'string' || typeof c.title !== 'string') return false;
  }
  for (const c of o.certs as unknown[]) {
    if (!isRecord(c) || !isRecord(c.data)) return false;
  }
  for (const r of Object.values(o.recursos as Record<string, unknown>)) {
    if (!isRecord(r)) return false;
  }
  for (const v of Object.values(o.partidas as Record<string, unknown[]>)) {
    for (const p of v) if (!isRecord(p) || typeof p.id !== 'string') return false;
  }
  return true;
}

function isEnvelope(x: unknown): x is ObraEnvelope {
  return isRecord(x) && typeof x.schemaVersion === 'number' && isObraData(x.data);
}

/** Versión de esquema que declara un blob guardado (el sobre o su `data`, la
 *  mayor), sin mirar nada más de su forma. `null` si no declara ninguna. */
function declaredVersion(raw: unknown): number | null {
  if (!isRecord(raw)) return null;
  const vs = [raw.schemaVersion, isRecord(raw.data) ? raw.data.schemaVersion : undefined].filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );
  return vs.length ? Math.max(...vs) : null;
}

/** Si `raw` lo guardó una Concreta MÁS NUEVA que esta, su versión; si no, `null`.
 *  Se mira ANTES que la forma: una v7 con otra estructura no es «dañada». */
export function newerVersionOf(raw: unknown): number | null {
  const v = declaredVersion(raw);
  return v !== null && v > SCHEMA_VERSION ? v : null;
}

/* ---- lectura -------------------------------------------------------------- */
/** Lee el sobre crudo (sin validar) de una clave. Para recuperación/exportar copia. */
export async function loadRaw(key: string): Promise<unknown> {
  return get(key);
}

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'ok'; envelope: ObraEnvelope }
  | { kind: 'corrupt'; raw: unknown }
  /** Lo guardó una versión más nueva de Concreta: ni se carga ni se descarta. */
  | { kind: 'newer'; raw: unknown; version: number };

/** Carga y valida el sobre de una clave. `corrupt` = había algo pero no es sano;
 *  `newer` = es de una versión posterior (se mira primero). */
export async function loadObraEnvelope(key: string): Promise<LoadResult> {
  const raw = await get(key);
  if (raw === undefined) return { kind: 'empty' };
  const version = newerVersionOf(raw);
  if (version !== null) return { kind: 'newer', raw, version };
  if (isEnvelope(raw)) return { kind: 'ok', envelope: raw };
  return { kind: 'corrupt', raw };
}

/** Lista las claves de blobs de obra por id (baratо: solo claves, sin leer
 *  valores). Excluye la clave LEGACY. Lo usa `registry.reconcile`. */
export async function obraKeys(): Promise<string[]> {
  const ks = await idbKeys();
  return ks.filter(
    (k): k is string =>
      typeof k === 'string' && k.startsWith(OBRA_KEY_PREFIX) && k !== OBRA_KEY,
  );
}

/* ---- escritura: cola de un carril + coalescing POR CLAVE ------------------ */
/** El almacén por defecto de idb-keyval (misma base y mismo almacén), abierto a
 *  mano para comparar y escribir en UNA transacción: su `update` siempre hace `put`. */
const kvStore = createStore('keyval-store', 'keyval');

/** Resultado de un guardado. `version-conflict` es TERMINAL: en disco hay un
 *  sobre de una versión mayor que la que se escribe y no se ha tocado. */
export type SaveResult = 'ok' | 'version-conflict';

/** Escribe `env` en `key` salvo que el sobre en disco sea de una versión MAYOR.
 *  Compara contra la clave pequeña de versión; si falta (sobre anterior a esta
 *  comprobación), mira la del sobre una sola vez. Todo en una transacción. */
function writeUnlessNewer(key: string, env: ObraEnvelope): Promise<SaveResult> {
  const vKey = versionKey(key);
  return kvStore('readwrite', (store) => {
    let result: SaveResult = 'ok';
    const write = (onDisk: number | null) => {
      if (onDisk !== null && onDisk > env.schemaVersion) {
        result = 'version-conflict';
        return;
      }
      store.put(env, key);
      store.put(env.schemaVersion, vKey);
    };
    const vReq = store.get(vKey);
    vReq.onsuccess = () => {
      const v: unknown = vReq.result;
      if (typeof v === 'number') return write(v);
      const eReq = store.get(key);
      eReq.onsuccess = () => write(declaredVersion(eReq.result));
    };
    return promisifyRequest(store.transaction).then(() => result);
  });
}

let chain: Promise<void> = Promise.resolve();
/** Pendientes por clave: la clave se captura CON el dato (Codex). Map → obras
 *  distintas no se pisan; misma clave coalesce a su última versión. */
const pending = new Map<string, ObraData>();
/** Último resultado escrito por clave: lo lee cada llamador al acabar su turno
 *  (su dato pudo drenarlo el turno de otro llamador). */
const lastResult = new Map<string, SaveResult>();

/** Encola un guardado del dominio bajo `key`. Resuelve con el resultado de la
 *  escritura de esa clave; rechaza si IndexedDB falla (cuota, abort). */
export function saveObra(key: string, data: ObraData): Promise<SaveResult> {
  pending.set(key, data); // coalesce por clave: solo la última de cada obra
  const run = chain.then(async () => {
    // Drena TODO lo pendiente en este carril (orden de inserción del Map).
    while (pending.size) {
      const [k, d] = pending.entries().next().value as [string, ObraData];
      const env: ObraEnvelope = {
        schemaVersion: d.schemaVersion,
        savedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        data: d,
      };
      lastResult.set(k, await writeUnlessNewer(k, env));
      // Borra SOLO tras escribir OK: si la escritura rechaza (cuota/abort) la
      // entrada SIGUE en `pending` y el próximo drain la reintenta (no se pierde
      // el dato). Un `version-conflict` también sale: reintentarlo bloquearía
      // para siempre la cola de las demás obras. Si un save más nuevo de la misma
      // obra llega entre medias, coalesce (gana el último, mismo key en el Map).
      if (pending.get(k) === d) pending.delete(k);
    }
  });
  // La cadena base NO se envenena si una escritura falla: queda resuelta para que
  // la siguiente corra y reintente lo pendiente. El llamador SÍ recibe el
  // rechazo (autosave → estado 'error').
  chain = run.catch(() => undefined);
  return run.then(() => lastResult.get(key) ?? 'ok');
}

/** Espera a que se vacíe la cola de escritura (import/reset/cerrar pestaña). */
export function flush(): Promise<void> {
  return chain;
}

/** Borra el blob de una obra (descartar datos corruptos / borrar obra). Cancela
 *  primero su pendiente para que un autosave en cola no la resucite (Codex). */
export async function clearObra(key: string): Promise<void> {
  pending.delete(key);
  await delMany([key, versionKey(key)]);
}

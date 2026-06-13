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
   =========================================================================== */
import { del, get, keys as idbKeys, set } from 'idb-keyval';
import type { ObraData } from '../store';

/** Clave LEGACY del proyecto único (pre multi-obra). La migración (registry) la
 *  mueve a `concreta.obra.<id>` y la borra. Exportada para esa ruta y para tests. */
export const OBRA_KEY = 'concreta.obra.v1';
/** Prefijo de las claves de obra por id (multi-obra, T-10). */
export const OBRA_KEY_PREFIX = 'concreta.obra.';
/** Clave del blob de una obra por id. */
export const obraKey = (id: string): string => `${OBRA_KEY_PREFIX}${id}`;
const APP_VERSION = '0.6';

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
  return true;
}

function isEnvelope(x: unknown): x is ObraEnvelope {
  return isRecord(x) && typeof x.schemaVersion === 'number' && isObraData(x.data);
}

/* ---- lectura -------------------------------------------------------------- */
/** Lee el sobre crudo (sin validar) de una clave. Para recuperación/exportar copia. */
export async function loadRaw(key: string): Promise<unknown> {
  return get(key);
}

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'ok'; envelope: ObraEnvelope }
  | { kind: 'corrupt'; raw: unknown };

/** Carga y valida el sobre de una clave. `corrupt` = había algo pero no es sano. */
export async function loadObraEnvelope(key: string): Promise<LoadResult> {
  const raw = await get(key);
  if (raw === undefined) return { kind: 'empty' };
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
let chain: Promise<void> = Promise.resolve();
/** Pendientes por clave: la clave se captura CON el dato (Codex). Map → obras
 *  distintas no se pisan; misma clave coalesce a su última versión. */
const pending = new Map<string, ObraData>();

/** Encola un guardado del dominio bajo `key`. Devuelve la promesa de la cola. */
export function saveObra(key: string, data: ObraData): Promise<void> {
  pending.set(key, data); // coalesce por clave: solo la última de cada obra
  chain = chain.then(async () => {
    // Drena TODO lo pendiente en este carril (orden de inserción del Map).
    while (pending.size) {
      const next = pending.entries().next().value as [string, ObraData];
      const [k, d] = next;
      pending.delete(k);
      const env: ObraEnvelope = {
        schemaVersion: d.schemaVersion,
        savedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        data: d,
      };
      await set(k, env);
    }
  });
  return chain;
}

/** Espera a que se vacíe la cola de escritura (import/reset/cerrar pestaña). */
export function flush(): Promise<void> {
  return chain;
}

/** Borra el blob de una obra (descartar datos corruptos / borrar obra). Cancela
 *  primero su pendiente para que un autosave en cola no la resucite (Codex). */
export async function clearObra(key: string): Promise<void> {
  pending.delete(key);
  await del(key);
}

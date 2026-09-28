/* ===========================================================================
   persist/planos — almacén de los PDF de los planos (medir sobre planos, §1.5).
   Base de IndexedDB PROPIA, `concreta-planos` (versión 1), con dos almacenes y
   la huella (sha256) como clave:

     meta  ─ { tamano, tipo, tocadoEn, sinReferenciaDesde? [A1], restauracion? [A1] }
     bytes ─ ArrayBuffer, escrito UNA sola vez

   idb-keyval no sirve aquí: su `update` reescribe el valor entero y solo admite
   un almacén por base. Se guardan bytes, no un Blob: jsdom no implementa
   `Blob.arrayBuffer()`.

   Los PDF NO van en la obra: la obra guarda la huella (`PlanoMeta.huella`) y el
   coordinador de adjuntar (features/planos) publica el metadato SOLO después de
   que los bytes estén aquí. Nunca queda un metadato que apunte a bytes sin
   guardar. A0 no borra ningún PDF (ni marcas ni «Liberar espacio»).

   [A1] Restaurar una copia .zip (§9.2) escribe los PDF anotados con el token
   de ESA restauración; si la obra no llega a guardarse, se retiran solo los
   que siguen siendo suyos. Adjuntar o restaurar la misma huella después la
   ADOPTA (quita el token) y ya no se retira.
   =========================================================================== */

const DB = 'concreta-planos';
const VERSION = 1;
const META = 'meta';
const BYTES = 'bytes';

export interface PlanoAlmacenMeta {
  tamano: number;
  tipo: string;
  /** ISO: la última vez que se adjuntó, reenlazó o restauró. */
  tocadoEn: string;
  /** [A1] marca de «sin referencia» para «Liberar espacio». */
  sinReferenciaDesde?: string;
  /** [A1] token de la restauración que lo escribió. */
  restauracion?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'));
      return;
    }
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      if (!db.objectStoreNames.contains(BYTES)) db.createObjectStore(BYTES);
    };
    req.onsuccess = () => {
      const db = req.result;
      // Otra pestaña con una versión más nueva de la base: soltarla para no bloquearla.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir el almacén de planos'));
    req.onblocked = () => reject(new Error('El almacén de planos está bloqueado por otra pestaña'));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

const pedir = <T,>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const fin = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Transacción fallida'));
    tx.onabort = () => reject(tx.error ?? new DOMException('Transacción abortada', 'AbortError'));
  });

/** ¿Es un error de cuota llena? (IndexedDB lo da como `QuotaExceededError`). */
export function esCuotaLlena(e: unknown): boolean {
  const n = (e as { name?: string } | null)?.name;
  return n === 'QuotaExceededError' || n === 'NS_ERROR_DOM_QUOTA_REACHED';
}

/**
 * Guarda los bytes de un plano bajo su huella, en UNA transacción sobre los dos
 * almacenes: escribe los bytes solo si faltan y actualiza siempre `meta`
 * (sella `tocadoEn` y [A1] quita la marca de sin referencia y el token de
 * restauración: la huella queda adoptada). Idempotente por huella: reintentar
 * no duplica nada ni reescribe los bytes.
 */
export async function guardarPlano(huella: string, bytes: ArrayBuffer, tipo: string): Promise<void> {
  await escribir(huella, bytes, tipo, null);
}

/**
 * [A1] Como `guardarPlano`, para restaurar una copia: si los bytes FALTABAN,
 * los escribe anotados con `token` y dice `nuevo: true` (se podrán retirar si
 * la restauración no termina). Si ya estaban, los adopta como `guardarPlano`.
 */
export async function restaurarPlano(
  huella: string,
  bytes: ArrayBuffer,
  tipo: string,
  token: string,
): Promise<{ nuevo: boolean }> {
  return { nuevo: await escribir(huella, bytes, tipo, token) };
}

/** Escribe (si faltan) y sella `meta`. Devuelve si los bytes eran nuevos. */
async function escribir(huella: string, bytes: ArrayBuffer, tipo: string, token: string | null): Promise<boolean> {
  const db = await abrir();
  const tx = db.transaction([META, BYTES], 'readwrite');
  const hecho = fin(tx);
  const sBytes = tx.objectStore(BYTES);
  const sMeta = tx.objectStore(META);
  // Un `put` puede lanzar (cuota) dentro del callback: se guarda el error real y
  // se aborta la transacción entera (ni bytes ni meta a medias).
  let fallo: unknown = null;
  const intentar = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      fallo ??= e;
      try {
        tx.abort();
      } catch {
        // ya abortada
      }
    }
  };
  let nuevo = false;
  const cuenta = sBytes.count(huella);
  cuenta.onsuccess = () => {
    nuevo = cuenta.result === 0;
    if (nuevo) intentar(() => sBytes.put(bytes, huella));
    if (fallo) return; // transacción ya abortada
    // `meta` DESPUÉS de saber si los bytes eran nuevos (mismo orden de peticiones).
    const prev = sMeta.get(huella);
    prev.onsuccess = () => {
      const p = (prev.result ?? {}) as Partial<PlanoAlmacenMeta>;
      const meta: PlanoAlmacenMeta = { ...p, tamano: bytes.byteLength, tipo, tocadoEn: new Date().toISOString() };
      delete meta.sinReferenciaDesde;
      delete meta.restauracion;
      if (nuevo && token) meta.restauracion = token;
      intentar(() => sMeta.put(meta, huella));
    };
  };
  try {
    await hecho;
  } catch (e) {
    throw fallo ?? e;
  }
  return nuevo;
}

/**
 * [A1] Retira un PDF escrito por la restauración `token` que no terminó: en
 * UNA transacción, relee `meta` y borra bytes y meta SOLO si siguen siendo de
 * esa restauración (nadie los adoptó entretanto). Devuelve si lo retiró.
 */
export async function retirarRestaurado(huella: string, token: string): Promise<boolean> {
  const db = await abrir();
  const tx = db.transaction([META, BYTES], 'readwrite');
  const hecho = fin(tx);
  let retirado = false;
  const m = tx.objectStore(META).get(huella);
  m.onsuccess = () => {
    if ((m.result as PlanoAlmacenMeta | undefined)?.restauracion !== token) return;
    tx.objectStore(META).delete(huella);
    tx.objectStore(BYTES).delete(huella);
    retirado = true;
  };
  await hecho;
  return retirado;
}

/** Planos que viven solo en memoria (el ejemplo del sandbox): nunca se escriben
 *  en el almacén, así el ejemplo no deja un PDF huérfano. */
const enMemoria = new Map<string, ArrayBuffer>();

export function registrarBytesEnMemoria(huella: string, bytes: ArrayBuffer): void {
  enMemoria.set(huella, bytes);
}

/** Bytes de un plano, o `undefined` si no están en este navegador. Se releen
 *  en cada apertura (pdf.js se queda con el buffer que se le da): cada lectura
 *  es una copia nueva. */
export async function leerBytes(huella: string): Promise<ArrayBuffer | undefined> {
  const mem = enMemoria.get(huella);
  if (mem) return mem.slice(0);
  const db = await abrir();
  const tx = db.transaction(BYTES, 'readonly');
  const v = await pedir(tx.objectStore(BYTES).get(huella));
  return v instanceof ArrayBuffer ? v : v ? (v as ArrayBuffer) : undefined;
}

/** ¿Están los bytes de esta huella en este navegador? */
export async function tienePlano(huella: string): Promise<boolean> {
  if (enMemoria.has(huella)) return true;
  const db = await abrir();
  const tx = db.transaction(BYTES, 'readonly');
  return (await pedir(tx.objectStore(BYTES).count(huella))) > 0;
}

export async function leerMetaPlano(huella: string): Promise<PlanoAlmacenMeta | undefined> {
  const db = await abrir();
  const tx = db.transaction(META, 'readonly');
  return (await pedir(tx.objectStore(META).get(huella))) as PlanoAlmacenMeta | undefined;
}

/** Espacio usado y disponible del navegador, si `navigator.storage.estimate()`
 *  existe. Si no existe o falla, `null`: no se enseña el espacio. */
export async function espacioNavegador(): Promise<{ usado: number; cuota: number } | null> {
  try {
    const est = await globalThis.navigator?.storage?.estimate?.();
    if (!est || typeof est.usage !== 'number' || typeof est.quota !== 'number') return null;
    return { usado: est.usage, cuota: est.quota };
  } catch {
    return null;
  }
}

/** Test: cierra y olvida la base (fake-indexeddb se vacía entre tests). */
export async function __resetPlanosForTests(): Promise<void> {
  enMemoria.clear();
  if (dbPromise) {
    try {
      (await dbPromise).close();
    } catch {
      // nunca llegó a abrir
    }
  }
  dbPromise = null;
  await new Promise<void>((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve();
    const r = indexedDB.deleteDatabase(DB);
    r.onsuccess = r.onerror = r.onblocked = () => resolve();
  });
}

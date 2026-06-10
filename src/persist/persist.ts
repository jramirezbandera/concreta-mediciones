/* ===========================================================================
   persist — capa de persistencia local (F6.1). Guarda UN blob `ObraData` en
   IndexedDB vía `idb-keyval` (no Dexie: guardamos un objeto, no una BD
   relacional; eng-review F6 Issue 1-B). Lo envuelve en un ENVELOPE con
   metadatos (`savedAt`/`appVersion`) para diagnóstico y migración futura.

   Garantías:
   · Escrituras SERIALIZADAS por una cola de un solo carril → un autosave lento
     nunca aterriza después de uno más nuevo (eng-review Codex #2).
   · Coalescing: si llegan varias mientras una está en vuelo, solo se escribe la
     última (con el debounce del autosave, esto es la red de seguridad).
   · `flush()` espera a que la cola se vacíe (para import/reset/cerrar pestaña).
   · Validación ESTRUCTURAL antes de aceptar un blob cargado (Codex #11): un JSON
     de versión correcta pero malformado NO debe brickear los selectores.
   =========================================================================== */
import { del, get, set } from 'idb-keyval';
import type { ObraData } from '../store';

/** Clave estable del proyecto único (multi-proyecto = T-10, clave por id). */
export const OBRA_KEY = 'concreta.obra.v1';
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
/** Lee el sobre crudo (sin validar). Para recuperación/exportar copia. */
export async function loadRaw(): Promise<unknown> {
  return get(OBRA_KEY);
}

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'ok'; envelope: ObraEnvelope }
  | { kind: 'corrupt'; raw: unknown };

/** Carga y valida el sobre. `corrupt` = había algo pero no es un ObraData sano. */
export async function loadObraEnvelope(): Promise<LoadResult> {
  const raw = await get(OBRA_KEY);
  if (raw === undefined) return { kind: 'empty' };
  if (isEnvelope(raw)) return { kind: 'ok', envelope: raw };
  return { kind: 'corrupt', raw };
}

/* ---- escritura: cola de un carril + coalescing ---------------------------- */
let chain: Promise<void> = Promise.resolve();
let pending: ObraData | null = null;

/** Encola un guardado del dominio. Devuelve la promesa de la cola (await=flush). */
export function saveObra(data: ObraData): Promise<void> {
  pending = data; // coalesce: solo la última en vuelo
  chain = chain.then(async () => {
    if (pending === null) return;
    const d = pending;
    pending = null;
    const env: ObraEnvelope = {
      schemaVersion: d.schemaVersion,
      savedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      data: d,
    };
    await set(OBRA_KEY, env);
  });
  return chain;
}

/** Espera a que se vacíe la cola de escritura (import/reset/cerrar pestaña). */
export function flush(): Promise<void> {
  return chain;
}

/** Borra el proyecto persistido (descartar datos corruptos / reset duro). */
export async function clearObra(): Promise<void> {
  pending = null;
  await del(OBRA_KEY);
}

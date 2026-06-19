/* ===========================================================================
   persist/tabLock — propiedad de obra entre PESTAÑAS (T-19). Evita que dos
   pestañas con la MISMA obra activa se pisen el autosave en silencio.

   Mecanismo: un cerrojo EXCLUSIVO por obra (`concreta.obra.<id>`) vía la Web
   Locks API. La gracia del lock: el navegador lo libera solo cuando la pestaña
   MUERE (cierre/crash), así que el traspaso es automático y sin cerrojos zombis.

   Por obra activa:
     1. Sonda inmediata (`ifAvailable`). Si está libre → la tomamos y la
        MANTENEMOS (callback que no resuelve hasta abortar) → DUEÑA.
     2. Si está ocupada → SOLO-LECTURA + petición BLOQUEANTE del mismo lock que
        se resolverá cuando la dueña lo suelte → TRASPASO automático.

   `claimObra` aborta el claim anterior antes de pedir el nuevo (conmutar de
   obra libera la anterior sin fugas). Sin Web Locks (Safari viejo, jsdom) →
   siempre dueña: el comportamiento de una sola pestaña de hoy, sin regresión.
   =========================================================================== */

/** Subconjunto de `LockManager` que usamos (inyectable en tests). */
export interface LockManagerLike {
  request(
    name: string,
    options: { mode?: 'exclusive' | 'shared'; ifAvailable?: boolean; signal?: AbortSignal },
    callback: (lock: unknown | null) => Promise<void>,
  ): Promise<void>;
}

/** Por qué nos volvimos dueñas: `initial` = al cargar la obra (no recargar);
 *  `handoff` = la otra pestaña soltó el lock (recargar de disco antes de armar,
 *  por si dejó datos más nuevos). */
export type OwnerReason = 'initial' | 'handoff';

export interface ClaimHandlers {
  onOwner: (reason: OwnerReason) => void;
  onReadonly: () => void;
}

function detect(): LockManagerLike | null {
  if (
    typeof navigator !== 'undefined' &&
    navigator.locks &&
    typeof navigator.locks.request === 'function'
  ) {
    return navigator.locks as unknown as LockManagerLike;
  }
  return null;
}

let lockMgr: LockManagerLike | null = detect();
let currentAbort: AbortController | null = null;

/** Inyecta un `LockManager` falso (o `null` para simular ausencia de la API). */
export function __setLockManagerForTests(m: LockManagerLike | null): void {
  lockMgr = m;
}

/** ¿Está disponible la Web Locks API en este entorno? */
export function lockSupported(): boolean {
  return lockMgr !== null;
}

const lockName = (id: string): string => `concreta.obra.${id}`;

/** Promesa que se resuelve cuando `signal` aborta (mantener el lock vivo). */
function heldUntilAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true });
  });
}

/**
 * Reclama la propiedad de la obra `id`. Libera el claim anterior primero. Sin
 * Web Locks → `onOwner('initial')` inmediato (asunción de pestaña única).
 */
export function claimObra(id: string, h: ClaimHandlers): void {
  releaseActiveLock();
  if (!lockMgr) {
    h.onOwner('initial');
    return;
  }
  const ac = new AbortController();
  currentAbort = ac;
  void runClaim(lockMgr, id, h, ac.signal);
}

async function runClaim(
  mgr: LockManagerLike,
  id: string,
  h: ClaimHandlers,
  signal: AbortSignal,
): Promise<void> {
  const name = lockName(id);
  let gotIt = false;
  // 1) Sonda: si el lock está libre, lo tomamos y lo MANTENEMOS aquí mismo.
  await mgr.request(name, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
    if (!lock) return; // ocupado → caemos a solo-lectura + espera abajo
    gotIt = true;
    h.onOwner('initial');
    await heldUntilAbort(signal); // mantener el lock hasta conmutar/cerrar
  });
  if (gotIt || signal.aborted) return;

  // 2) Lo tiene otra pestaña → solo-lectura y petición BLOQUEANTE (traspaso).
  h.onReadonly();
  try {
    await mgr.request(name, { mode: 'exclusive', signal }, async () => {
      if (signal.aborted) return;
      h.onOwner('handoff');
      await heldUntilAbort(signal);
    });
  } catch {
    // AbortError al conmutar de obra: normal, no es un fallo.
  }
}

/** Libera el lock activo (abortando su mantenimiento). Idempotente. */
export function releaseActiveLock(): void {
  if (currentAbort) {
    currentAbort.abort();
    currentAbort = null;
  }
}

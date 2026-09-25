/* ===========================================================================
   persist/durability — almacenamiento PERSISTENTE (`navigator.storage.persist`).
   Sin él, el navegador trata IndexedDB como «best-effort» y puede borrar las
   obras por su cuenta: por falta de disco, o si pasan días sin abrir la web
   (Safari). Cada navegador decide a su manera:
     · Chrome/Edge: sin preguntar, por uso (marcadores, instalada, uso
       frecuente). Un «no» hoy puede ser «sí» otro día → se vuelve a pedir.
     · Safari: sin preguntar; en la práctica solo a la app de pantalla de inicio.
     · Firefox: PREGUNTA al usuario. Por eso no se pide al cargar la página,
       sino tras el primer guardado de la sesión (hay datos que proteger), y no
       se insiste si el usuario ya dijo que no.
   =========================================================================== */
import { usePersistStore } from './persistStore';

/** `unknown` = aún no consultado. `best-effort` = el navegador puede borrarlas. */
export type Durability = 'unknown' | 'persisted' | 'best-effort' | 'unsupported';

function storageApi(): StorageManager | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.storage;
}

/** Estado actual SIN pedir nada: nunca abre un aviso del navegador. */
export async function readDurability(): Promise<Durability> {
  const s = storageApi();
  if (typeof s?.persisted !== 'function' || typeof s.persist !== 'function') return 'unsupported';
  try {
    return (await s.persisted()) ? 'persisted' : 'best-effort';
  } catch {
    return 'best-effort';
  }
}

/** ¿El usuario ya lo rechazó? (Firefox: tras «No permitir», no volver a preguntar.) */
async function deniedByUser(): Promise<boolean> {
  try {
    const st = await navigator.permissions?.query({ name: 'persistent-storage' });
    return st?.state === 'denied';
  } catch {
    return false; // navegador sin esa consulta: se pide igual
  }
}

/** Pide almacenamiento persistente si aún no lo hay. En Firefox puede preguntar. */
export async function requestDurability(): Promise<Durability> {
  const now = await readDurability();
  if (now !== 'best-effort') return now;
  if (await deniedByUser()) return 'best-effort';
  try {
    return (await storageApi()!.persist()) ? 'persisted' : 'best-effort';
  } catch {
    return 'best-effort';
  }
}

/**
 * Arranque (tras hidratar): lee el estado sin preguntar y pide la protección
 * con el PRIMER guardado de la sesión. Devuelve la baja de la suscripción.
 */
export function watchDurability(): () => void {
  const { setDurability } = usePersistStore.getState();
  let requested = false;
  void readDurability().then((d) => {
    if (!requested) setDurability(d); // no pisar el resultado de la petición
  });
  const unsub = usePersistStore.subscribe((s, prev) => {
    if (s.status !== 'saved' || prev.status === 'saved') return;
    unsub();
    requested = true;
    void requestDurability().then(setDurability);
  });
  return unsub;
}

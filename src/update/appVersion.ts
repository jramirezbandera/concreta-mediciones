/* ===========================================================================
   appVersion — detecta que se ha publicado una versión nueva mientras la app
   está abierta (o se abrió desde un index.html cacheado) y recarga a ella.
   GitHub Pages sirve el HTML con caché (~10 min) y los assets con hash: sin
   esto la pestaña sigue en el build viejo hasta vaciar la caché a mano, y tras
   un deploy sus chunks diferidos (importar, imprimir, exportar) dan 404.
   =========================================================================== */
import { useUpdateStore } from './updateStore';

/** Build que está corriendo (horneado por vite.config.ts). */
export const CURRENT_BUILD: string = __APP_BUILD__;

/** Cada cuánto se comprueba con la pestaña visible. */
export const CHECK_EVERY_MS = 5 * 60_000;
/** Mínimo entre comprobaciones no forzadas (volver a la pestaña, reconectar). */
const MIN_GAP_MS = 60_000;
/** Tope de espera al guardado pendiente antes de recargar. Pasado, NO se recarga
 *  (sin confirmar el guardado, recargar podría perder cambios). */
export const FLUSH_TIMEOUT_MS = 10_000;

type FetchFn = typeof fetch;

/** Build publicado ahora mismo (`version.json`), o null si no se pudo saber (sin
 *  red, 404 en mitad de un deploy, JSON raro): «no lo sé» nunca es «hay nueva». */
export async function fetchLatestBuild(fetchImpl: FetchFn = fetch): Promise<string | null> {
  try {
    // no-store + query única: que no conteste ni la caché del navegador ni la del CDN.
    const res = await fetchImpl(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const build = (data as { build?: unknown } | null)?.build;
    return typeof build === 'string' && build !== '' ? build : null;
  } catch {
    return null;
  }
}

export interface WatcherOptions {
  current?: string;
  fetchLatest?: () => Promise<string | null>;
  every?: number;
}

/** Arranca la vigilancia: al abrir, cada 5 min con la pestaña visible, al volver
 *  a ella y al recuperar la red. Un chunk que no carga (`vite:preloadError`)
 *  fuerza una comprobación y, si hay build nuevo, reabre el aviso aunque se
 *  hubiera pospuesto. Devuelve la función que la para. */
export function startUpdateWatcher({
  current = CURRENT_BUILD,
  fetchLatest = fetchLatestBuild,
  every = CHECK_EVERY_MS,
}: WatcherOptions = {}): () => void {
  let lastAt = -Infinity;

  const check = async (force = false, broken = false) => {
    if (!force && Date.now() - lastAt < MIN_GAP_MS) return;
    lastAt = Date.now();
    let latest: string | null;
    try {
      latest = await fetchLatest();
    } catch {
      return;
    }
    if (latest !== null && latest !== current) useUpdateStore.getState().found(latest, broken);
  };

  const onWake = () => {
    if (document.visibilityState === 'visible') void check();
  };
  // SIN preventDefault: el import debe seguir fallando para que actúe su propio
  // manejo (toast «Recarga la página»); aquí solo se averigua si es por un deploy.
  const onPreloadError = () => void check(true, true);

  const timer = window.setInterval(onWake, every);
  document.addEventListener('visibilitychange', onWake);
  window.addEventListener('online', onWake);
  window.addEventListener('vite:preloadError', onPreloadError);
  void check();

  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onWake);
    window.removeEventListener('online', onWake);
    window.removeEventListener('vite:preloadError', onPreloadError);
  };
}

export interface ReloadOptions {
  /** Guardado pendiente que volcar antes de recargar (p. ej. `flushPending`).
   *  Resuelve a si TODO llegó a disco. */
  beforeReload?: () => Promise<boolean>;
  fetchImpl?: FetchFn;
  reload?: () => void;
}

/** Cómo acabó el intento de recargar. Solo `ok` recarga: `sin-guardar` (el
 *  volcado falló) y `guardado-lento` (no terminó a tiempo) dejan la pestaña
 *  como está para no perder cambios; `sin-red` evita la página de error. */
export type ReloadResult = 'ok' | 'sin-red' | 'sin-guardar' | 'guardado-lento';

/** Por qué no se ha recargado (todo menos `ok`). */
export const RELOAD_FAILED: Record<Exclude<ReloadResult, 'ok'>, string> = {
  'sin-red': 'Sin conexión: no se pudo actualizar. Inténtalo de nuevo.',
  'sin-guardar':
    'No se pudieron guardar los últimos cambios y no se ha recargado para no perderlos. Libera espacio o descarga una copia y vuelve a intentarlo.',
  'guardado-lento':
    'El guardado está tardando y no se ha recargado para no perder cambios. Vuelve a intentarlo en un momento.',
};

/** Vuelca lo pendiente con tope de espera: `ok` solo si confirma el guardado. */
async function saveBeforeReload(
  beforeReload: () => Promise<boolean>,
): Promise<'ok' | 'sin-guardar' | 'guardado-lento'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'guardado-lento'>((resolve) => {
    timer = setTimeout(() => resolve('guardado-lento'), FLUSH_TIMEOUT_MS);
  });
  const saved = beforeReload().then(
    (ok) => (ok === true ? ('ok' as const) : ('sin-guardar' as const)),
    () => 'sin-guardar' as const,
  );
  try {
    return await Promise.race([saved, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Recarga a la versión publicada. Vuelca antes lo pendiente y NO recarga si no
 *  lo confirma a tiempo (antes recargaba igual y un guardado fallido se perdía).
 *  Pide el HTML a la red con `cache: 'reload'`, que además SUSTITUYE la copia
 *  cacheada: la recarga, y la próxima vez que se abra la app, ya cargan el build
 *  nuevo sin vaciar la caché a mano. Sin red no recarga (dejaría la página de
 *  error del navegador en vez de la app). */
export async function reloadToLatest({
  beforeReload,
  fetchImpl = fetch,
  reload = () => window.location.reload(),
}: ReloadOptions = {}): Promise<ReloadResult> {
  if (beforeReload) {
    const saved = await saveBeforeReload(beforeReload);
    if (saved !== 'ok') return saved;
  }
  try {
    const res = await fetchImpl(window.location.pathname + window.location.search, {
      cache: 'reload',
    });
    if (!res.ok) return 'sin-red';
  } catch {
    return 'sin-red';
  }
  reload();
  return 'ok';
}

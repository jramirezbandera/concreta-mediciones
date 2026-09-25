/* ===========================================================================
   obraSource — carga una obra propia guardada y la adapta a fuente de Referencia
   (multi-obra T-10, PR3). La decodificación (blob → migración de esquema) la hace
   `loadObraData` del registro (punto único compartido con la carga al store); el
   adaptador puro (`obraToRefSource`) es de core.
   =========================================================================== */
import { obraToRefSource, type RefSource } from '../../core/refdata';
import { loadObraData } from '../../persist';

/** Fuentes-obra retenidas en el caché del panel (LRU): la actual + la anterior
 *  (PLAN_REFERENCIA_LAZY §4). Una base grande hidratada retiene ~50 MB (medido);
 *  sin tope, cada fuente visitada se quedaba en memoria hasta recargar la app. */
export const REF_CACHE_MAX = 2;

/**
 * Re-inserta `key` como la MÁS reciente (el orden de inserción de las claves es
 * el orden de recencia) y desaloja por la cabeza lo que exceda `REF_CACHE_MAX`.
 * Vive aquí y no en el panel para no romper el fast-refresh del componente.
 */
export function lruPut(
  c: Record<string, RefSource>,
  key: string,
  value: RefSource,
): Record<string, RefSource> {
  const next: Record<string, RefSource> = {};
  for (const k of Object.keys(c)) if (k !== key) next[k] = c[k]!;
  next[key] = value;
  const keys = Object.keys(next);
  for (const k of keys.slice(0, Math.max(0, keys.length - REF_CACHE_MAX))) delete next[k];
  return next;
}

/**
 * Carga la obra `id` y la adapta a `RefSource`. `null` si falta o no es válida;
 * `'mas-nueva'` si la guardó una versión posterior de Concreta (la UI muestra
 * un error distinto para cada caso). El llamador descarta respuestas obsoletas
 * si el usuario cambia de fuente antes de que resuelva (guarda anti-stale).
 */
export async function loadObraRefSource(
  id: string,
  name: string,
): Promise<RefSource | 'mas-nueva' | null> {
  const res = await loadObraData(id);
  if (res.kind === 'mas-nueva') return 'mas-nueva';
  if (res.kind !== 'ok') return null;
  const { chapters, partidas, recursos } = res.data;
  return obraToRefSource(id, name, chapters, partidas, recursos);
}

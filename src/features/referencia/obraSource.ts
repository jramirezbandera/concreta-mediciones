/* ===========================================================================
   obraSource — carga una obra propia guardada y la adapta a fuente de Referencia
   (multi-obra T-10, PR3). La decodificación (blob → migración de esquema) la hace
   `loadObraData` del registro (punto único compartido con la carga al store); el
   adaptador puro (`obraToRefSource`) es de core.
   =========================================================================== */
import { obraToRefSource, type RefSource } from '../../core/refdata';
import { loadObraData } from '../../persist';

/**
 * Carga la obra `id` y la adapta a `RefSource`. `null` si falta o no es válida
 * (la UI muestra error). El llamador descarta respuestas obsoletas si el usuario
 * cambia de fuente antes de que resuelva (guarda anti-stale).
 */
export async function loadObraRefSource(id: string, name: string): Promise<RefSource | null> {
  const data = await loadObraData(id);
  return data ? obraToRefSource(id, name, data.chapters, data.partidas, data.recursos) : null;
}

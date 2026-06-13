/* ===========================================================================
   obraSource — carga una obra propia guardada y la adapta a fuente de Referencia
   (multi-obra T-10, PR3). Vive en la feature (no en core): toca IndexedDB
   (`persist`) y la migración de esquema (`fromSerializable`, store). El adaptador
   puro (`obraToRefSource`) sí es de core.
   =========================================================================== */
import { obraToRefSource, type RefSource } from '../../core/refdata';
import { loadObraEnvelope, obraKey } from '../../persist';
import { fromSerializable } from '../../store';

/**
 * Carga el blob de la obra `id`, migra su esquema y lo adapta a `RefSource`.
 * `null` si el blob falta o no es válido (la UI muestra error). El llamador
 * debe descartar respuestas obsoletas si el usuario cambia de fuente antes de
 * que resuelva (guarda anti-stale, Codex).
 */
export async function loadObraRefSource(id: string, name: string): Promise<RefSource | null> {
  const res = await loadObraEnvelope(obraKey(id));
  if (res.kind !== 'ok') return null;
  let data;
  try {
    data = fromSerializable(res.envelope.data);
  } catch {
    return null; // versión no soportada
  }
  return obraToRefSource(id, name, data.chapters, data.partidas, data.recursos);
}

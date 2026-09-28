/* ===========================================================================
   persist/huella — la huella (sha256) de los bytes de un plano, en un worker
   (la implementación propia bloquearía el hilo con un PDF grande fuera de
   contexto seguro); si no hay workers o el worker falla, en el hilo. La usan
   adjuntar un plano y restaurar una copia .zip.
   =========================================================================== */
import { huellaDe } from '../core/sha256';

export async function calcularHuella(bytes: ArrayBuffer): Promise<string> {
  if (typeof Worker === 'undefined') return huellaDe(bytes);
  try {
    const w = new Worker(new URL('./huellaWorker.ts', import.meta.url), { type: 'module' });
    try {
      return await new Promise<string>((resolve, reject) => {
        w.onmessage = (e: MessageEvent<{ ok: boolean; huella?: string; error?: string }>) =>
          e.data.ok ? resolve(e.data.huella!) : reject(new Error(e.data.error));
        w.onerror = (e) => reject(new Error(e.message));
        w.postMessage(bytes); // copia: los bytes se guardan después
      });
    } finally {
      w.terminate();
    }
  } catch {
    return huellaDe(bytes);
  }
}

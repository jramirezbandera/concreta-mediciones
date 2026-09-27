/* Worker de la huella (sha256) de un plano: la implementación propia de
   `core/sha256` bloquea el hilo con un PDF grande fuera de contexto seguro. */
import { huellaDe } from '../../core/sha256';

self.onmessage = async (e: MessageEvent<ArrayBuffer>) => {
  try {
    self.postMessage({ ok: true, huella: await huellaDe(e.data) });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};

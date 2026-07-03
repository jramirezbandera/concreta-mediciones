/* ===========================================================================
   features/importar/parseBc3 — fachada del parseo: Web Worker si existe
   (navegador), inline si no (jsdom en tests, navegadores sin module workers).
   Reconstruye `Bc3ImportError` al cruzar el worker para que la vista trate
   igual ambas rutas.
   =========================================================================== */
import { bc3ToObra, Bc3ImportError, type Bc3ImportResult } from '../../core/bc3import';
import type { Bc3WorkerResponse } from './bc3worker';

export function parseBc3(bytes: Uint8Array): Promise<Bc3ImportResult> {
  if (typeof Worker === 'undefined') {
    return new Promise((resolve, reject) => {
      try {
        resolve(bc3ToObra(bytes));
      } catch (e) {
        reject(e as Error);
      }
    });
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./bc3worker.ts', import.meta.url), { type: 'module' });
    // E-02: sin timeout ni `messageerror` una muerte DURA del worker (OOM con un
    // banco enorme; el navegador no siempre dispara `error`) dejaba la promesa
    // colgada para siempre → dropzone en «Procesando…» y el latch de
    // importPartida bloqueando todo reimporte hasta recargar. El timeout es
    // holgadísimo: un banco de 29 MB parsea en ~1,2 s.
    const settle = (fn: () => void) => {
      clearTimeout(timer);
      worker.terminate();
      fn();
    };
    const timer = setTimeout(
      () =>
        settle(() =>
          reject(
            new Error('La importación no respondió. Reintenta; si el archivo es enorme, pruébalo troceado.'),
          ),
        ),
      120_000,
    );
    worker.onmessage = (e: MessageEvent<Bc3WorkerResponse>) => {
      const msg = e.data;
      settle(() => {
        if (msg.ok) resolve(msg.result);
        else if (msg.isBc3Error) reject(new Bc3ImportError(msg.message, msg.diagnostics));
        else reject(new Error(msg.message));
      });
    };
    worker.onerror = (e) => {
      settle(() => reject(new Error(e.message || 'Falló el proceso de importación.')));
    };
    worker.onmessageerror = () => {
      settle(() => reject(new Error('No se pudo leer la respuesta del importador.')));
    };
    // El buffer se TRANSFIERE (sin copiar 29 MB); `bytes` queda inutilizable
    // para el llamante, que no lo reusa.
    worker.postMessage(bytes, [bytes.buffer]);
  });
}

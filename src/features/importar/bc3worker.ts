/* ===========================================================================
   features/importar/bc3worker — parseo .bc3 fuera del hilo principal.
   El parseo es síncrono y con bancos grandes (29 MB ≈ 1,2 s) congelaría la UI:
   este worker recibe los bytes (transferidos, sin copia), corre `bc3ToObra` y
   devuelve el resultado o el error serializado (las clases de Error no
   sobreviven al structured clone; `parseBc3` las reconstruye).
   =========================================================================== */
import { bc3ToObra, Bc3ImportError, type Bc3ImportResult } from '../../core/bc3import';

export type Bc3WorkerResponse =
  | { ok: true; result: Bc3ImportResult }
  | { ok: false; message: string; isBc3Error: boolean; diagnostics: string[] };

addEventListener('message', (e: MessageEvent<Uint8Array>) => {
  let response: Bc3WorkerResponse;
  try {
    response = { ok: true, result: bc3ToObra(e.data) };
  } catch (err) {
    response = {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      isBc3Error: err instanceof Bc3ImportError,
      diagnostics: err instanceof Bc3ImportError ? err.diagnostics : [],
    };
  }
  postMessage(response);
});

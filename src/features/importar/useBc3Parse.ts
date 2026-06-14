/* ===========================================================================
   useBc3Parse — estado + parseo de un .bc3 (busy/error/result), compartido por la
   vista Importar (REEMPLAZA) y el modal de Referencia (AÑADE). En archivo aparte
   de los componentes (`importShared`) para no romper el fast-refresh (un módulo
   que exporta componentes no debería exportar también hooks/utilidades).
   =========================================================================== */
import { useCallback, useState } from 'react';
import { Bc3ImportError, type Bc3ImportResult } from '../../core/bc3import';
import { parseBc3 } from './parseBc3';

/** Lee un File como bytes. Usa `arrayBuffer()` si existe; si no, `FileReader`
 *  (compatible con todos los navegadores y con jsdom en los tests). */
function readBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer().then((b) => new Uint8Array(b));
  }
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(new Uint8Array(fr.result as ArrayBuffer));
    fr.onerror = () => rej(fr.error ?? new Error('No se pudo leer el archivo.'));
    fr.readAsArrayBuffer(file);
  });
}

/** Estado + parseo de un .bc3. Sin acoplar a la superficie (vista o modal). */
export function useBc3Parse() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diag, setDiag] = useState<string[]>([]);
  const [result, setResult] = useState<Bc3ImportResult | null>(null);
  const [fileName, setFileName] = useState('');

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setDiag([]);
    setResult(null);
    try {
      const bytes = await readBytes(file);
      const res = await parseBc3(bytes); // Web Worker: la UI no se congela
      setResult(res);
      setFileName(file.name);
    } catch (e) {
      if (e instanceof Bc3ImportError) {
        setError(e.message);
        setDiag(e.diagnostics);
      } else {
        setError('No se pudo leer el archivo.');
      }
    } finally {
      setBusy(false);
    }
  }

  // ESTABLE (useCallback con deps vacías): los setters de useState son estables,
  // así un consumidor puede ponerlo en deps de un useEffect sin provocar bucles
  // (el modal de Referencia resetea al cerrarse; con un `reset` recreado por
  // render, ese efecto se reejecutaría sin fin → fuga de memoria).
  const reset = useCallback(() => {
    setBusy(false);
    setError(null);
    setDiag([]);
    setResult(null);
    setFileName('');
  }, []);

  return { busy, error, diag, result, fileName, handleFile, reset };
}

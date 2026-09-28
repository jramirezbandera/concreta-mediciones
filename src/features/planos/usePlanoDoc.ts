/* Abre el PDF de un plano (bytes del almacén + motor de PDF) y su página.
   Cada apertura lleva un número de generación: un documento que llega tarde
   (se pidió otro entretanto) se cierra y no se usa (§8.1). */
import { useEffect, useRef, useState } from 'react';
import { leerBytes } from '../../persist/planos';
import { usePlanoUiStore } from '../../store/planoUiStore';
import { motorPdf } from './motor';
import { ErrorPdf, type DocPdf, type PaginaPdf, type TextoPdf } from './pdfTipos';

export type EstadoDoc =
  | { estado: 'cargando' }
  | { estado: 'no-disponible' }
  | { estado: 'error'; texto: string }
  | { estado: 'listo'; doc: DocPdf };

export function usePlanoDoc(huella: string, archivo: string, intento = 0): EstadoDoc {
  const [e, setE] = useState<EstadoDoc>({ estado: 'cargando' });
  const gen = useRef(0);
  useEffect(() => {
    const mia = ++gen.current;
    const ac = new AbortController();
    let doc: DocPdf | null = null;
    setE({ estado: 'cargando' });
    void (async () => {
      let bytes: ArrayBuffer | undefined;
      try {
        bytes = await leerBytes(huella);
      } catch {
        bytes = undefined;
      }
      if (mia !== gen.current) return;
      usePlanoUiStore.getState().setDisponible(huella, !!bytes);
      if (!bytes) {
        setE({ estado: 'no-disponible' });
        return;
      }
      try {
        const d = await motorPdf().abrir(bytes, { signal: ac.signal });
        if (mia !== gen.current || ac.signal.aborted) {
          d.cerrar(); // llegó tarde
          return;
        }
        doc = d;
        setE({ estado: 'listo', doc: d });
      } catch (err) {
        if (mia !== gen.current || (err instanceof ErrorPdf && err.tipo === 'cancelado')) return;
        const causa = err instanceof ErrorPdf ? (err.tipo === 'contrasena' ? 'tiene contraseña' : (err.causa ?? err.tipo)) : String(err);
        setE({ estado: 'error', texto: `No se pudo abrir «${archivo}»: ${causa}.` });
      }
    })();
    return () => {
      ac.abort();
      doc?.cerrar();
    };
  }, [huella, archivo, intento]);
  return e;
}

export function usePaginaPdf(doc: DocPdf | null, n: number): PaginaPdf | null {
  const [info, setInfo] = useState<{ doc: DocPdf; n: number; info: PaginaPdf } | null>(null);
  useEffect(() => {
    if (!doc) return;
    let vivo = true;
    doc.pagina(n).then(
      (i) => {
        if (vivo) setInfo({ doc, n, info: i });
      },
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [doc, n]);
  return info && info.doc === doc && info.n === n ? info.info : null;
}

/** Textos de una página (el motor los cachea mientras el plano está abierto).
 *  Si no se pueden leer, vacío: sin propuestas ni cajetín, y sin aviso (§7.1). */
export function useTextosPagina(doc: DocPdf | null, n: number): TextoPdf[] | null {
  const [t, setT] = useState<{ doc: DocPdf; n: number; textos: TextoPdf[] } | null>(null);
  useEffect(() => {
    if (!doc) return;
    let vivo = true;
    doc.textos(n).then(
      (textos) => vivo && setT({ doc, n, textos }),
      () => vivo && setT({ doc, n, textos: [] }),
    );
    return () => {
      vivo = false;
    };
  }, [doc, n]);
  return t && t.doc === doc && t.n === n ? t.textos : null;
}

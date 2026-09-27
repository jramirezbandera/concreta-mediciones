/* ===========================================================================
   features/planos/pdfAdapter — el motor de PDF real: pdf.js (build `legacy`,
   también para el worker) en un chunk diferido. Contrato en `pdfTipos`.

   · Versión EXACTA de `pdfjs-dist` en package.json (≥ 4.2.67 por
     CVE-2024-4367); un test comprueba que librería y worker coinciden.
   · Sin XFA, sin formularios ni capa de anotaciones: solo se pinta el dibujo.
     (Las versiones actuales ya no evalúan código: `isEvalSupported` desapareció.)
   · `cMapUrl`, `standardFontDataUrl`, `wasmUrl` e `iccUrl` los publica el
     plugin `pdfjsAssets` de vite.config con el `base` de Pages: sin ellos el
     texto CID del cajetín sale mal y los escaneos salen en blanco.
   · Cada pintado se cancela con su señal (`renderTask.cancel()`): solo pinta
     la última petición, y `cerrar` se puede llamar dos veces (StrictMode).
   =========================================================================== */
import { paginaALienzo, type Caja, type Rotacion } from '../../core/planoGeom';
import { ErrorPdf, type DocPdf, type PaginaPdf, type PdfAdapter, type TextoPdf } from './pdfTipos';

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

/** Ruta del worker: la MISMA build (`legacy`) y versión que la librería. */
export const RUTA_WORKER = 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';

let cargado: Promise<PdfJs> | null = null;

/** Carga pdf.js y su worker bajo demanda (chunk aparte del bundle principal). */
function cargarPdfjs(): Promise<PdfJs> {
  cargado ??= (async () => {
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  })();
  cargado.catch(() => {
    cargado = null; // un chunk que no llegó se puede reintentar
  });
  return cargado;
}

/** Base de los recursos de pdf.js publicados junto a la app. */
function recursos() {
  const base = `${import.meta.env.BASE_URL}pdfjs/`;
  return {
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`,
    wasmUrl: `${base}wasm/`,
    iccUrl: `${base}iccs/`,
  };
}

function aErrorPdf(e: unknown): ErrorPdf {
  if (e instanceof ErrorPdf) return e;
  const name = (e as { name?: string } | null)?.name ?? '';
  const msg = (e as { message?: string } | null)?.message ?? String(e);
  if (name === 'PasswordException') return new ErrorPdf('contrasena', msg);
  if (name === 'AbortException' || name === 'RenderingCancelledException' || name === 'AbortError')
    return new ErrorPdf('cancelado', msg);
  if (name === 'InvalidPDFException' || name === 'FormatError' || name === 'UnknownErrorException')
    return new ErrorPdf('danado', msg);
  if (/worker/i.test(msg)) return new ErrorPdf('worker', msg);
  return new ErrorPdf('danado', msg);
}

const rotacionDe = (r: number): Rotacion => ((((r % 360) + 360) % 360) as Rotacion);

export function crearAdapterPdfjs(cargar: () => Promise<PdfJs> = cargarPdfjs, opciones = recursos): PdfAdapter {
  return {
    async abrir(datos, { signal }) {
      if (datos.byteLength === 0) throw new ErrorPdf('vacio');
      let pdfjs: PdfJs;
      try {
        pdfjs = await cargar();
      } catch (e) {
        throw new ErrorPdf('worker', (e as Error)?.message);
      }
      if (signal.aborted) throw new ErrorPdf('cancelado');
      const tarea = pdfjs.getDocument({
        data: new Uint8Array(datos),
        ...opciones(),
        enableXfa: false,
        useSystemFonts: false,
      });
      const cancelar = () => void tarea.destroy();
      signal.addEventListener('abort', cancelar, { once: true });
      let doc: Awaited<typeof tarea.promise>;
      try {
        doc = await tarea.promise;
      } catch (e) {
        throw signal.aborted ? new ErrorPdf('cancelado') : aErrorPdf(e);
      } finally {
        signal.removeEventListener('abort', cancelar);
      }
      if (signal.aborted) {
        void doc.loadingTask.destroy();
        throw new ErrorPdf('cancelado');
      }
      return documento(pdfjs, doc);
    },
  };
}

/** Pintados en curso por lienzo: pdf.js no admite dos `render()` a la vez sobre
 *  el mismo lienzo, ni siquiera con el anterior ya cancelado (StrictMode monta
 *  los efectos dos veces). El nuevo espera a que el anterior termine de irse. */
const enCurso = new WeakMap<HTMLCanvasElement, Promise<unknown>>();

function documento(pdfjs: PdfJs, doc: import('pdfjs-dist/legacy/build/pdf.mjs').PDFDocumentProxy): DocPdf {
  type Pagina = Awaited<ReturnType<typeof doc.getPage>>;
  const paginas = new Map<number, Promise<Pagina>>();
  const textos = new Map<number, Promise<TextoPdf[]>>();
  let cerrado = false;
  const pagina = (n: number): Promise<Pagina> => {
    if (cerrado) return Promise.reject(new ErrorPdf('cancelado'));
    let p = paginas.get(n);
    if (!p) {
      p = doc.getPage(n);
      paginas.set(n, p);
      p.catch(() => paginas.delete(n));
    }
    return p;
  };
  const info = (p: Pagina): PaginaPdf => {
    const v = p.view;
    return {
      vista: [Math.min(v[0]!, v[2]!), Math.min(v[1]!, v[3]!), Math.max(v[0]!, v[2]!), Math.max(v[1]!, v[3]!)],
      rotacion: rotacionDe(p.rotate),
      userUnit: p.userUnit || 1,
    };
  };
  return {
    paginas: doc.numPages,
    async pagina(n) {
      return info(await pagina(n));
    },
    async pintar(n, lienzo, region, escala, signal) {
      if (signal.aborted) throw new ErrorPdf('cancelado');
      // Turno en el lienzo (síncrono, antes de cualquier await): el siguiente
      // pintado espera a que este termine o se cancele del todo.
      const previo = enCurso.get(lienzo);
      let soltar!: () => void;
      const turno = new Promise<void>((r) => (soltar = r));
      enCurso.set(lienzo, turno);
      try {
        if (previo) await previo.catch(() => undefined);
        if (signal.aborted) throw new ErrorPdf('cancelado');
        const p = await pagina(n);
        if (signal.aborted) throw new ErrorPdf('cancelado');
        const i = info(p);
        const vista = { caja: i.vista, rotacion: i.rotacion, pxPorUnidad: escala };
        const a = paginaALienzo([region[0], region[1]], vista);
        const b = paginaALienzo([region[2], region[3]], vista);
        const x0 = Math.min(a[0], b[0]);
        const y0 = Math.min(a[1], b[1]);
        lienzo.width = Math.max(1, Math.ceil(Math.abs(b[0] - a[0])));
        lienzo.height = Math.max(1, Math.ceil(Math.abs(b[1] - a[1])));
        // pdf.js multiplica la escala por /UserUnit: se la quitamos.
        const viewport = p.getViewport({ scale: escala / i.userUnit, offsetX: -x0, offsetY: -y0 });
        const tarea = p.render({
          canvas: lienzo,
          viewport,
          annotationMode: pdfjs.AnnotationMode.DISABLE,
          background: 'rgb(255,255,255)',
        });
        const cancelar = () => tarea.cancel();
        signal.addEventListener('abort', cancelar, { once: true });
        try {
          await tarea.promise;
        } catch (e) {
          throw aErrorPdf(e);
        } finally {
          signal.removeEventListener('abort', cancelar);
        }
      } finally {
        soltar();
        if (enCurso.get(lienzo) === turno) enCurso.delete(lienzo);
      }
    },
    textos(n) {
      let t = textos.get(n);
      if (!t) {
        t = pagina(n).then(async (p) => {
          const tc = await p.getTextContent();
          const out: TextoPdf[] = [];
          for (const it of tc.items) {
            if (!('str' in it) || !it.str.trim()) continue;
            const [a, b, c, d, e, f] = it.transform as number[];
            const largo = Math.hypot(a!, b!) || 1;
            const alto = Math.hypot(c!, d!) || 1;
            const dir: [number, number] = [a! / largo, b! / largo];
            const arriba: [number, number] = [c! / alto, d! / alto];
            const w = it.width;
            const h = it.height || alto;
            const xs = [e!, e! + dir[0] * w, e! + arriba[0] * h, e! + dir[0] * w + arriba[0] * h];
            const ys = [f!, f! + dir[1] * w, f! + arriba[1] * h, f! + dir[1] * w + arriba[1] * h];
            const caja: Caja = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
            out.push({ texto: it.str, caja, tamano: alto });
          }
          return out;
        });
        textos.set(n, t);
        t.catch(() => textos.delete(n));
      }
      return t;
    },
    cerrar() {
      if (cerrado) return;
      cerrado = true;
      paginas.clear();
      textos.clear();
      void doc.loadingTask.destroy();
    },
  };
}

/** El adaptador de la app (pdf.js real). */
export const pdfAdapter: PdfAdapter = crearAdapterPdfjs();

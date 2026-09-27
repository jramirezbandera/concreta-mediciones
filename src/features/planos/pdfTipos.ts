/* ===========================================================================
   features/planos/pdfTipos — contrato del motor de PDF (§8.1). El real
   (`pdfAdapter`, pdf.js en un chunk diferido) y el doble (`pdfAdapter.fake`)
   lo cumplen igual y comparten tests de contrato.

   Convenciones:
   · `n` (página) empieza en 1;
   · `vista` es la caja visible (CropBox ∩ MediaBox) en el espacio de usuario
     del PDF, con la y hacia arriba, SIN rotar;
   · las transformaciones pantalla ↔ página son funciones puras fuera del
     adaptador (`core/planoGeom`), y `region`, `escala`, los textos y los
     puntos usan esa misma convención; `escala` son px de lienzo por unidad
     de página.
   =========================================================================== */
import type { Caja, Rotacion } from '../../core/planoGeom';
import type { Punto } from '../../core/types';

export interface PaginaPdf {
  vista: Caja;
  rotacion: Rotacion;
  userUnit: number;
}

export interface TextoPdf {
  texto: string;
  caja: Caja;
  /** Tamaño de letra en unidades de página. */
  tamano: number;
}

export interface DocPdf {
  readonly paginas: number;
  /** Caja, /Rotate y /UserUnit de una página (asíncrono: pdf.js carga la
   *  página bajo demanda). */
  pagina(n: number): Promise<PaginaPdf>;
  /** Pinta `region` (caja de página) de la página `n` en `lienzo` a `escala`
   *  px por unidad. El lienzo toma el tamaño de la región. Cancelable: con la
   *  señal abortada rechaza con `ErrorPdf('cancelado')`. */
  pintar(n: number, lienzo: HTMLCanvasElement, region: Caja, escala: number, signal: AbortSignal): Promise<void>;
  textos(n: number): Promise<TextoPdf[]>;
  /** [B] imán a la geometría vectorial: en la interfaz, sin implementar en A. */
  trazados?(n: number): Promise<[Punto, Punto][]>;
  /** Idempotente. */
  cerrar(): void;
}

export interface PdfAdapter {
  /** Se queda con el buffer (pdf.js lo transfiere al worker). */
  abrir(datos: ArrayBuffer, opts: { signal: AbortSignal }): Promise<DocPdf>;
}

export type TipoErrorPdf = 'contrasena' | 'danado' | 'vacio' | 'cancelado' | 'worker';

export class ErrorPdf extends Error {
  constructor(
    public tipo: TipoErrorPdf,
    public causa?: string,
  ) {
    super(causa ? `${tipo}: ${causa}` : tipo);
    this.name = 'ErrorPdf';
  }
}

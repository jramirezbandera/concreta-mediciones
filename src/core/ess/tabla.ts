/* ===========================================================================
   core/ess/tabla — tablas y cifras de seguridad y salud como DATOS
   versionados, con su procedencia (de dónde sale cada cifra y cuándo se
   cotejó). Misma forma que las del CTE de concreta-instalaciones, de donde
   viene el catálogo (docs/plan-seguridad-salud.md, E0).
   =========================================================================== */

export interface Procedencia {
  /** Norma o documento: «RD 614/2001», «INSST, Guía técnica…». */
  db: string;
  /** Edición o modificación vigente. */
  edicion: string;
  /** Fecha del cotejo, ISO. */
  fecha?: string;
  /** Artículo o apartado. */
  articulo?: string;
  /** Identificador de tabla: «Tabla 1». */
  tabla?: string;
  /** Fuente (URL o documento). */
  fuente?: string;
}

/** Tabla o valor normativo con su procedencia. `datos` es inmutable. */
export interface Tabla<T> {
  procedencia: Procedencia;
  datos: T;
}

export function tabla<const T>(procedencia: Procedencia, datos: T): Tabla<T> {
  return { procedencia, datos };
}

/* ===========================================================================
   core/rcd/ler — lista europea de residuos, versionada por fecha.

   La tabla (`tablas/ler.json`, generada por `scripts/rcd/extraer_ler.py` desde
   el DOUE L 370) es la de la Decisión 2014/955/UE. Encima lleva las versiones
   posteriores con su fecha de aplicación: hoy, la Decisión Delegada (UE)
   2025/934 (pilas), aplicable desde el 2026-11-09. `lerVigente(fecha)` da la
   lista de ese día; la fecha que manda es la del estudio (D10).
   =========================================================================== */
import tabla from './tablas/ler.json';
import type { CodigoLer } from './tipos';

export interface CodigoLerInfo {
  codigo: CodigoLer;
  descripcion: string;
  peligroso: boolean;
  /** `false`: el código existe en la lista pero no es de un residuo de obra
   *  (capítulos 01 y 10); se admite con aviso. */
  rcd: boolean;
  aviso?: string;
}

interface CambioLer {
  codigo: string;
  peligroso?: boolean;
  descripcion?: string;
  suprimido?: boolean;
}

interface VersionLer {
  desde: string;
  norma: string;
  cita: string;
  cambios: CambioLer[];
}

export const LER_ID: string = tabla.id;
export const LER_CITA: string = tabla.cita;

const BASE: CodigoLerInfo[] = tabla.codigos.map((c) => ({
  codigo: c.codigo,
  descripcion: c.descripcion,
  peligroso: c.peligroso,
  rcd: (c as { rcd?: boolean }).rcd !== false,
  aviso: (c as { aviso?: string }).aviso,
}));
const VERSIONES: VersionLer[] = tabla.versiones;

/** Versiones aplicables en `fecha` (ISO aaaa-mm-dd), en orden. */
export function versionesAplicables(fecha: string): VersionLer[] {
  return VERSIONES.filter((v) => v.desde <= fecha);
}

const cache = new Map<string, Map<CodigoLer, CodigoLerInfo>>();

/** Lista vigente en `fecha`, indexada por código. */
export function lerVigente(fecha: string): Map<CodigoLer, CodigoLerInfo> {
  const vs = versionesAplicables(fecha);
  const clave = vs.map((v) => v.desde).join('|');
  const hit = cache.get(clave);
  if (hit) return hit;
  const m = new Map(BASE.map((c) => [c.codigo, { ...c }]));
  for (const v of vs)
    for (const c of v.cambios) {
      if (c.suprimido) {
        m.delete(c.codigo);
        continue;
      }
      const prev = m.get(c.codigo);
      m.set(c.codigo, {
        codigo: c.codigo,
        descripcion: c.descripcion ?? prev?.descripcion ?? '',
        peligroso: c.peligroso ?? prev?.peligroso ?? false,
        rcd: prev?.rcd ?? true,
        aviso: prev?.aviso,
      });
    }
  cache.set(clave, m);
  return m;
}

/** Cita de la lista para el documento: la base y las versiones aplicadas cuyo
 *  cambio afecta a algún código usado (K-RCD.8). */
export function citaLer(fecha: string, usados: Iterable<CodigoLer>): string {
  const u = new Set(usados);
  const extra = versionesAplicables(fecha)
    .filter((v) => v.cambios.some((c) => u.has(c.codigo)))
    .map((v) => v.cita);
  return [LER_CITA, ...extra].join(' ');
}

/** Cambios de la lista entre dos fechas que tocan a algún código usado: para
 *  avisar si la obra empieza después de un cambio (D10). */
export function cambiosEntre(desde: string, hasta: string, usados: Iterable<CodigoLer>): VersionLer[] {
  const u = new Set(usados);
  return VERSIONES.filter((v) => v.desde > desde && v.desde <= hasta && v.cambios.some((c) => u.has(c.codigo)));
}

/**
 * Normaliza lo que llega de un .bc3, de la IA o del usuario a «dd dd dd»:
 * «170102», «17 01 02», «17-01-02», «17 01 02*». `null` si no son seis cifras.
 */
export function normalizarLer(raw: string): CodigoLer | null {
  const digitos = raw.replace(/\*/g, '').replace(/[\s.\-_/]/g, '');
  if (!/^\d{6}$/.test(digitos)) return null;
  return `${digitos.slice(0, 2)} ${digitos.slice(2, 4)} ${digitos.slice(4, 6)}`;
}

/** El código con su asterisco si es peligroso, como se imprime. */
export function lerConAsterisco(info: Pick<CodigoLerInfo, 'codigo' | 'peligroso'>): string {
  return info.peligroso ? `${info.codigo}*` : info.codigo;
}

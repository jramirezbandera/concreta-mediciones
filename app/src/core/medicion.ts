/* ===========================================================================
   core/medicion — medición y cantidad/importe de partida.
   Portado verbatim de data.js (`_dim`, `lineParcial`, `medTotal`,
   `partidaCantidad`, `partidaImporte`). Las cantidades son decimales; el
   importe se devuelve en CÉNTIMOS (acumulación exacta en `totales`).
   =========================================================================== */
import type { MedLine, Partida } from './types';
import { round2, importeCents, type Cents } from './money';

/**
 * Factor de una dimensión. Vacía / null / NaN → 1 (la línea no se anula).
 * OJO: un `0` explícito → 0 (anula la línea), tal como hace el código del
 * prototipo (`v == null || v === '' || isNaN(v) ? 1 : Number(v)`).
 */
function dim(v: number | '' | null | undefined): number {
  return v == null || v === '' || Number.isNaN(Number(v)) ? 1 : Number(v);
}

/** Parcial de una línea: round2(uds · largo · ancho · alto). */
export function lineParcial(l: MedLine): number {
  return round2(dim(l.uds) * dim(l.largo) * dim(l.ancho) * dim(l.alto));
}

/** Total de medición: round2(Σ parciales). 0 si no hay líneas. */
export function medTotal(med: MedLine[]): number {
  if (!med || !med.length) return 0;
  return round2(med.reduce((s, l) => s + lineParcial(l), 0));
}

/** Cantidad de la partida: Σ medición si la hay; si no, cantidad fija. */
export function partidaCantidad(p: Partida): number {
  if (p.med && p.med.length) return medTotal(p.med);
  return p.cantidad ?? 0;
}

/**
 * Importe de la partida en céntimos: round2(cantidad · precio · coefK).
 * `coefK` (coeficiente global de obra, §4) por defecto 1 = sin ajuste.
 * Nota: la regla exacta de redondeo de K (por precio vs sobre PEM) es decisión
 * abierta de F1 (`TODOS.md` T-8); aquí K multiplica el precio antes del round2.
 */
export function partidaImporte(p: Partida, coefK = 1): Cents {
  return importeCents(partidaCantidad(p), (p.precio ?? 0) * coefK);
}

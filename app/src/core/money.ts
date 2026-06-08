/* ===========================================================================
   core/money — formato y redondeo (subconjunto F0)
   ---------------------------------------------------------------------------
   Estas son las funciones de FORMATO y PARSEO en español, portadas verbatim
   del prototipo (`data.js`). El MOTOR aritmético en enteros de céntimos
   (IMPLEMENTATION_PLAN §0, decisión 2) se construye en F1; aquí sólo viven
   los helpers que las primitivas de UF0 necesitan (EditableNum, StatusBar…).
   `round2` se conserva por compatibilidad con el prototipo y para los tests
   de fidelidad; el cálculo de F1 NO usará float.
   =========================================================================== */

/** Redondeo a 2 decimales con epsilon, idéntico al prototipo. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Formato numérico español: miles con punto, decimales con coma.
 * `useGrouping:true` fuerza el separador de miles también en 4 cifras
 * (2.293,29). Devuelve cadena vacía para `null`/`NaN`.
 */
export function fmtNum(n: number | null | undefined, dec = 2): string {
  if (n == null || Number.isNaN(n)) return '';
  return Number(n).toLocaleString('es-ES', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
    useGrouping: true,
  });
}

/** Igual que `fmtNum` pero con el sufijo de euro. */
export function fmtEur(n: number | null | undefined, dec = 2): string {
  return `${fmtNum(n, dec)} €`;
}

/**
 * Parsea un número escrito en formato español a `number`.
 * Quita espacios y separadores de miles (punto) y convierte la coma decimal
 * en punto. Devuelve `null` si no es un número válido. Inverso de `fmtNum`.
 */
export function parseEsNumber(input: string): number | null {
  const norm = input
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  if (norm === '' || norm === '-') return null;
  const n = Number.parseFloat(norm);
  return Number.isNaN(n) ? null : n;
}

/** Número para un campo: coma decimal, sin miles, sin ceros de cola. */
export function numTexto(n: number | null | undefined, dec = 4): string {
  if (n == null || !Number.isFinite(n)) return '';
  return n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: dec, useGrouping: false });
}

/** Fecha de hoy (local) en ISO aaaa-mm-dd. */
export function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

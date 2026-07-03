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

/** Redondeo a 2 decimales con epsilon, SIMÉTRICO (half away from zero).
 *  El prototipo hacía `Math.round(n + ε)`, que redondea −0,005 → −0,00 pero
 *  +0,005 → 0,01 (auditoría B-05): en una cert correctiva el líquido + su
 *  corrección dejaba un residuo de −0,01 €, y las líneas «a deducir» de la
 *  medición sesgaban +0,01 en los medios céntimos. round2(−x) === −round2(x). */
export function round2(n: number): number {
  const r = Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100;
  return n < 0 && r !== 0 ? -r : r;
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
    .replace(/\./g, '') // separador de miles
    .replace(',', '.'); // coma decimal → punto
  // T-6: validar la cadena COMPLETA. `parseFloat` tragaba entrada malformada
  // ("12abc"→12, "1,2,3"→1.2), corrompiendo cantidades de dinero en silencio.
  // Se permite el signo: una corrección "esta certificación" puede ser negativa.
  if (!/^-?\d+(\.\d+)?$/.test(norm)) return null;
  const n = Number.parseFloat(norm);
  return Number.isNaN(n) ? null : n;
}

/**
 * Normaliza la entrada de un campo numérico mientras se teclea: el PUNTO (la
 * tecla del teclado numérico) se trata como separador DECIMAL y se convierte en
 * coma. Los campos editan SIN separadores de miles (EditableNum/MedNum los quitan
 * al abrir), así que cualquier punto tecleado es intención de decimal.
 * Excepción: si la cadena YA tiene una coma, no se tocan los puntos (así un valor
 * PEGADO en formato español "1.234,56" conserva sus miles y `parseEsNumber` lo
 * lee bien). Inverso conceptual del formateo; no valida (eso es `parseEsNumber`).
 */
export function toDecimalComma(raw: string): string {
  return raw.includes(',') ? raw : raw.replace(/\./g, ',');
}

/**
 * % editable → fracción, conservando `dec` decimales del porcentaje
 * (13,5 → 0,135; con dec=3, 10,197 → 0,10197). Corrección consciente del
 * prototipo, que hacía `round2(v/100)`: eso cuantiza la FRACCIÓN a 2 decimales
 * (= saltos de 1 punto porcentual), así que 2,5 % se guardaba como 3 %
 * (auditoría B-01/B-02). Clampa a ≥0: el signo vive aparte (`Ajuste.signo`).
 */
export function pctToRate(v: number, dec = 1): number {
  const f = 10 ** dec;
  return Math.round(Math.max(0, v) * f) / (100 * f);
}

/* ===========================================================================
   Dinero en céntimos enteros (§0 decisión 2).
   ---------------------------------------------------------------------------
   Los IMPORTES se modelan como enteros de céntimos: la ACUMULACIÓN (Σ) es
   exacta (sin error de float), mientras que cada paso se redondea igual que el
   prototipo (`round2`) al convertir a céntimos. Las CANTIDADES (medición,
   rendimiento, ejecutada) y los PRECIOS unitarios siguen en euros/decimales:
   son entradas de 2 decimales; el error de float sólo mordía en la suma, y
   eso es lo que arregla trabajar en céntimos. Cada función es idéntica al
   `round2(...)` del prototipo, sólo que devuelve/acumula céntimos.
   =========================================================================== */

/** Importe en céntimos enteros. */
export type Cents = number;

/** Euros (float) → céntimos enteros, con la MISMA regla simétrica que `round2`
 *  (half away from zero — B-05). */
export function toCents(eur: number): Cents {
  const c = Math.round((Math.abs(eur) + Number.EPSILON) * 100);
  return eur < 0 && c !== 0 ? -c : c;
}

/** Céntimos → euros. */
export function toEur(c: Cents): number {
  return c / 100;
}

/** Suma exacta de céntimos (sin error de representación). */
export function sumCents(xs: Cents[]): Cents {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

/** `round2(cantidad · precioEur)` expresado en céntimos. Idéntico al prototipo. */
export function importeCents(cantidad: number, precioEur: number): Cents {
  return toCents(round2(cantidad * precioEur));
}

/** `round2(importeEur · factor)` en céntimos (p.ej. coefK, 1 + gg + bi). */
export function scaleCents(c: Cents, factor: number): Cents {
  return toCents(round2(toEur(c) * factor));
}

/** `round2(importeEur · pct / 100)` en céntimos (p.ej. %CI, retención). */
export function pctCents(c: Cents, pct: number): Cents {
  return toCents(round2((toEur(c) * pct) / 100));
}

/** Formato español en euros desde un importe en céntimos. */
export function fmtCents(c: Cents, dec = 2): string {
  return fmtEur(toEur(c), dec);
}

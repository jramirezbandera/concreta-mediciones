/* ===========================================================================
   core/medTsv — líneas de medición ↔ texto tabulado (TSV), para el
   portapapeles del sistema: copiar de Concreta y pegar en Excel o Google
   Sheets, y al revés.

   Formato canónico (escritura): una fila por línea,
     Comentario ⇥ uds ⇥ largo ⇥ ancho ⇥ alto
   sin cabecera, coma decimal, sin separador de miles; se escribe el VALOR con
   la precisión guardada (no la operación `expr`); casilla vacía = celda vacía.
   El comentario pierde tabuladores y saltos (pasan a espacio) y lleva un `'`
   delante si una hoja de cálculo lo tomaría por fórmula o por número.

   Lectura (pegar):
     · El texto se trocea respetando las comillas de Excel (campos con saltos,
       tabuladores y `""`). Solo se quitan las filas vacías del FINAL.
     · Una celda que empieza por `'` es SIEMPRE texto (se quita un `'`).
     · La disposición se decide UNA vez para todo el bloque: la 1.ª columna es
       el comentario si alguna fila tiene 5 celdas o texto (no una cifra) en la
       1.ª; si no, todas las celdas son casillas desde uds.
     · Las casillas se leen con las reglas de teclear en la celda
       (`toDecimalComma` + `leerCelda`: operaciones y perfiles), después de
       rechazar, número a número, lo que no se puede leer sin adivinar:
       «1,234.56» (punto decimal inglés), más de una coma, y «1.234» sin coma
       (¿mil doscientos o uno con dos?), también con signo o dentro de una
       operación, salvo «0.ddd».
     · Topes: 200 000 caracteres, 500 filas, 200 por casilla, 1 000 por
       comentario. Valores y parciales finitos.
   Un fallo rechaza el pegado ENTERO y dice fila, columna y valor.

   La normalización para COMPARAR (¿es lo que copió Concreta?) va aparte del
   parseo: `normalizarTsv`.
   =========================================================================== */
import { leerCelda } from './expresion';
import { lineParcial } from './medicion';
import { MED_SLOTS } from './medForma';
import { fmtNum, toDecimalComma } from './money';
import type { MedDim, MedLine } from './types';

export const TSV_MAX_CHARS = 200_000;
export const TSV_MAX_ROWS = 500;
export const TSV_MAX_CELL = 200;
export const TSV_MAX_COMMENT = 1_000;

/* ---- escritura ------------------------------------------------------------- */

/** ¿Parece una cifra? (número o operación: dígitos, separadores y operadores).
 *  Decide la disposición del bloque y qué comentarios llevan `'`. */
export function pareceCifra(s: string): boolean {
  const t = s.trim();
  return /\d/.test(t) && /^[\d\s.,+\-−*/×xX·÷()]+$/.test(t);
}

/** Número con coma decimal, sin miles, con la precisión guardada. */
function numATsv(v: number | ''): string {
  if (v === '' || v == null || !Number.isFinite(Number(v))) return '';
  const s = String(v);
  if (!/e/i.test(s)) return s.replace('.', ',');
  return Number(v).toLocaleString('es-ES', { useGrouping: false, maximumFractionDigits: 20 });
}

/** Comentario listo para una celda: sin tabuladores ni saltos, y con `'`
 *  delante si empieza por = + - @ ' TAB o CR (una hoja lo tomaría por fórmula)
 *  o si es una cifra (se leería como uds al volver). */
function comentarioATsv(c: string): string {
  const riesgo = /^[=+\-@'\t\r]/.test(c) || pareceCifra(c);
  const limpio = c.replace(/[\t\r\n]+/g, ' ');
  return riesgo ? `'${limpio}` : limpio;
}

/** Líneas → TSV canónico (5 columnas siempre, filas separadas por `\n`). */
export function lineasATsv(lines: readonly MedLine[]): string {
  return lines
    .map((l) => [comentarioATsv(l.comment ?? ''), ...MED_SLOTS.map((s) => numATsv(l[s]))].join('\t'))
    .join('\n');
}

/* ---- comparación ------------------------------------------------------------ */

/** Texto comparable: CRLF → LF, sin saltos ni filas vacías al final. Solo para
 *  saber si lo que llega es lo que escribió Concreta; NO para parsear. */
export function normalizarTsv(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/(\n[\t ]*)+$/, '').trimEnd();
}

/* ---- lectura ---------------------------------------------------------------- */

/** Error de un pegado: dónde (fila 1-based y casilla) y por qué. */
export type TsvError =
  | { kind: 'too-long'; chars: number }
  | { kind: 'too-many-rows'; rows: number }
  | { kind: 'too-many-cols'; row: number; cols: number }
  | {
      kind: 'cell';
      row: number;
      /** `'comment'` o la casilla. */
      col: MedDim | 'comment';
      value: string;
      reason: 'ambiguo' | 'ingles' | 'comas' | 'ilegible' | 'texto' | 'largo';
    }
  | { kind: 'infinito'; row: number };

export type TsvResult = { ok: true; lines: MedLine[] } | { ok: false; error: TsvError };

/** Filas y celdas, respetando comillas de Excel. */
function trocear(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0;
  let atStart = true; // al principio de una celda (¿abre comillas?)
  const n = text.length;
  while (i < n) {
    const c = text[i]!;
    if (atStart && c === '"') {
      // Campo entre comillas: hasta la comilla que no va doblada.
      i++;
      while (i < n) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            cell += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          cell += text[i]!;
          i++;
        }
      }
      atStart = false;
      continue;
    }
    atStart = false;
    if (c === '\t') {
      row.push(cell);
      cell = '';
      atStart = true;
      i++;
    } else if (c === '\n' || c === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      atStart = true;
      i += c === '\r' && text[i + 1] === '\n' ? 2 : 1;
    } else {
      cell += c;
      i++;
    }
  }
  if (!atStart || cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Solo las filas vacías del FINAL (el salto que añade Excel, huecos de rango).
  while (rows.length && rows[rows.length - 1]!.every((x) => x.trim() === '')) rows.pop();
  return rows;
}

/** Motivo para rechazar una cifra sin adivinar, número a número; o null. */
function revisarCifra(s: string): 'ambiguo' | 'ingles' | 'comas' | null {
  for (const tok of s.match(/[\d.,]+/g) ?? []) {
    const comas = tok.split(',').length - 1;
    if (comas > 1) return 'comas';
    if (comas === 1 && tok.lastIndexOf('.') > tok.indexOf(',')) return 'ingles';
    if (comas === 0 && /^\d{1,3}(\.\d{3})+$/.test(tok) && !/^0\./.test(tok)) return 'ambiguo';
  }
  return null;
}

/**
 * TSV → líneas (ids vacíos: el store los asigna al insertar). Rechaza el
 * bloque entero al primer problema, con fila y columna.
 */
export function parseTsv(text: string): TsvResult {
  if (text.length > TSV_MAX_CHARS) return { ok: false, error: { kind: 'too-long', chars: text.length } };
  const rows = trocear(text);
  if (rows.length > TSV_MAX_ROWS) return { ok: false, error: { kind: 'too-many-rows', rows: rows.length } };
  for (let r = 0; r < rows.length; r++) {
    const cols = rows[r]!.length;
    if (cols > 5) return { ok: false, error: { kind: 'too-many-cols', row: r + 1, cols } };
  }
  // Disposición del bloque, decidida UNA vez.
  const conComentario = rows.some((cells) => {
    if (cells.length === 5) return true;
    const first = cells[0]?.trim() ?? '';
    return first !== '' && (first.startsWith("'") || !pareceCifra(first));
  });

  const lines: MedLine[] = [];
  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r]!;
    const row = r + 1;
    let comment = '';
    let dims = cells;
    if (conComentario) {
      comment = (cells[0] ?? '').trim();
      if (comment.startsWith("'")) comment = comment.slice(1);
      if (comment.length > TSV_MAX_COMMENT)
        return { ok: false, error: { kind: 'cell', row, col: 'comment', value: comment.slice(0, 40), reason: 'largo' } };
      dims = cells.slice(1);
    }
    const line: MedLine = { id: '', comment, uds: '', largo: '', ancho: '', alto: '' };
    for (let d = 0; d < MED_SLOTS.length; d++) {
      const slot = MED_SLOTS[d]!;
      const raw = (dims[d] ?? '').trim();
      if (raw === '') continue;
      const fail = (reason: 'ambiguo' | 'ingles' | 'comas' | 'ilegible' | 'texto' | 'largo') =>
        ({ ok: false, error: { kind: 'cell', row, col: slot, value: raw.slice(0, 40), reason } }) as const;
      if (raw.length > TSV_MAX_CELL) return fail('largo');
      if (raw.startsWith("'")) return fail('texto');
      const motivo = revisarCifra(raw);
      if (motivo) return fail(motivo);
      const leido = leerCelda(toDecimalComma(raw));
      if (!leido || !Number.isFinite(leido.value)) return fail('ilegible');
      line[slot] = leido.value;
      if (leido.expr) (line.expr ??= {})[slot] = leido.expr;
    }
    if (!Number.isFinite(lineParcial(line))) return { ok: false, error: { kind: 'infinito', row } };
    lines.push(line);
  }
  return { ok: true, lines };
}

/** Texto del error para la franja de la medición. `rotulo` nombra la casilla
 *  como la enseña la partida destino (Largo, Longitud, kg/m…). */
export function textoErrorTsv(e: TsvError, rotulo: (slot: MedDim) => string): string {
  switch (e.kind) {
    case 'too-long':
      return `No se pudo pegar: el texto es demasiado largo (${fmtNum(e.chars, 0)} caracteres; admite ${fmtNum(TSV_MAX_CHARS, 0)})`;
    case 'too-many-rows':
      return `Solo se pegan hasta ${TSV_MAX_ROWS} filas (hay ${fmtNum(e.rows, 0)})`;
    case 'too-many-cols':
      return `Fila ${e.row}: ${e.cols} columnas; admite comentario y 4 casillas`;
    case 'infinito':
      return `No se pudo pegar: fila ${e.row}, el parcial no es un número finito`;
    case 'cell': {
      const col = e.col === 'comment' ? 'el comentario' : rotulo(e.col);
      const v = `«${e.value}»`;
      switch (e.reason) {
        case 'ambiguo':
          return `No se pudo pegar: fila ${e.row}, ${col} ${v} es ambiguo. Pégalo sin separador de miles`;
        case 'ingles':
          return `No se pudo pegar: fila ${e.row}, ${col} ${v} usa punto decimal y coma de miles. Pégalo con coma decimal`;
        case 'comas':
          return `No se pudo pegar: fila ${e.row}, ${col} ${v} tiene más de una coma`;
        case 'texto':
          return `No se pudo pegar: fila ${e.row}, ${col} ${v} es texto, no una cifra`;
        case 'largo':
          return e.col === 'comment'
            ? `No se pudo pegar: fila ${e.row}, el comentario pasa de ${fmtNum(TSV_MAX_COMMENT, 0)} caracteres`
            : `No se pudo pegar: fila ${e.row}, ${col} pasa de ${TSV_MAX_CELL} caracteres`;
        default:
          return `No se pudo pegar: fila ${e.row}, ${col} ${v} no es una cifra, una operación ni un perfil`;
      }
    }
  }
}

/* ===========================================================================
   core/numeroALetras — importe en LETRAS para el pie legal de los documentos.
   ---------------------------------------------------------------------------
   «Asciende el presupuesto base de licitación a la expresada cantidad de
   DOSCIENTOS CINCUENTA Y OCHO MIL CIENTO CUARENTA EUROS con NOVENTA Y CUATRO
   CÉNTIMOS» — la fórmula de cierre de cualquier resumen de presupuesto formal
   (Presto la emite igual). Puro y sin React: lo comparten PDF, XLSX y DOCX.

   Apócope: en contexto de euros el uno SIEMPRE se apocopa (VEINTIÚN EUROS, no
   «veintiuno euros»), también antes de MIL (TREINTA Y UN MIL). Los millares no
   llevan «un» delante (1.000 → MIL) pero los millones sí (1.000.000 → UN MILLÓN).
   =========================================================================== */
import type { Cents } from './money';

// 0–29 en tabla: los teens y los veinti- son irregulares y se escriben juntos.
const UNIDADES = [
  'CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE',
  'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS',
  'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
];

/** 0–99 ('' para 0: el llamante decide si emite algo). */
function dosCifras(n: number): string {
  if (n === 0) return '';
  if (n < 30) return UNIDADES[n]!;
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u ? `${DECENAS[d]!} Y ${UNIDADES[u]!}` : DECENAS[d]!;
}

/** 0–999 ('' para 0). 100 exacto es CIEN; 101 en adelante, CIENTO … */
function tresCifras(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  return [c ? CENTENAS[c]! : '', dosCifras(n % 100)].filter(Boolean).join(' ');
}

/** Apócope del uno final: UNO → UN, VEINTIUNO → VEINTIÚN (el orden importa). */
function apocopar(s: string): string {
  return s.replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/UNO$/, 'UN');
}

/** Entero ≥ 0 en letras mayúsculas (recursivo en los millones). */
function enteroALetras(n: number): string {
  if (n === 0) return 'CERO';
  const out: string[] = [];
  const millones = Math.floor(n / 1e6);
  if (millones === 1) out.push('UN MILLÓN');
  else if (millones > 1) out.push(`${apocopar(enteroALetras(millones))} MILLONES`);
  const resto = n % 1e6;
  const miles = Math.floor(resto / 1000);
  if (miles === 1) out.push('MIL');
  else if (miles > 1) out.push(`${apocopar(tresCifras(miles))} MIL`);
  const unidades = resto % 1000;
  if (unidades) out.push(tresCifras(unidades));
  return out.join(' ');
}

/**
 * Número entero ≥ 0 en letras. `apocope` para el uno final cuando le sigue un
 * sustantivo masculino (EUROS/CÉNTIMOS): 21 → VEINTIÚN.
 */
export function numeroALetras(n: number, apocope = false): string {
  const abs = Math.abs(Math.trunc(n));
  const letras = enteroALetras(abs);
  const conApocope = apocope ? apocopar(letras) : letras;
  return n < 0 && abs !== 0 ? `MENOS ${conApocope}` : conApocope;
}

/**
 * Importe en céntimos → «… EUROS con … CÉNTIMOS» (sin céntimos, solo los euros).
 * Mayúsculas salvo el nexo «con», como en el pie de presupuesto de Presto.
 */
export function centsALetras(c: Cents): string {
  const neg = c < 0;
  const abs = Math.abs(Math.round(c));
  const euros = Math.floor(abs / 100);
  const centimos = abs % 100;
  let txt = `${numeroALetras(euros, true)} ${euros === 1 ? 'EURO' : 'EUROS'}`;
  if (centimos) {
    txt += ` con ${numeroALetras(centimos, true)} ${centimos === 1 ? 'CÉNTIMO' : 'CÉNTIMOS'}`;
  }
  return neg ? `MENOS ${txt}` : txt;
}

/** Pie legal completo del resumen (idéntico en PDF, XLSX y DOCX). */
export function asciendeLegal(total: Cents): string {
  return `Asciende el presupuesto base de licitación a la expresada cantidad de ${centsALetras(total)}.`;
}

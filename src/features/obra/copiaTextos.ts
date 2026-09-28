/* Textos de la copia .zip (§9.2, A1), compartidos por la sección de copia del
   modal de obra y el recordatorio de copia de la barra. */
import { fmtNum } from '../../core/money';
import type { CopiaZipResult } from '../../persist';

const MB = 1024 * 1024;

/** «0,4 MB», «42 MB», «1,3 GB». */
export function tamanoCopia(n: number): string {
  if (n >= 1024 * MB) return `${fmtNum(n / (1024 * MB), 1)} GB`;
  return `${fmtNum(n / MB, n < 10 * MB ? 1 : 0)} MB`;
}

export const planosTexto = (n: number) => `${n} ${n === 1 ? 'plano' : 'planos'}`;

/** El aviso de una copia .zip descargada: «Copia completa (42 MB)» o
 *  «Copia incompleta (40 MB): falta Planta 2». */
export function textoCopiaHecha(r: Extract<CopiaZipResult, { kind: 'ok' }>): string {
  return r.faltan.length
    ? `Copia incompleta (${tamanoCopia(r.tamano)}): falta ${r.faltan.join(', ')}`
    : `Copia completa (${tamanoCopia(r.tamano)})`;
}

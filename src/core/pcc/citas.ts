/* ===========================================================================
   core/pcc/citas — lo que el plan no puede imprimir (K-PCC.50-52, 65, 71):
   normas derogadas o sustituidas, clases de exposición de la EHE, marcadores
   de plantilla y normativa de otra comunidad. Se aplica a todo el texto del
   plan y a los `~T` de banco antes de copiarlos (K-PCC.68). No veta el
   Reglamento (UE) 305/2011, que sigue vigente en parte (K-PCC.9).
   =========================================================================== */
import citas from './tablas/citas-prohibidas.json';

const VETADAS = citas.vetadas.map((v) => ({ ...v, regex: new RegExp(v.re, `${(v as { flags?: string }).flags ?? ''}g`) }));

export interface CitaVetada {
  texto: string;
  motivo: string;
  sustituir: string;
}

/** Citas vetadas que aparecen en el texto, con el trozo que casa. */
export function citasVetadasEn(texto: string): CitaVetada[] {
  const out: CitaVetada[] = [];
  for (const v of VETADAS)
    for (const m of texto.matchAll(v.regex)) out.push({ texto: m[0], motivo: v.motivo, sustituir: v.sustituir });
  // Un documento reconocido de otra comunidad (DRC 06/09) se cita como procedimiento, no como norma.
  for (const frase of texto.split(/(?<=[.;])\s+|\n/))
    if (/\bDRC\b/.test(frase) && !/procedimiento/i.test(frase))
      out.push({ texto: frase.trim(), motivo: 'Documento de otra comunidad citado como norma (K-PCC.71)', sustituir: 'citarlo como procedimiento' });
  return out;
}

export const NO_VETAR: readonly string[] = citas.noVetar;
export const CITAS_VERSION: string = citas.version;

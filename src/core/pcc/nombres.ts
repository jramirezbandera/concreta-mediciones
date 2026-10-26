import type { FilaLote, Quien } from './tipos';

/** Filas de edificación de la tabla 57.5.4.1, como las lee el técnico. */
export const NOMBRE_FILA: Record<FilaLote, string> = {
  cim_superficial: 'Cimentación superficial',
  cim_mayor_200: 'Cimentación con elementos de más de 200 m³',
  flexion: 'Elementos a flexión (forjados, vigas, losas)',
  pilares_muros: 'Pilares y muros',
  otros_compresion: 'Otros elementos a compresión',
};

export const QUIEN: Record<Quien, string> = {
  LAB: 'Laboratorio',
  INST: 'Empresa instaladora',
  OC: 'Organismo de control',
  DF: 'A criterio de la dirección facultativa',
};

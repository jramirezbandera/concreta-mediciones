/* ===========================================================================
   core/pcc/unidades — la unidad de una partida o de un lote, normalizada.
   Aparte para que las reglas (chunk principal) no arrastren las tablas del
   Código Estructural (P1 del plan).
   =========================================================================== */

export type UnidadPcc = 'm3' | 'm2' | 'm' | 'kg' | 't' | 'ud' | 'otra';

export function unidadPcc(ud: string): UnidadPcc {
  const u = ud.trim().toLowerCase().replace(/\.$/, '').replace('³', '3').replace('²', '2');
  if (u === 'm3') return 'm3';
  if (u === 'm2') return 'm2';
  if (u === 'm' || u === 'ml') return 'm';
  if (u === 'kg') return 'kg';
  if (u === 't' || u === 'tn') return 't';
  if (u === 'ud' || u === 'u' || u === 'uds') return 'ud';
  return 'otra';
}

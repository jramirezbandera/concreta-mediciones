/* ===========================================================================
   certPctState — estado visual del % de avance certificado.
   ---------------------------------------------------------------------------
   Un solo sitio decide el color semántico de una barra/número de certificación:
   - `progress` (acento): en curso, por debajo del 100 %.
   - `full` (verde, --state-ok): completo, ~100 % (99,5–100,5 por redondeo).
   - `over` (ámbar, --state-warn): EXCESO, se certifica MÁS de lo presupuestado.
     Es una alarma financiera real (antes se veía igual de verde que un 100 %
     sano); por eso se distingue, pero solo salta en ese caso, sin añadir ruido
     al flujo normal.
   =========================================================================== */
export type CertPctState = 'progress' | 'full' | 'over';

export function certPctState(pct: number): CertPctState {
  if (pct > 100.5) return 'over';
  if (pct >= 99.5) return 'full';
  return 'progress';
}

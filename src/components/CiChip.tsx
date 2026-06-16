import { fmtNum } from '../core/money';

/**
 * Chip de costes indirectos de origen: una partida importada de una base (.bc3 de
 * CYPE) trae el % de CI declarado en su ~K. NO se pliega en el precio (CYPE lo
 * muestra aparte); aquí queda VISIBLE para que el 2%/3% no se mezcle en silencio
 * con la convención de la obra. Píldora azulada (`--accent`).
 */
export function CiChip({ pct, small = false }: { pct: number; small?: boolean }) {
  return (
    <span
      title={`Costes indirectos de la base de origen: ${fmtNum(pct, 1)}% (no incluido en el precio unitario, como en CYPE)`}
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: small ? '1px 5px' : '1px 6px',
        borderRadius: 20,
        fontSize: small ? 9 : 9.5,
        fontWeight: 700,
        letterSpacing: '.04em',
        whiteSpace: 'nowrap',
        background: 'color-mix(in srgb, var(--accent) 16%, transparent)',
        color: 'var(--accent)',
      }}
    >
      CI {fmtNum(pct, 1)}%
    </span>
  );
}

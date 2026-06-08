/**
 * Chip de precio contradictorio (P.C.): partida no prevista en el presupuesto
 * inicial. Píldora ámbar (`--state-warn`).
 */
export function ContraChip({ small = false }: { small?: boolean }) {
  return (
    <span
      title="Precio contradictorio · no incluido en el presupuesto inicial"
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
        background: 'color-mix(in srgb, var(--state-warn) 18%, transparent)',
        color: 'var(--state-warn)',
      }}
    >
      P.C.
    </span>
  );
}

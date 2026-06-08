export interface BarProps {
  /** Porcentaje 0–100 (se clampa a [2, 100]). */
  pct: number;
  /** Resalta en color de acento; si no, color atenuado. */
  active?: boolean;
  height?: number;
}

/** Barra de proporción lineal (peso de partida / % PEM). */
export function Bar({ pct, active = false, height = 4 }: BarProps) {
  return (
    <div
      style={{
        width: '100%',
        height,
        borderRadius: 999,
        overflow: 'hidden',
        background: 'var(--border-main)',
      }}
    >
      <div
        style={{
          height: '100%',
          borderRadius: 999,
          transition: 'width .5s cubic-bezier(.22,1,.36,1)',
          width: `${Math.max(2, Math.min(100, pct))}%`,
          background: active ? 'var(--accent)' : 'var(--text-disabled)',
        }}
      />
    </div>
  );
}

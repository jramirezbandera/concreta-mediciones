/** Tipos de recurso del banco. (F1 lo centraliza en core/types.) */
export type ResourceType = 'MO' | 'MQ' | 'MAT' | '%CI';

const BADGE: Record<ResourceType, { label: string; color: string }> = {
  MO: { label: 'MO', color: 'var(--state-warn)' },
  MQ: { label: 'MQ', color: 'var(--state-mq)' },
  MAT: { label: 'MAT', color: 'var(--state-mat)' },
  '%CI': { label: '%CI', color: 'var(--state-neutral)' },
};

/**
 * Badge de tipo de recurso (Concreta: punto 5px + mono caps, fondo al 13%).
 * Clase global `.badge` para la forma; color por tipo inline.
 */
export function Badge({ type }: { type: ResourceType }) {
  const b = BADGE[type] ?? BADGE['%CI'];
  return (
    <span
      className="badge"
      style={{
        background: `color-mix(in srgb, ${b.color} 13%, transparent)`,
        color: b.color,
      }}
    >
      <span className="dot" style={{ background: b.color }} />
      {b.label}
    </span>
  );
}

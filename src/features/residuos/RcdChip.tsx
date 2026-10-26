import type { EstadoResiduo } from '../../core/rcd/tipos';

/** El estado de la asignación, o «revisar» si la partida cambió tras confirmarla (TD1). */
export type EstadoChipRcd = EstadoResiduo | 'revisar';

/* Chip «RCD» de la fila del presupuesto. Fichero propio y sin dependencias:
   la fila lo carga siempre; la vista Residuos y el editor van aparte (lazy). */

const TEXTO: Record<EstadoChipRcd, string> = {
  propuesta: 'por revisar',
  revisar: 'ha cambiado desde que se confirmó',
  confirmada: 'confirmada',
  noGenera: 'no genera',
  gestion: 'gestión',
};

const COLOR: Record<EstadoChipRcd, string> = {
  propuesta: 'var(--state-warn)',
  revisar: 'var(--state-warn)',
  confirmada: 'var(--state-ok)',
  noGenera: 'var(--state-neutral)',
  gestion: 'var(--state-mq)',
};

/** Chip «RCD» de la fila del presupuesto (solo con estudio de residuos). */
export function RcdChip({ estado, small = false }: { estado: EstadoChipRcd; small?: boolean }) {
  return (
    <span
      title={`Estudio de residuos: ${TEXTO[estado]}`}
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        padding: small ? '1px 5px' : '1px 6px',
        borderRadius: 20,
        fontSize: small ? 9 : 9.5,
        fontWeight: 700,
        letterSpacing: '.04em',
        whiteSpace: 'nowrap',
        background: `color-mix(in srgb, ${COLOR[estado]} 16%, transparent)`,
        color: estado === 'noGenera' ? 'var(--text-secondary)' : COLOR[estado],
      }}
    >
      RCD
    </span>
  );
}

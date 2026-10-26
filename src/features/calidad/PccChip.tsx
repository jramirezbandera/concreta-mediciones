import type { EstadoControl } from '../../core/pcc/tipos';

/* Chip «PCC» de la fila del presupuesto. Fichero propio y sin dependencias:
   la fila lo carga siempre; la vista Calidad y el editor van aparte (lazy). */

/** Estado que se pinta: el de la asignación, o «revisar» si la partida cambió tras confirmarla (O6). */
export type EstadoChipPcc = EstadoControl | 'revisar';

const TEXTO: Record<EstadoChipPcc, string> = {
  propuesta: 'por revisar',
  revisar: 'ha cambiado desde que se confirmó',
  confirmada: 'confirmada',
  sinControl: 'sin control',
  capituloControl: 'capítulo de control',
};

const COLOR: Record<EstadoChipPcc, string> = {
  propuesta: 'var(--state-warn)',
  revisar: 'var(--state-warn)',
  confirmada: 'var(--state-ok)',
  sinControl: 'var(--state-neutral)',
  capituloControl: 'var(--state-mq)',
};

/** Chip «PCC» de la fila del presupuesto (solo con plan de control). */
export function PccChip({ estado, small = false }: { estado: EstadoChipPcc; small?: boolean }) {
  return (
    <span
      title={`Plan de control de calidad: ${TEXTO[estado]}`}
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
        color: estado === 'sinControl' ? 'var(--text-secondary)' : COLOR[estado],
      }}
    >
      PCC
    </span>
  );
}

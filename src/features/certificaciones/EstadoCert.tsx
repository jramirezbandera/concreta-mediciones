import { Icon } from '../../components';
import { useObraStore, useToastStore } from '../../store';
import { getDomainRevision, undo } from '../../store/temporal';
import styles from './Certificaciones.module.css';

function fecha(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES');
}

/**
 * Estado de la cert en curso (T-2): en borrador, «Emitir»; emitida, la fecha y
 * «Reabrir». Se emite en orden y solo se reabre la última emitida (lo explica
 * el título del botón cuando no se puede). Reabrir queda en el historial.
 */
export function EstadoCert() {
  const certs = useObraStore((s) => s.certs);
  const curCert = useObraStore((s) => s.curCert);
  const emitir = useObraStore((s) => s.emitirCert);
  const reabrir = useObraStore((s) => s.reabrirCert);
  const cur = certs[curCert];
  if (!cur) return null;
  const aviso = (msg: string) =>
    useToastStore.getState().show(msg, { label: 'Deshacer', run: () => undo() }, { rev: getDomainRevision() });

  if (!cur.emitidaAt) {
    const pendiente = certs.slice(0, curCert).find((c) => !c.emitidaAt);
    return (
      <button
        type="button"
        className={`tcol ${styles.estadoBtn}`}
        disabled={Boolean(pendiente)}
        title={
          pendiente
            ? `Emite antes la certificación nº ${pendiente.num}`
            : 'Cierra la certificación: desde entonces no cambia (para corregirla habrá que reabrirla, y queda constancia)'
        }
        onClick={() => {
          if (emitir(curCert)) aviso(`Certificación nº ${cur.num} emitida: ya no cambia`);
        }}
      >
        <Icon name="check" size={14} /> Emitir
      </button>
    );
  }

  const posterior = certs.slice(curCert + 1).find((c) => c.emitidaAt);
  const reaperturas = (cur.historial ?? []).filter((h) => h.accion === 'reabierta').length;
  return (
    <span className={styles.estado}>
      <span
        className={styles.estadoChip}
        title={reaperturas ? `Reabierta ${reaperturas} ${reaperturas === 1 ? 'vez' : 'veces'} antes` : undefined}
      >
        <Icon name="check" size={12} /> Emitida el {fecha(cur.emitidaAt)}
      </span>
      <button
        type="button"
        className={`tcol ${styles.estadoLink}`}
        disabled={Boolean(posterior)}
        title={posterior ? `Reabre antes la certificación nº ${posterior.num}` : 'Vuelve a borrador para corregirla; queda en su historial'}
        onClick={() => {
          if (reabrir(curCert)) aviso(`Certificación nº ${cur.num} reabierta: queda constancia en su historial`);
        }}
      >
        Reabrir
      </button>
    </span>
  );
}

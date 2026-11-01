import { useState } from 'react';
import { EmptyAction, EmptyState, Icon } from '../../components';
import { seleccionDeFichas } from '../../core/ess/seleccion';
import { useObraStore, useToastStore } from '../../store';
import { exportDocxEss } from '../exportar';
import { hoyIso } from '../residuos/formato';
import { DatosSs } from './DatosSs';
import { Fichas } from './Fichas';
import { PendientesSs, type PestanaSs } from './PendientesSs';
import { useEntradaEss, useEstudioSs } from './useEstudioSs';
import styles from '../residuos/Residuos.module.css';

const PESTANAS: Array<[PestanaSs, string]> = [
  ['fichas', 'Fichas'],
  ['datos', 'Datos'],
  ['pendientes', 'Antes de entregar'],
];

const RESULTADO = {
  basico: 'estudio básico',
  completo: 'hace falta el completo',
  pendiente: 'art. 4 sin decidir',
} as const;

const euros = (v: number) =>
  `${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/**
 * Vista «Seguridad y salud» (dentro de «Anejos»): el estudio básico del art. 6
 * del RD 1627/1997 sacado del presupuesto. Las fichas de riesgos las proponen
 * las partidas y el técnico las marca, quita y edita; el art. 4 se justifica
 * con el PEC de la obra (docs/plan-seguridad-salud.md, E4).
 */
export function SeguridadView({
  compact,
  onGoPresupuesto,
}: {
  compact: boolean;
  onGoPresupuesto: () => void;
}) {
  const obraName = useObraStore((s) => s.obra.denominacion);
  const hayPartidas = useObraStore((s) =>
    Object.values(s.partidas).some((ps) => (ps ?? []).length > 0),
  );
  const iniciar = useObraStore((s) => s.iniciarEstudioSs);
  const e = useEntradaEss();
  const r = useEstudioSs(e);
  const [pestana, setPestana] = useState<PestanaSs>('fichas');

  if (!e || !r) {
    return (
      <EmptyState
        icon="hardhat"
        title="Estudio de seguridad y salud"
        text={
          hayPartidas
            ? 'Saca del presupuesto el estudio básico: las fichas de riesgos de lo que tiene la obra, propuestas por sus partidas, y la justificación del art. 4 con el PEC de la obra. Tú marcas, quitas y editas.'
            : 'Las fichas salen de las partidas del presupuesto: importa un .bc3 o crea las partidas primero.'
        }
      >
        {hayPartidas ? (
          <EmptyAction
            primary
            onClick={() => {
              iniciar();
              useToastStore.getState().show('Estudio empezado: revisa las fichas propuestas');
            }}
          >
            <Icon name="hardhat" size={15} /> Empezar el estudio
          </EmptyAction>
        ) : (
          <EmptyAction primary onClick={onGoPresupuesto}>
            <Icon name="list" size={15} /> Ir al presupuesto
          </EmptyAction>
        )}
      </EmptyState>
    );
  }

  const nFichas = seleccionDeFichas(r.propuestas, e.datos.seleccion).filter(
    (f) => f.marcada,
  ).length;
  return (
    <div className={`fadeUp dot-grid ${styles.view} ${compact ? styles.compact : ''}`}>
      <div className={styles.page}>
        <div className={styles.head}>
          <div>
            <div className={`caps ${styles.kicker}`}>Estudio de seguridad y salud</div>
            <h1 className={styles.title}>{obraName}</h1>
          </div>
          <div className={styles.totals}>
            <div
              className={styles.total}
              title="Resultado de los cuatro supuestos del art. 4.1 del RD 1627/1997"
            >
              <span
                className={`mono ${styles.totalVal}`}
                style={r.art4.resultado === 'completo' ? { color: 'var(--state-fail)' } : undefined}
              >
                {r.art4.resultado === 'basico'
                  ? 'Básico'
                  : r.art4.resultado === 'completo'
                    ? 'Completo'
                    : '—'}
              </span>
              <span className={styles.totalLbl}>{RESULTADO[r.art4.resultado]}</span>
            </div>
            {r.art4.pec && (
              <div className={styles.total}>
                <span className={`mono ${styles.totalVal}`}>{euros(r.art4.pec.pec)}</span>
                <span className={styles.totalLbl}>PEC (umbral 450.759,08 €)</span>
              </div>
            )}
            <div className={styles.total}>
              <span className={`mono ${styles.totalVal}`}>{nFichas}</span>
              <span className={styles.totalLbl}>fichas en el estudio</span>
            </div>
            <button
              type="button"
              className={`tcol ${styles.btnPrimary}`}
              disabled={r.art4.resultado === 'completo'}
              title={
                r.art4.resultado === 'completo'
                  ? 'Se da un supuesto del art. 4.1: hace falta el estudio completo, que la app aún no redacta'
                  : r.pendientes.length
                    ? `Sale con ${r.pendientes.length} pendiente${r.pendientes.length === 1 ? '' : 's'} marcado${r.pendientes.length === 1 ? '' : 's'}`
                    : undefined
              }
              onClick={() => {
                exportDocxEss(hoyIso()).catch(() =>
                  useToastStore
                    .getState()
                    .show('No se pudo generar el Word. Recarga la página.', undefined, {
                      tone: 'error',
                    }),
                );
              }}
            >
              <Icon name="download" size={14} /> Exportar Word
            </button>
          </div>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Partes del estudio">
          {PESTANAS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={pestana === k}
              className={`tcol ${styles.tab} ${pestana === k ? styles.on : ''}`}
              onClick={() => setPestana(k)}
            >
              {label}
              {k === 'pendientes' && r.pendientes.length > 0 && (
                <span className={`mono ${styles.tabCount}`}>{r.pendientes.length}</span>
              )}
            </button>
          ))}
        </div>

        {pestana === 'fichas' && <Fichas r={r} datos={e.datos} />}
        {pestana === 'datos' && <DatosSs e={e} />}
        {pestana === 'pendientes' && <PendientesSs r={r} onIr={setPestana} />}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { EmptyAction, EmptyState, Icon } from '../../components';
import { fmtCents, fmtNum } from '../../core/money';
import { useObraStore, useToastStore } from '../../store';
import { DatosPlan } from './DatosPlan';
import { Estructura } from './Estructura';
import { ListaControl } from './ListaControl';
import { Pendientes, type PestanaPcc } from './Pendientes';
import { Plan } from './Plan';
import { usePlanCalidad } from './usePlanCalidad';
import { Valoracion } from './Valoracion';
import styles from '../residuos/Residuos.module.css';

const PESTANAS: Array<[PestanaPcc, string]> = [
  ['partidas', 'Partidas'],
  ['estructura', 'Estructura'],
  ['plan', 'Plan'],
  ['valoracion', 'Valoración'],
  ['datos', 'Datos'],
  ['pendientes', 'Antes de entregar'],
];

/**
 * Vista «Control de calidad» (dentro de «Anejos»): el plan de control del
 * proyecto de ejecución (CTE parte I, art. 6.1 y anejo I) sacado del
 * presupuesto. Partidas con su control (propuesto por las reglas, confirmado
 * por el usuario), la estructura por lotes, el plan por familia, su
 * valoración y lo que falta antes de entregar.
 */
export function CalidadView({ compact, onGoPresupuesto }: { compact: boolean; onGoPresupuesto: () => void }) {
  const datos = useObraStore((s) => s.planCalidad);
  const obraName = useObraStore((s) => s.obra.denominacion);
  const hayPartidas = useObraStore((s) => Object.values(s.partidas).some((ps) => (ps ?? []).length > 0));
  const iniciar = useObraStore((s) => s.iniciarPlanCalidad);
  const r = usePlanCalidad();
  const [pestana, setPestana] = useState<PestanaPcc>('partidas');
  const [abrir, setAbrir] = useState<string | null>(null);

  if (!datos || !r) {
    return (
      <EmptyState
        icon="flask"
        title="Plan de control de calidad"
        text={
          hayPartidas
            ? 'Saca del presupuesto el control de recepción, de ejecución y de obra terminada, con los lotes de la estructura y su valoración. Cada partida recibe una propuesta que revisas antes de que cuente.'
            : 'El plan sale de las partidas del presupuesto: importa un .bc3 o crea las partidas primero.'
        }
      >
        {hayPartidas ? (
          <EmptyAction
            primary
            onClick={() => {
              const n = iniciar();
              useToastStore.getState().show(n ? `Plan empezado: ${n} partida${n === 1 ? '' : 's'} con propuesta para revisar` : 'Plan empezado');
            }}
          >
            <Icon name="flask" size={15} /> Empezar el plan de control
          </EmptyAction>
        ) : (
          <EmptyAction primary onClick={onGoPresupuesto}>
            <Icon name="list" size={15} /> Ir al presupuesto
          </EmptyAction>
        )}
      </EmptyState>
    );
  }

  const ir = (p: PestanaPcc, partidaId?: string) => {
    setPestana(p);
    if (partidaId) {
      setAbrir(partidaId);
      requestAnimationFrame(() => document.querySelector(`[data-partida-pcc="${partidaId}"]`)?.scrollIntoView?.({ block: 'center' }));
    }
  };
  const porRevisar = r.sinRevisar + r.revisar.length;

  return (
    <div className={`fadeUp dot-grid ${styles.view} ${compact ? styles.compact : ''}`}>
      <div className={styles.page}>
        <div className={styles.head}>
          <div>
            <div className={`caps ${styles.kicker}`}>Plan de control de calidad</div>
            <h1 className={styles.title}>{obraName}</h1>
          </div>
          <div className={styles.totals}>
            <div className={styles.total} title={r.totalCompleto ? undefined : 'A algún ensayo le falta el precio: mira «Antes de entregar»'}>
              <span className={`mono ${styles.totalVal}`}>{r.valoracion.length ? fmtCents(r.total) : '—'}</span>
              <span className={styles.totalLbl}>{r.totalCompleto ? 'valoración' : 'valoración, faltan precios'}</span>
            </div>
            {r.porcentaje && (
              <div className={styles.total}>
                <span className={`mono ${styles.totalVal}`}>{fmtNum(r.porcentaje.valor, 2)} %</span>
                <span className={styles.totalLbl}>del PEM</span>
              </div>
            )}
            {r.estructura.totales.amasadas > 0 && (
              <div className={styles.total}>
                <span className={`mono ${styles.totalVal}`}>{r.estructura.totales.amasadas}</span>
                <span className={styles.totalLbl}>amasadas a controlar</span>
              </div>
            )}
            {porRevisar > 0 && (
              <div className={styles.total}>
                <span className={`mono ${styles.totalVal}`}>{porRevisar}</span>
                <span className={styles.totalLbl}>por revisar</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Partes del plan">
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
              {k === 'pendientes' && r.pendientes.length > 0 && <span className={`mono ${styles.tabCount}`}>{r.pendientes.length}</span>}
            </button>
          ))}
        </div>

        {pestana === 'partidas' && <ListaControl abrir={abrir} onAbrir={setAbrir} />}
        {pestana === 'estructura' && <Estructura r={r} datos={datos} />}
        {pestana === 'plan' && <Plan r={r} datos={datos} />}
        {pestana === 'valoracion' && <Valoracion r={r} datos={datos} />}
        {pestana === 'datos' && <DatosPlan r={r} datos={datos} />}
        {pestana === 'pendientes' && <Pendientes r={r} onIr={ir} />}
      </div>
    </div>
  );
}

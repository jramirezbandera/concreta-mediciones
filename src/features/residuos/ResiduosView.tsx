import { useState } from 'react';
import { EmptyAction, EmptyState, Icon } from '../../components';
import { fmtNum } from '../../core/money';
import { useObraStore, useToastStore } from '../../store';
import { exportDocxRcd } from '../exportar';
import { hoyIso } from './formato';
import { DatosEstudio } from './DatosEstudio';
import { Estimacion } from './Estimacion';
import { ListaPartidas } from './ListaPartidas';
import { Pendientes, type PestanaRcd } from './Pendientes';
import { useEstudioRcd } from './useEstudioRcd';
import styles from './Residuos.module.css';

const PESTANAS: Array<[PestanaRcd, string]> = [
  ['partidas', 'Partidas'],
  ['estimacion', 'Estimación'],
  ['datos', 'Datos'],
  ['pendientes', 'Antes de entregar'],
];

/**
 * Vista «Residuos»: el estudio de gestión de residuos de construcción y
 * demolición (RD 105/2008, art. 4.1 a) sacado del presupuesto. Partidas con su
 * residuo (propuesto por las reglas o el banco, confirmado por el usuario), la
 * estimación por código y lo demás del estudio, y lo que falta antes de entregar.
 */
export function ResiduosView({ compact, onGoPresupuesto }: { compact: boolean; onGoPresupuesto: () => void }) {
  const datos = useObraStore((s) => s.estudioRcd);
  const obraName = useObraStore((s) => s.obra.denominacion);
  const hayPartidas = useObraStore((s) => Object.values(s.partidas).some((ps) => (ps ?? []).length > 0));
  const iniciar = useObraStore((s) => s.iniciarEstudioRcd);
  const r = useEstudioRcd();
  const [pestana, setPestana] = useState<PestanaRcd>('partidas');
  const [abrir, setAbrir] = useState<string | null>(null);

  if (!datos || !r) {
    return (
      <EmptyState
        icon="recycle"
        title="Estudio de gestión de residuos"
        text={
          hayPartidas
            ? 'Saca del presupuesto las toneladas y los m³ de cada residuo, con su código, y el estudio del RD 105/2008. Las demoliciones reciben una propuesta que revisas una a una.'
            : 'El estudio sale de las partidas del presupuesto. Sin mediciones (proyecto básico), estímalo con los m² construidos y los ratios de ECO-eficiencia.'
        }
      >
        {hayPartidas ? (
          <EmptyAction
            primary
            onClick={() => {
              const n = iniciar();
              useToastStore.getState().show(n ? `Estudio empezado: ${n} partida${n === 1 ? '' : 's'} con propuesta para revisar` : 'Estudio empezado');
            }}
          >
            <Icon name="recycle" size={15} /> Empezar el estudio
          </EmptyAction>
        ) : (
          <>
            <EmptyAction
              primary
              onClick={() => {
                iniciar();
                setPestana('datos');
                useToastStore.getState().show('Estudio empezado con ECO-eficiencia: pon la superficie construida');
              }}
            >
              <Icon name="recycle" size={15} /> Estimar con los m²
            </EmptyAction>
            <EmptyAction onClick={onGoPresupuesto}>
              <Icon name="list" size={15} /> Ir al presupuesto
            </EmptyAction>
          </>
        )}
      </EmptyState>
    );
  }

  const ir = (p: PestanaRcd, partidaId?: string) => {
    setPestana(p);
    if (partidaId) {
      setAbrir(partidaId);
      requestAnimationFrame(() => document.querySelector(`[data-partida-rcd="${partidaId}"]`)?.scrollIntoView?.({ block: 'center' }));
    }
  };

  return (
    <div className={`fadeUp dot-grid ${styles.view} ${compact ? styles.compact : ''}`}>
      <div className={styles.page}>
        <div className={styles.head}>
          <div>
            <div className={`caps ${styles.kicker}`}>Estudio de gestión de residuos</div>
            <h1 className={styles.title}>{obraName}</h1>
          </div>
          <div className={styles.totals}>
            <div className={styles.total}>
              <span className={`mono ${styles.totalVal}`}>{fmtNum(r.totales.t, 2)} t</span>
              <span className={styles.totalLbl}>de residuos</span>
            </div>
            {/* Sin los m³ de algún residuo el total no se conoce: «—», no la suma de los demás. */}
            <div
              className={styles.total}
              title={r.totales.m3Aparente == null ? 'A algún residuo le falta un dato: mira «Antes de entregar»' : undefined}
            >
              <span className={`mono ${styles.totalVal}`}>
                {r.totales.m3Aparente == null ? '—' : fmtNum(r.totales.m3Aparente, 2)} m³
              </span>
              <span className={styles.totalLbl}>aparentes</span>
            </div>
            {r.totales.peligrososT > 0 && (
              <div className={styles.total}>
                <span className={`mono ${styles.totalVal}`}>{fmtNum(r.totales.peligrososT, 3)} t</span>
                <span className={styles.totalLbl}>peligrosos</span>
              </div>
            )}
            <button
              type="button"
              className={`tcol ${styles.btnPrimary}`}
              title={r.pendientes.length ? `Sale con ${r.pendientes.length} pendiente${r.pendientes.length === 1 ? '' : 's'} marcado${r.pendientes.length === 1 ? '' : 's'}` : undefined}
              onClick={() => {
                exportDocxRcd(hoyIso()).catch(() => useToastStore.getState().show('No se pudo generar el Word. Recarga la página.', undefined, { tone: 'error' }));
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
              {k === 'pendientes' && r.pendientes.length > 0 && <span className={`mono ${styles.tabCount}`}>{r.pendientes.length}</span>}
            </button>
          ))}
        </div>

        {pestana === 'partidas' && <ListaPartidas abrir={abrir} onAbrir={setAbrir} />}
        {pestana === 'estimacion' && <Estimacion r={r} datos={datos} />}
        {pestana === 'datos' && <DatosEstudio datos={datos} />}
        {pestana === 'pendientes' && <Pendientes r={r} onIr={ir} />}
      </div>
    </div>
  );
}

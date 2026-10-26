import { Icon } from '../../components';
import type { Aviso, PlanCalidad } from '../../core/pcc/tipos';
import styles from '../residuos/Residuos.module.css';

export type PestanaPcc = 'partidas' | 'estructura' | 'plan' | 'valoracion' | 'datos' | 'pendientes';

const ESTRUCTURA = /^(convencional|cubaM3|distintivo|ejecucion|meses|plantas|semanas|superficie|minimoLotes|diametros|series|procedencia|enderezadoSoldadura|soldaduraResistente)\b/;
const PARTIDAS = /^(sinRevisar|sinPartidas|revisar|designacion|dobleComputo|fila|kgPorUd|m3PorUd|elementoMayor|familia)\b/;

/** Dónde se arregla cada cosa. */
function pestanaDe(x: Aviso): PestanaPcc {
  if (/^(capitulo|planPobre|emitido)\b/.test(x.id)) return 'valoracion';
  if (x.partidaId || PARTIDAS.test(x.id)) return 'partidas';
  if (x.grupo || ESTRUCTURA.test(x.id)) return 'estructura';
  if (x.id.startsWith('precio:')) return 'valoracion';
  if (x.id === 'niveles300k' || x.id === 'sinEnsayosHormigon') return 'plan';
  return 'datos';
}

const GRUPO: Array<[string, PestanaPcc]> = [
  ['Partidas', 'partidas'],
  ['Estructura', 'estructura'],
  ['Plan', 'plan'],
  ['Valoración', 'valoracion'],
  ['Datos del plan', 'datos'],
];

/** «Antes de entregar»: lo que falta y lo que conviene mirar, cada cosa con su sitio. */
export function Pendientes({ r, onIr }: { r: PlanCalidad; onIr: (pestana: PestanaPcc, partidaId?: string) => void }) {
  if (r.pendientes.length === 0 && r.avisos.length === 0)
    return (
      <section className={styles.card}>
        <div className={styles.cardTitle}>Nada pendiente</div>
        <p className={styles.nota}>El plan tiene todos los datos que necesita.</p>
      </section>
    );
  return (
    <>
      {r.pendientes.length > 0 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Antes de entregar</div>
            <div className={styles.cita}>Lo que falta sale como «pendiente» en el plan: nunca se supone.</div>
          </div>
          {GRUPO.map(([titulo, pestana]) => {
            const ps = r.pendientes.filter((p) => pestanaDe(p) === pestana);
            if (!ps.length) return null;
            return (
              <div key={pestana} className={styles.pendGroup}>
                <div className="sec-head">{titulo}</div>
                {ps.map((p) => (
                  <div key={p.id} className={styles.pend}>
                    <span>{p.texto}</span>
                    <button type="button" className={styles.link} onClick={() => onIr(pestana, p.partidaId)}>
                      Ir
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </section>
      )}
      {r.avisos.length > 0 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Avisos</div>
            <div className={styles.cita}>No impiden entregar: conviene mirarlos.</div>
          </div>
          <div className={styles.avisos}>
            {r.avisos.map((a) => (
              <div key={a.id} className={styles.aviso}>
                <Icon name="alert" size={15} />
                <span style={{ flex: 1 }}>{a.texto}</span>
                <button type="button" className={styles.link} onClick={() => onIr(pestanaDe(a), a.partidaId)}>
                  Ir
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

import type { EstudioSs } from '../../core/ess/documento';
import styles from '../residuos/Residuos.module.css';

export type PestanaSs = 'fichas' | 'datos' | 'pendientes';

const DE_FICHAS = (id: string) =>
  id.startsWith('ficha:') || id === 'unidades' || id === 'posteriores';

/** «Antes de entregar»: lo que falta, cada cosa con su sitio. */
export function PendientesSs({ r, onIr }: { r: EstudioSs; onIr: (p: PestanaSs) => void }) {
  if (r.pendientes.length === 0)
    return (
      <section className={styles.card}>
        <div className={styles.cardTitle}>Nada pendiente</div>
        <p className={styles.nota}>El estudio tiene todos los datos que necesita.</p>
      </section>
    );
  const grupos: Array<[string, PestanaSs, typeof r.pendientes]> = [
    ['Datos de la obra y del estudio', 'datos', r.pendientes.filter((p) => !DE_FICHAS(p.id))],
    ['Fichas', 'fichas', r.pendientes.filter((p) => DE_FICHAS(p.id))],
  ];
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>Antes de entregar</div>
        <div className={styles.cita}>
          Lo que falta sale como «pendiente» en el documento: nunca se supone.
        </div>
      </div>
      {grupos.map(([titulo, pestana, ps]) =>
        ps.length ? (
          <div key={titulo} className={styles.pendGroup}>
            <div className="sec-head">{titulo}</div>
            {ps.map((p) => (
              <div key={p.id} className={styles.pend}>
                <span>{p.texto}</span>
                <button type="button" className={styles.link} onClick={() => onIr(pestana)}>
                  Ir
                </button>
              </div>
            ))}
          </div>
        ) : null,
      )}
    </section>
  );
}

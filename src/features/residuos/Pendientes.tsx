import type { EstudioRcd, Pendiente } from '../../core/rcd';
import styles from './Residuos.module.css';

export type PestanaRcd = 'partidas' | 'estimacion' | 'datos' | 'pendientes';

const GRUPO: Array<[string, string, (p: Pendiente) => boolean]> = [
  ['Partidas y estimación (1.º)', 'partidas', (p) => p.apartado === '1'],
  ['Destino y gestores (3.º)', 'estimacion', (p) => p.apartado === '3'],
  ['Inventario de peligrosos', 'estimacion', (p) => p.apartado === 'inventario'],
  ['Coste (7.º)', 'estimacion', (p) => p.apartado === '7'],
  ['Fianza', 'estimacion', (p) => p.apartado === 'fianza'],
  ['Datos del estudio y firma', 'datos', (p) => p.apartado === 'datos' || p.apartado === 'firma' || p.apartado === '5' || p.apartado === '2' || p.apartado === '4' || p.apartado === '6'],
];

/** «Antes de entregar»: lo que falta, cada cosa con su sitio. */
export function Pendientes({ r, onIr }: { r: EstudioRcd; onIr: (pestana: PestanaRcd, partidaId?: string) => void }) {
  if (r.pendientes.length === 0)
    return (
      <section className={styles.card}>
        <div className={styles.cardTitle}>Nada pendiente</div>
        <p className={styles.nota}>El estudio tiene todos los datos que necesita.</p>
      </section>
    );
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>Antes de entregar</div>
        <div className={styles.cita}>Lo que falta sale como «pendiente» en el documento: nunca se supone.</div>
      </div>
      {GRUPO.map(([titulo, pestana, f]) => {
        const ps = r.pendientes.filter(f);
        if (!ps.length) return null;
        return (
          <div key={titulo} className={styles.pendGroup}>
            <div className="sec-head">{titulo}</div>
            {ps.map((p) => (
              <div key={p.id} className={styles.pend}>
                <span>{p.texto}</span>
                <button type="button" className={styles.link} onClick={() => onIr(pestana as PestanaRcd, p.partidaId)}>
                  Ir
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}

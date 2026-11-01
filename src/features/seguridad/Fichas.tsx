import { useMemo, useState } from 'react';
import type { EstudioSs } from '../../core/ess/documento';
import { marcarFicha, seleccionDeFichas, type FichaEnSeleccion } from '../../core/ess/seleccion';
import { GRUPOS_FICHA, NOMBRE_GRUPO, type EstudioSsDatos } from '../../core/ess/tipos';
import { useObraStore } from '../../store';
import { EditorFicha } from './EditorFicha';
import styles from '../residuos/Residuos.module.css';
import ss from './Seguridad.module.css';

type Filtro = 'estudio' | 'propuestas' | 'todas';

const FILTROS: Array<[Filtro, string, (f: FichaEnSeleccion) => boolean]> = [
  ['estudio', 'En el estudio', (f) => f.marcada],
  ['propuestas', 'Propuestas', (f) => f.propuesta],
  ['todas', 'Todo el catálogo', () => true],
];

/**
 * Las fichas del catálogo con la propuesta de esta obra: las que piden las
 * partidas, con su motivo. El técnico marca o quita (se guarda como diferencia
 * con la propuesta) y edita riesgos, medidas, protecciones y EPI.
 */
export function Fichas({ r, datos }: { r: EstudioSs; datos: EstudioSsDatos }) {
  const set = useObraStore((s) => s.setEstudioSs);
  const sel = datos.seleccion;
  const fichas = useMemo(() => seleccionDeFichas(r.propuestas, sel), [r.propuestas, sel]);
  const [filtro, setFiltro] = useState<Filtro>('estudio');
  const [abierta, setAbierta] = useState<string | null>(null);
  const casa = FILTROS.find((f) => f[0] === filtro)![2];
  const visibles = fichas.filter((f) => casa(f) || f.ficha.id === abierta);
  const quitadas = sel?.quitadas?.length ?? 0;

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>Fichas de riesgos</div>
        <div className={styles.cita}>
          Solo lo que tiene esta obra (Guía técnica del INSST): la app propone por las partidas y
          los datos; tú marcas, quitas y editas.
          {quitadas > 0 &&
            ` ${quitadas} propuesta${quitadas === 1 ? '' : 's'} quitada${quitadas === 1 ? '' : 's'} por ti.`}
        </div>
      </div>
      <div className={styles.filters} role="group" aria-label="Filtrar fichas">
        {FILTROS.map(([f, label, c]) => (
          <button
            key={f}
            type="button"
            aria-pressed={filtro === f}
            className={`tcol ${styles.filter} ${filtro === f ? styles.on : ''}`}
            onClick={() => setFiltro(f)}
          >
            {label} <span className="mono">{fichas.filter(c).length}</span>
          </button>
        ))}
      </div>
      {GRUPOS_FICHA.map((g) => {
        const fs = visibles.filter((f) => f.ficha.grupo === g);
        if (!fs.length) return null;
        return (
          <div key={g}>
            <div className={styles.chapHead}>{NOMBRE_GRUPO[g]}</div>
            {fs.map((f) => {
              const id = f.ficha.id;
              const open = abierta === id;
              const sinRevisar =
                f.marcada && f.ficha.redactadaPorApp && !sel?.ediciones?.[id]?.revisada;
              const editada = !!sel?.ediciones?.[id] && !sel.ediciones[id]!.revisada;
              return (
                <div key={id} className={styles.row}>
                  <div className={`${styles.rowMain} ${ss.fila}`}>
                    <input
                      type="checkbox"
                      aria-label={`${f.ficha.titulo} en el estudio`}
                      checked={f.marcada}
                      onChange={(ev) =>
                        set({ seleccion: marcarFicha(sel, id, ev.target.checked, f.propuesta) })
                      }
                    />
                    <button
                      type="button"
                      className={`tcol ${styles.rowTitle} ${ss.tituloBtn}`}
                      aria-expanded={open}
                      onClick={() => setAbierta(open ? null : id)}
                    >
                      {f.ficha.titulo}
                      {sinRevisar && (
                        <span className={`${styles.chip} ${styles.chip_propuesta} ${ss.etiqueta}`}>
                          redactada por la app · sin revisar
                        </span>
                      )}
                      {editada && (
                        <span className={`${styles.chip} ${styles.chip_confirmada} ${ss.etiqueta}`}>
                          editada
                        </span>
                      )}
                    </button>
                    <span className={styles.rowSum} title={f.motivos.join('\n')}>
                      {f.propuesta
                        ? f.motivos[0]
                        : f.marcada
                          ? 'añadida por ti'
                          : 'no la piden las partidas'}
                      {f.motivos.length > 1 ? ` (+${f.motivos.length - 1})` : ''}
                    </span>
                  </div>
                  {open && (
                    <div className={styles.rowEditor}>
                      <EditorFicha f={f} datos={datos} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      {visibles.length === 0 && <p className={styles.nota}>Ninguna ficha en este filtro.</p>}
    </div>
  );
}

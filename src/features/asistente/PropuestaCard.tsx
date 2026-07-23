/* ===========================================================================
   features/asistente/PropuestaCard — la ÚNICA superficie con forma de tarjeta.
   ---------------------------------------------------------------------------
   Confirma las ops CON CONSECUENCIAS (editar/borrar/set) antes de tocar el
   documento. Orden de lectura (diseño D5, T18): recuento → diff → botón con
   número. El diff es denso (T19): por encima de un umbral el detalle se pliega
   tras «ver los N» para que el botón «Aplicar» nunca se hunda bajo un muro de
   filas.

   Colores (T27, regla de DESIGN.md): el valor anterior va en `--text-secondary`
   TACHADO (neutro, no rojo) → el propuesto en `--accent`. El ROJO
   (`--state-danger`) queda reservado para BORRADO/destrucción: un valor que va a
   cambiar no es un error, y gastar el rojo aquí lo desgasta para cuando algo falle
   de verdad.
   =========================================================================== */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components';
import type { Proposal, ScopeInfo } from '../../ai';
import styles from './PropuestaCard.module.css';

/** Por encima de tantas propuestas, el detalle arranca plegado (T19). */
const DENSE_THRESHOLD = 8;

/** Diff AGREGADO de un ámbito (certificar_100): recuento + importe afectado, con
 *  el listado completo en un desplegable — el botón «Aplicar» no se hunde (T19). */
function ScopeRow({ scope }: { scope: ScopeInfo }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className={styles.scopeSummary}>
        <span>
          {scope.count} partida{scope.count === 1 ? '' : 's'} al 100%
        </span>
        <span className={`mono ${styles.scopeImporte}`}>{scope.importe}</span>
      </div>
      <button type="button" className={styles.scopeMore} onClick={() => setOpen((v) => !v)}>
        {open ? 'ocultar' : `ver las ${scope.count}`}
      </button>
      {open && (
        <ul className={styles.scopeList}>
          {scope.labels.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface PropuestaCardProps {
  proposals: Proposal[];
  onApply: () => void;
  onDiscard: () => void;
}

export function PropuestaCard({ proposals, onApply, onDiscard }: PropuestaCardProps) {
  const dense = proposals.length > DENSE_THRESHOLD;
  const [expanded, setExpanded] = useState(!dense);
  const applyRef = useRef<HTMLButtonElement>(null);

  // Aplicar sin ir al ratón es lo rápido a pie de obra (T22): el foco entra al
  // botón de aplicar cuando aparece la tarjeta; Enter aplica.
  useEffect(() => {
    applyRef.current?.focus();
  }, []);

  const n = proposals.length;
  // Partidas afectadas: 1 por op de partida + el recuento del ámbito (certificar_100).
  const affected = proposals.reduce((a, p) => a + (p.scope ? p.scope.count : p.partidaId ? 1 : 0), 0);
  // Cert destino (cualquier propuesta de certificación la lleva; comparten cert).
  const certDest = proposals.find((p) => p.certDest)?.certDest;
  const visible = expanded ? proposals : [];

  return (
    <div className={styles.card} role="group" aria-label="Cambios propuestos">
      {/* Destino primero (D5): nombra la cert y avisa si ya se exportó. */}
      {certDest && (
        <div className={`${styles.certBanner} ${certDest.firmado ? styles.certWarn : ''}`}>
          <span className={styles.certLabel}>
            Certificación nº {certDest.num}
            {certDest.period ? ` · ${certDest.period}` : ''}
          </span>
          {certDest.firmado && (
            <span className={styles.certFirmado}>
              <Icon name="alert" size={12} /> ya exportada (firmada)
            </span>
          )}
        </div>
      )}

      <div className={styles.head}>
        <span className={styles.count}>
          {n} cambio{n === 1 ? '' : 's'} propuesto{n === 1 ? '' : 's'}
        </span>
        {affected > 0 && (
          <span className={styles.affected}>
            {affected} partida{affected === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {expanded && (
        <ul className={styles.diffList}>
          {visible.map((prop) => (
            <li key={prop.id} className={styles.group}>
              <div className={styles.target}>{prop.target}</div>
              {prop.scope ? (
                <ScopeRow scope={prop.scope} />
              ) : (
                prop.diffs.map((d, i) => (
                  <div key={i} className={styles.row}>
                    <span className={styles.field}>{d.campo}</span>
                    <span className={styles.values}>
                      <span className={`mono ${styles.antes}`}>{d.antes}</span>
                      <span className={styles.arrow} aria-hidden="true">
                        →
                      </span>
                      <span className={`mono ${d.destructivo ? styles.despuesDel : styles.despues}`}>
                        {d.despues}
                      </span>
                    </span>
                  </div>
                ))
              )}
            </li>
          ))}
        </ul>
      )}

      {dense && (
        <button type="button" className={styles.moreBtn} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'ocultar el detalle' : `ver los ${n} cambios`}
        </button>
      )}

      <div className={styles.actions}>
        <button type="button" className={`tap-target ${styles.discard}`} onClick={onDiscard}>
          Descartar
        </button>
        <button
          ref={applyRef}
          type="button"
          className={`tap-target ${styles.apply}`}
          onClick={onApply}
        >
          <Icon name="check" size={15} /> Aplicar {n} cambio{n === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  );
}

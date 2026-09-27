/* ===========================================================================
   MedOrigen — marcador de origen de una línea medida en un plano (§5.6).
   Columna de 28 px en la tabla (chip en las tarjetas) con el número de la
   línea, que es el botón «Ver en plano». Solo aparece con el visor de planos
   encendido y si la partida tiene alguna línea con `origen`: con el visor
   apagado, la tabla no cambia para nadie. No es una celda: ni Tab, ni flechas
   ni el TSV de copiar lo ven.

   Estados: normal · «✎» retocada · atenuado (plano no disponible, quitado o
   `origen` ilegible). Su popover no lleva `role="dialog"` (apagaría Ctrl+Z).
   =========================================================================== */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components';
import { fmtNum } from '../../core/money';
import { escalaDe, origenLegible, planoLegible } from '../../core/planoDatos';
import { NOMBRE_HERRAMIENTA, lineaRetocada } from '../../core/planoMedida';
import type { MedLine, OrigenPlano, PlanoMeta } from '../../core/types';
import { tienePlano } from '../../persist/planos';
import { verEnPlano, volverAMedir } from './origen';
import { useSessionStore } from '../../persist';
import { useObraStore } from '../../store';
import { usePlanoUiStore } from '../../store/planoUiStore';
import styles from './Presupuesto.module.css';

const comprobando = new Map<string, Promise<void>>();
/** Mira UNA vez por huella si sus bytes están en este navegador. */
function useDisponible(huella: string | null): boolean | undefined {
  const v = usePlanoUiStore((s) => (huella ? s.disponibles[huella] : undefined));
  useEffect(() => {
    if (!huella || v !== undefined || comprobando.has(huella)) return;
    const p = tienePlano(huella)
      .then((ok) => usePlanoUiStore.getState().setDisponible(huella, ok))
      .catch(() => undefined)
      .finally(() => comprobando.delete(huella));
    comprobando.set(huella, p);
  }, [huella, v]);
  return v;
}

export function MedOrigen({ line, numero, chip = false }: { line: MedLine; numero: number; chip?: boolean }) {
  const planos = useObraStore((s) => s.planos);
  const readonly = useSessionStore((s) => s.readonly);
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const o = line.origen;
  const legible = origenLegible(o);
  const plano = legible ? planos.find((p): p is PlanoMeta => planoLegible(p) && p.id === o.planoId) : undefined;
  const disponible = useDisponible(legible ? o.huella : null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [abierto]);

  if (o === undefined) return null;
  const retocada = legible && lineaRetocada(line);
  const quitado = !!plano?.quitado;
  const atenuado = !legible || !plano || quitado || disponible === false;
  const estado = !legible
    ? 'procedencia ilegible'
    : !plano || quitado
      ? 'plano quitado'
      : disponible === false
        ? 'plano no disponible'
        : retocada
          ? 'retocada a mano'
          : 'medida en el plano';

  return (
    <span ref={ref} className={styles.origenWrap}>
      <button
        type="button"
        tabIndex={-1}
        className={`tcol mono ${chip ? styles.origenChip : styles.origenBtn} ${retocada ? styles.origenRetocada : ''} ${atenuado ? styles.origenAtenuado : ''}`}
        title={`Línea ${numero}: ${estado}. Ver en plano`}
        aria-label={`Línea ${numero}: ${estado}. Ver en plano`}
        aria-expanded={abierto}
        onClick={() => setAbierto((x) => !x)}
      >
        {numero}
        {retocada && <span aria-hidden="true">✎</span>}
      </button>
      {abierto && (
        <div
          className={styles.origenPop}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setAbierto(false);
            }
          }}
        >
          {!legible ? (
            <p className={styles.origenPopTexto}>La procedencia de esta línea no se puede leer; sus números no cambian.</p>
          ) : (
            <>
              <div className={styles.origenPopTit}>
                <Icon name="plano" size={14} /> {plano?.nombre ?? 'Plano quitado'}
                {plano?.revision && <span className={styles.origenPopMeta}> · {plano.revision}</span>}
              </div>
              <div className={styles.origenPopMeta}>
                Página {o.pagina} ·{' '}
                {o.herramienta === 'recuento' ? 'Recuento' : `1:${fmtNum(o.n, o.n % 1 ? 1 : 0)}${o.escalaAjustada ? ' ajustada' : ''}`} ·{' '}
                {NOMBRE_HERRAMIENTA[o.herramienta]} · {new Date(o.at).toLocaleDateString('es-ES')}
              </div>
              {retocada && <p className={styles.origenPopAviso}>Retocada a mano: alguna casilla no es la que dio el plano.</p>}
              {(!plano || quitado || disponible === false) && (
                <p className={styles.origenPopAviso}>
                  {quitado || !plano
                    ? 'El plano se quitó de la obra. Vuelve a adjuntar el PDF'
                    : 'Vuelve a adjuntar el PDF'}
                  {plano ? ` «${plano.archivo}» (${fmtNum(plano.tamano / 1048576, 1)} MB)` : ''}: las líneas y la escala se recuperan
                  solas.
                </p>
              )}
              <div className={styles.origenPopBtns}>
                <button
                  type="button"
                  className={styles.origenPopBtn}
                  disabled={!plano || quitado}
                  onClick={() => {
                    setAbierto(false);
                    verEnPlano(line as MedLine & { origen: OrigenPlano });
                  }}
                >
                  Ver en plano
                </button>
                {!readonly && (
                  <button
                    type="button"
                    className={styles.origenPopBtn}
                    disabled={!plano || quitado || disponible === false || (o.herramienta !== 'recuento' && !escalaDe(plano, o.pagina))}
                    onClick={() => {
                      setAbierto(false);
                      volverAMedir(line as MedLine & { origen: OrigenPlano });
                    }}
                  >
                    Volver a medir
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </span>
  );
}

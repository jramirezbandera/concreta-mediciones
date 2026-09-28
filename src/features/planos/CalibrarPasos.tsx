/* ===========================================================================
   CalibrarPasos — la franja de calibrar (§2, sin modal): 1 Cota · 2
   Comprobación · 3 Etiqueta. Los metros de cada cota se teclean en un campo
   anclado al segmento, en el lienzo (`CampoMetros`); aquí van los pasos, la
   precisión, los avisos con sus acciones y la etiqueta de la página.
   =========================================================================== */
import { useEffect, useRef } from 'react';
import { fmtNum, parseEsNumber } from '../../core/money';
import type { EstadoCiclo } from '../../core/planoCiclo';
import { dist, escalaN, mPorUnidadDeCota, precisionCota } from '../../core/planoGeom';
import { BotonAyuda } from './BotonAyuda';
import { textoAvisoCalibrar, textoEscala } from './textos';
import styles from './Planos.module.css';

type Calibrando = Extract<EstadoCiclo, { fase: 'calibrando' }>;

const pct = (f: number) => `${fmtNum(f * 100, 1)} %`;

/** Campo de la distancia real, anclado al segmento en el lienzo. */
export function CampoMetros({
  valor,
  autoFocus,
  onCambio,
  onConfirmar,
}: {
  valor: string;
  autoFocus: boolean;
  onCambio: (t: string) => void;
  onConfirmar: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <label className={styles.campoMetros} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <input
        ref={ref}
        className="mono"
        inputMode="decimal"
        value={valor}
        placeholder="0,00"
        aria-label="Distancia real en metros"
        onChange={(e) => onCambio(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            onConfirmar();
          }
        }}
      />
      <span>m</span>
    </label>
  );
}

export function CalibrarPasos({
  estado,
  px,
  etiqueta,
  onEtiqueta,
  onConfirmar,
  onRehacerCota,
  onRehacerComprobacion,
  onEsCorrecta,
  onCancelar,
  declarada = null,
  userUnit = 1,
}: {
  estado: Calibrando;
  /** Píxeles de pantalla por unidad de página (precisión de la cota). */
  px: number;
  etiqueta: string;
  onEtiqueta: (t: string) => void;
  onConfirmar: () => void;
  onRehacerCota: () => void;
  onRehacerComprobacion: () => void;
  onEsCorrecta: () => void;
  onCancelar: () => void;
  /** [A1] La N de «1:N» del cajetín, si la página declara una. */
  declarada?: number | null;
  userUnit?: number;
}) {
  const t = estado[estado.paso];
  // [A1] Con escala en el cajetín, la cota se compara en vivo con ella.
  const metrosCota = parseEsNumber(estado.cota.metros.trim());
  const nCota =
    declarada && estado.paso === 'cota' && estado.cota.a && estado.cota.b && metrosCota && metrosCota > 0
      ? escalaN(mPorUnidadDeCota(estado.cota.a, estado.cota.b, metrosCota), userUnit)
      : null;
  const largoPx = t.a && t.b ? dist(t.a, t.b) * px : 0;
  const a = estado.aviso;
  return (
    <div className={styles.calibrar}>
      <div className={styles.pasos} aria-label="Pasos de calibrar">
        <span className={estado.paso === 'cota' ? styles.pasoOn : styles.pasoHecho}>1 Cota</span>
        <span aria-hidden="true">›</span>
        <span className={estado.paso === 'comprobacion' ? styles.pasoOn : ''}>2 Comprobación</span>
        <span aria-hidden="true">›</span>
        <span>3 Etiqueta</span>
      </div>
      <p className={styles.franjaTexto}>
        {estado.paso === 'cota'
          ? 'Marca los dos extremos de una cota conocida y escribe su distancia real (arrastra un punto para afinarlo).'
          : estado.soloComprobar
            ? 'Esta escala no está comprobada: marca otra cota conocida, mejor a más de 45° de la de calibrar, y escribe su distancia real.'
            : 'Comprueba con otra cota, mejor a más de 45° de la primera; si la página no tiene otra, repite la misma en otra zona.'}
        {largoPx > 0 && (
          <span className={`mono ${styles.precision}`}> · {fmtNum(largoPx, 0)} px · precisión ≈ ±{pct(precisionCota(largoPx))}</span>
        )}
        {nCota !== null && declarada && (
          <span className={`mono ${styles.precision}`}>
            {' '}
            · calibrada {textoEscala(nCota)} · el plano dice {textoEscala(declarada)}
          </span>
        )}
      </p>
      {a && (
        <div className={styles.avisoCalibrar} role="alert">
          <span>{textoAvisoCalibrar(a)}</span>
          <BotonAyuda />
          {a.tipo === 'desviacion' && (
            <>
              <button type="button" className={styles.btn} onClick={onRehacerCota}>
                Rehacer cota
              </button>
              <button type="button" className={styles.btn} onClick={onRehacerComprobacion}>
                Rehacer comprobación
              </button>
            </>
          )}
          {a.tipo === 'plausibilidad' && (
            <>
              <button type="button" className={`${styles.btn} ${styles.btnPrimario}`} onClick={onEsCorrecta}>
                Sí, es correcta
              </button>
              <button type="button" className={styles.btn} onClick={onRehacerCota}>
                Rehacer cota
              </button>
            </>
          )}
        </div>
      )}
      <div className={styles.calibrarPie}>
        <label className={styles.etiquetaCampo}>
          Esta página es:
          <input
            value={etiqueta}
            maxLength={24}
            placeholder="P1"
            aria-label="Etiqueta de la página"
            onChange={(e) => onEtiqueta(e.target.value)}
          />
        </label>
        <span className={styles.toolFill} />
        <button type="button" className={styles.btn} onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnPrimario}`} onClick={onConfirmar}>
          {estado.paso === 'cota' ? 'Siguiente' : estado.soloComprobar ? 'Comprobar' : 'Calibrar'}
        </button>
      </div>
    </div>
  );
}

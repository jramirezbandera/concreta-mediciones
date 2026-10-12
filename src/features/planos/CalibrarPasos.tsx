/* ===========================================================================
   CalibrarPasos — la franja de calibrar (§2, sin modal), en un solo paso: la
   escala del plano («1:[50]», del cajetín o tecleada) basta; una cota la
   confirma o, sin escala, la da. Si la cota y la escala no cuadran, el
   usuario elige con cuál sigue. Los metros de la cota se teclean en un campo
   anclado al segmento, en el lienzo (`CampoMetros`).
   =========================================================================== */
import { useEffect, useRef } from 'react';
import { fmtNum } from '../../core/money';
import { leerCota, type EstadoCiclo } from '../../core/planoCiclo';
import { DESVIACION_TOPE } from '../../core/planoGeom';
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
  onQuitarCota,
  onEsCorrecta,
  onUsar,
  onCancelar,
  declarada = null,
  userUnit = 1,
  escalaPlano,
  onEscalaPlano,
  papel = null,
}: {
  estado: Calibrando;
  /** Píxeles de pantalla por unidad de página (precisión de la cota). */
  px: number;
  etiqueta: string;
  onEtiqueta: (t: string) => void;
  onConfirmar: () => void;
  onQuitarCota: () => void;
  onEsCorrecta: () => void;
  /** La cota y la escala del plano no cuadran: seguir con una. */
  onUsar: (cual: 'cota' | 'plano') => void;
  onCancelar: () => void;
  /** La N de «1:N» del plano: la tecleada o la del cajetín (A1). */
  declarada?: number | null;
  userUnit?: number;
  /** Texto del campo «Escala del plano». */
  escalaPlano: string;
  onEscalaPlano: (t: string) => void;
  /** Tamaño de la página: «A3 · 420 × 297 mm». */
  papel?: string | null;
}) {
  const cota = estado.cota;
  const hayCota = !!(cota.a || cota.b);
  const l = leerCota(cota, px, userUnit, declarada);
  const a = estado.aviso;
  const texto = !hayCota
    ? declarada
      ? `Se pondrá a ${textoEscala(declarada)} sobre el papel del PDF${papel ? ` (${papel})` : ''}. Si quieres confirmarlo (un PDF exportado a otro tamaño no cuadra), marca una cota conocida.`
      : 'Escribe la escala del plano o marca los dos extremos de una cota conocida y su distancia real.'
    : !cota.b
      ? 'Marca el otro extremo de la cota (Mayús: a 0/45/90°).'
      : !l
        ? 'Escribe su distancia real en metros en el campo del plano.'
        : null;
  return (
    <div className={styles.calibrar}>
      <p className={styles.franjaTexto}>
        {texto}
        {l && a?.tipo !== 'no-cuadra-plano' && (
          <span className="mono">
            La cota da {textoEscala(l.n)} (±{pct(l.precision)})
            {l.precision > DESVIACION_TOPE ? ' · demasiado corta: acerca el zoom' : ''}
            {declarada && l.cuadra === true ? ` · cuadra con ${textoEscala(declarada)}` : ''}
            {declarada && l.cuadra === false ? ` · el plano dice ${textoEscala(declarada)}: no cuadran` : ''}
          </span>
        )}
      </p>
      {a && (
        <div className={styles.avisoCalibrar} role="alert">
          <span>{textoAvisoCalibrar(a)}</span>
          <BotonAyuda seccion="planos-calibrar" />
          {a.tipo === 'no-cuadra-plano' && (
            <>
              <button type="button" className={styles.btn} onClick={() => onUsar('cota')}>
                Usar {textoEscala(a.nCota)} (la cota)
              </button>
              <button type="button" className={styles.btn} onClick={() => onUsar('plano')}>
                Usar {textoEscala(a.declarada)} (el plano)
              </button>
            </>
          )}
          {a.tipo === 'plausibilidad' && (
            <button type="button" className={`${styles.btn} ${styles.btnPrimario}`} onClick={onEsCorrecta}>
              Sí, es correcta
            </button>
          )}
        </div>
      )}
      <div className={styles.calibrarPie}>
        <label className={styles.etiquetaCampo}>
          Escala del plano:
          <span className={styles.escalaCampo}>
            <span className="mono">1:</span>
            <input
              className="mono"
              inputMode="decimal"
              value={escalaPlano}
              maxLength={8}
              placeholder="100"
              aria-label="Escala del plano"
              onChange={(e) => onEscalaPlano(e.target.value)}
            />
          </span>
        </label>
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
        {hayCota && (
          <button type="button" className={styles.btn} onClick={onQuitarCota}>
            Quitar cota
          </button>
        )}
        <button type="button" className={styles.btn} onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnPrimario}`} onClick={onConfirmar}>
          {!hayCota && declarada ? `Usar ${textoEscala(declarada)}` : 'Calibrar'}
        </button>
      </div>
    </div>
  );
}

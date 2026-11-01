// =============================================================================
// Las cifras verificadas del estudio básico (feature-35, paso 3), como tablas
// versionadas con su procedencia, igual que las del CTE. Solo lo que K-SYS.16
// da por VERIFICADO (texto) en research/verificacion-seguridad-salud.md. Lo
// que ninguna norma fija (entibación, acopios al borde, rodapié, borriquetas,
// iluminación, anclajes del andamio…) no está aquí ni lleva cifra en el
// catálogo.
// =============================================================================

import { tabla } from './tabla';

const BOE = 'boe.es, consolidado descargado el 2026-10-16';

// ── Líneas eléctricas: RD 614/2001, anexo I, tabla 1 ─────────────────────────

/** Una fila de la tabla 1: tensión nominal y las cuatro distancias límite [cm]. */
export interface FilaRD614 {
  /** Tensión nominal de la instalación [kV]. */
  un_kV: number;
  /** Zona de peligro con riesgo de sobretensión por rayo [cm]. */
  dpel1_cm: number;
  /** Zona de peligro sin riesgo de sobretensión por rayo [cm]. */
  dpel2_cm: number;
  /** Zona de proximidad cuando se puede delimitar con precisión la zona de trabajo [cm]. */
  dprox1_cm: number;
  /** Zona de proximidad cuando no se puede delimitar con precisión [cm]: la que rige en obra. */
  dprox2_cm: number;
}

/**
 * «Distancias límite de las zonas de trabajo», con interpolación lineal para
 * tensiones intermedias. Transcrita del texto y cotejada en imagen celda a
 * celda (K-SYS.16). Para las obras, donde no se puede delimitar la zona con
 * precisión, rige DPROX-2 (INTERPRETACIÓN).
 */
export const DISTANCIAS_RD614 = tabla(
  {
    db: 'RD 614/2001',
    edicion: 'sin modificaciones',
    fecha: '2026-10-16',
    articulo: 'anexo I',
    tabla: 'Tabla 1',
    fuente: BOE,
  },
  [
    { un_kV: 1, dpel1_cm: 50, dpel2_cm: 50, dprox1_cm: 70, dprox2_cm: 300 },
    { un_kV: 3, dpel1_cm: 62, dpel2_cm: 52, dprox1_cm: 112, dprox2_cm: 300 },
    { un_kV: 6, dpel1_cm: 62, dpel2_cm: 53, dprox1_cm: 112, dprox2_cm: 300 },
    { un_kV: 10, dpel1_cm: 65, dpel2_cm: 55, dprox1_cm: 115, dprox2_cm: 300 },
    { un_kV: 15, dpel1_cm: 66, dpel2_cm: 57, dprox1_cm: 116, dprox2_cm: 300 },
    { un_kV: 20, dpel1_cm: 72, dpel2_cm: 60, dprox1_cm: 122, dprox2_cm: 300 },
    { un_kV: 30, dpel1_cm: 82, dpel2_cm: 66, dprox1_cm: 132, dprox2_cm: 300 },
    { un_kV: 45, dpel1_cm: 98, dpel2_cm: 73, dprox1_cm: 148, dprox2_cm: 300 },
    { un_kV: 66, dpel1_cm: 120, dpel2_cm: 85, dprox1_cm: 170, dprox2_cm: 300 },
    { un_kV: 110, dpel1_cm: 160, dpel2_cm: 100, dprox1_cm: 210, dprox2_cm: 500 },
    { un_kV: 132, dpel1_cm: 180, dpel2_cm: 110, dprox1_cm: 330, dprox2_cm: 500 },
    { un_kV: 220, dpel1_cm: 260, dpel2_cm: 160, dprox1_cm: 410, dprox2_cm: 500 },
    { un_kV: 380, dpel1_cm: 390, dpel2_cm: 250, dprox1_cm: 540, dprox2_cm: 700 },
  ] as readonly FilaRD614[],
);

/** Las distancias de la tabla 1 para una línea, con interpolación lineal (redondeada hacia arriba al cm). */
export type DistanciasLinea = Omit<FilaRD614, 'un_kV'>;

/**
 * Las cuatro distancias límite para una tensión nominal [kV]. Hasta 1 kV, la
 * primera fila; entre filas, interpolación lineal (anexo I); por encima de
 * 380 kV o sin tensión válida, `undefined`.
 */
export function distanciasLineas(kV: number): DistanciasLinea | undefined {
  if (!Number.isFinite(kV) || kV <= 0) return undefined;
  const filas = DISTANCIAS_RD614.datos;
  const primera = filas[0];
  if (!primera) return undefined;
  if (kV <= primera.un_kV) return sinTension(primera);
  for (let i = 0; i < filas.length - 1; i++) {
    const a = filas[i];
    const b = filas[i + 1];
    if (!a || !b || kV > b.un_kV) continue;
    if (kV === b.un_kV) return sinTension(b);
    const t = (kV - a.un_kV) / (b.un_kV - a.un_kV);
    const interp = (x: number, y: number): number => Math.ceil(x + (y - x) * t);
    return {
      dpel1_cm: interp(a.dpel1_cm, b.dpel1_cm),
      dpel2_cm: interp(a.dpel2_cm, b.dpel2_cm),
      dprox1_cm: interp(a.dprox1_cm, b.dprox1_cm),
      dprox2_cm: interp(a.dprox2_cm, b.dprox2_cm),
    };
  }
  return undefined;
}

const sinTension = (f: FilaRD614): DistanciasLinea => ({
  dpel1_cm: f.dpel1_cm,
  dpel2_cm: f.dpel2_cm,
  dprox1_cm: f.dprox1_cm,
  dprox2_cm: f.dprox2_cm,
});

// ── Instalación eléctrica provisional: REBT, ITC-BT-33 e ITC-BT-24 ──────────

/**
 * La toma de tierra provisional no tiene un valor fijo en ohmios: la tensión de
 * contacto límite en esquema TT es 24 V y RA × Ia ≤ U; toda base de toma de
 * corriente va con diferencial de 30 mA como máximo.
 */
export const TIERRA_PROVISIONAL = tabla(
  {
    db: 'REBT (RD 842/2002)',
    edicion: 'consolidado, última modificación 03-09-2025',
    fecha: '2026-10-16',
    articulo: 'ITC-BT-33 ap. 4.2; ITC-BT-24 ap. 4.1.2',
    fuente: BOE,
  },
  {
    /** Tensión límite convencional de contacto en TT, corriente alterna [V]. */
    tensionLimite_V: 24,
    /** Sensibilidad máxima del diferencial de toda base o grupo de bases [mA]. */
    sensibilidadBases_mA: 30,
    /** Grado de protección mínimo de los elementos a la intemperie. */
    gradoProteccion: 'IP45',
    /** Tensión asignada mínima de los cables de acometidas y exteriores. */
    cablesExterior: '450/750 V',
    /** Tensión asignada mínima de los cables interiores. */
    cablesInterior: '300/500 V',
  },
);

/**
 * Resistencia máxima de la toma de tierra para una sensibilidad del diferencial
 * [mA]: RA ≤ 24 V / Ia. Con 30 mA, 800 Ω; con 300 mA, 80 Ω (aritmética sobre
 * la ITC-BT-24; el valor es INTERPRETACIÓN).
 */
export function resistenciaTierraMax(sensibilidad_mA: number): number | undefined {
  if (!Number.isFinite(sensibilidad_mA) || sensibilidad_mA <= 0) return undefined;
  return TIERRA_PROVISIONAL.datos.tensionLimite_V / (sensibilidad_mA / 1000);
}

// ── Ruido y vibraciones ──────────────────────────────────────────────────────

/** RD 286/2006, art. 5.1: valores inferiores y superiores de acción y límite, diarios y de pico. */
export const RUIDO_RD286 = tabla(
  {
    db: 'RD 286/2006',
    edicion: 'sin modificaciones',
    fecha: '2026-10-16',
    articulo: 'art. 5.1; art. 7.1; art. 4.3',
    fuente: BOE,
  },
  {
    /** LAeq,d desde el que los protectores se ponen a disposición [dB(A)]. */
    inferior_dBA: 80,
    /** LAeq,d desde el que los protectores se usan y la zona se señaliza [dB(A)]. */
    superior_dBA: 85,
    /** Valor límite de exposición diaria [dB(A)]. */
    limite_dBA: 87,
    picoInferior_dBC: 135,
    picoSuperior_dBC: 137,
    picoLimite_dBC: 140,
  },
);

/** RD 1311/2005, art. 3: valores de acción y límite [m/s²], exposición diaria normalizada a 8 h. */
export const VIBRACIONES_RD1311 = tabla(
  {
    db: 'RD 1311/2005',
    edicion: 'consolidado, última modificación 26-03-2009',
    fecha: '2026-10-16',
    articulo: 'art. 3',
    fuente: BOE,
  },
  {
    manoBrazo: { accion: 2.5, limite: 5 },
    cuerpoEntero: { accion: 0.5, limite: 1.15 },
  },
);

// ── Caídas y equipos de trabajo ──────────────────────────────────────────────

/** RD 1627/1997, anexo IV C.3 a): barandilla de 90 cm como mínimo, con reborde (rodapié), pasamanos y protección intermedia, para caídas de más de 2 m. */
export const BARANDILLA_RD1627 = tabla(
  {
    db: 'RD 1627/1997',
    edicion: 'consolidado, última modificación 23-03-2010',
    fecha: '2026-10-16',
    articulo: 'anexo IV, parte C, ap. 3 a)',
    fuente: BOE,
  },
  { alturaMin_cm: 90, caidaDesde_m: 2 },
);

/** RD 1215/1997, anexo II, ap. 4.2: escaleras de mano. */
export const ESCALERA_RD1215 = tabla(
  {
    db: 'RD 1215/1997',
    edicion: 'consolidado, última modificación 13-11-2004',
    fecha: '2026-10-16',
    articulo: 'anexo II, aps. 4.2.2 a 4.2.4',
    fuente: BOE,
  },
  {
    /** Sobresale al menos esto del plano de trabajo al que se accede [m]. */
    sobresalir_m: 1,
    /** Ángulo aproximado con la horizontal [°]. */
    angulo_grados: 75,
    /** Desde esta altura, los trabajos con esfuerzos peligrosos solo con anticaídas o alternativa [m]. */
    anticaidas_m: 3.5,
    /** Prohibidas sin garantías de resistencia, «en particular» las de más de esto [m]. No es un máximo. */
    sinGarantias_m: 5,
  },
);

/** RD 1215/1997, anexo II, ap. 4.3.3: cuándo hace falta plan de montaje, utilización y desmontaje. */
export const ANDAMIO_PLAN_RD1215 = tabla(
  {
    db: 'RD 1215/1997',
    edicion: 'consolidado, última modificación 13-11-2004',
    fecha: '2026-10-16',
    articulo: 'anexo II, ap. 4.3.3',
    fuente: BOE,
  },
  {
    /** Andamios apoyados: altura hasta la coronación mayor que esto [m]. */
    altura_m: 6,
    /** …o elementos horizontales que salven vanos de más de esto [m]. Las borriquetas quedan exceptuadas. */
    vano_m: 8,
    /** Andamios sobre azoteas, cúpulas o tejados a más de esto del suelo [m]. */
    sobreCubierta_m: 24,
    /** Torres de acceso y de trabajo móviles con trabajos a más de esto [m]. */
    torreMovil_m: 6,
  },
);

// ── Grúa torre: RD 836/2003 (ITC MIE-AEM-2) ──────────────────────────────────

/** Viento en la grúa torre: límite de trabajo y avisos del anemómetro [km/h]. La grúa móvil remite al fabricante. */
export const VIENTO_GRUA_TORRE = tabla(
  {
    db: 'RD 836/2003',
    edicion: 'consolidado, última modificación 03-09-2025',
    fecha: '2026-10-16',
    articulo: 'ITC MIE-AEM-2, ap. 5.4 y anexo IV',
    fuente: BOE,
  },
  { trabajo_kmh: 72, avisoIntermitente_kmh: 50, avisoContinuo_kmh: 70 },
);

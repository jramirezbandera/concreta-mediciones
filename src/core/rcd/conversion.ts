/* ===========================================================================
   core/rcd/conversion — de la medición de una partida a t y m³ de residuo.

   Un componente (`ComponenteRcd`) dice cómo: por volumen, m² × espesor, peso
   por m² del SE-AE, m × sección, peso por unidad, masa, o valores directos de
   un .bc3. El modo tiene que casar con la unidad de la partida; si no, error
   con motivo. Un dato que falta (`null`) no se rellena: la cantidad que de él
   depende sale `null` y su nombre va a `faltan`, para que el estudio lo pida.

   Cada resultado lleva su cuenta legible («38,5 m² × 0,06 t/m² = 2,31 t»): es la
   misma en la vista, en el detalle de la partida y en el anejo del Word.
   =========================================================================== */
import type { ComponenteRcd, Conversion } from './tipos';

export type UnidadRcd = 'm3' | 'm2' | 'm' | 'ud' | 'kg' | 't' | 'pa' | 'otra';

/** Unidad de la partida, normalizada para el cálculo de residuos. */
export function unidadRcd(ud: string): UnidadRcd {
  const u = ud.trim().toLowerCase().replace(/\.$/, '').replace(/\s+/g, '');
  if (u === 'm3' || u === 'm³') return 'm3';
  if (u === 'm2' || u === 'm²') return 'm2';
  if (u === 'm' || u === 'ml') return 'm';
  if (u === 'ud' || u === 'u' || u === 'uds' || u === 'un' || u === 'unidad') return 'ud';
  if (u === 'kg') return 'kg';
  if (u === 't' || u === 'tn' || u === 'tm') return 't';
  if (u === 'pa' || u === 'p.a') return 'pa';
  return 'otra';
}

/** Modos que admite cada unidad. `directo` vale para todas (lo trae el banco). */
export const MODOS_POR_UNIDAD: Record<UnidadRcd, readonly Conversion['modo'][]> = {
  m3: ['volumen', 'directo'],
  m2: ['espesor', 'pesoSuperficie', 'directo'],
  m: ['seccion', 'pesoUnidad', 'directo'],
  ud: ['pesoUnidad', 'directo'],
  kg: ['masa', 'directo'],
  t: ['masa', 'directo'],
  pa: ['pesoUnidad', 'directo'],
  otra: ['pesoUnidad', 'directo'],
};

export function modoAdmitido(modo: Conversion['modo'], ud: string): boolean {
  return MODOS_POR_UNIDAD[unidadRcd(ud)].includes(modo);
}

const UD_TXT: Record<UnidadRcd, string> = { m3: 'm³', m2: 'm²', m: 'm', ud: 'ud', kg: 'kg', t: 't', pa: 'PA', otra: 'ud' };

/** Número para una cuenta: coma decimal, hasta 4 decimales, sin ceros de cola. */
export function fmtCuenta(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 4, useGrouping: false });
}

export interface ResultadoComponente {
  /** t de residuo; `null` si falta un dato para calcularla. */
  t: number | null;
  m3EnObra: number | null;
  /** Solo en modo `directo` con base aparente (lo da el banco). */
  m3Aparente: number | null;
  formula: string;
  faltan: string[];
}

export type ErrorConversion = { error: string };

const NOMBRE_MODO: Record<Conversion['modo'], string> = {
  volumen: 'por volumen',
  espesor: 'superficie × espesor',
  pesoSuperficie: 'peso por m²',
  seccion: 'longitud × sección',
  pesoUnidad: 'peso por unidad',
  masa: 'por masa',
  directo: 'del banco de precios',
};

/**
 * Residuo de un componente para `cantidad` unidades de la partida.
 * `parte` (0..1) reparte la medición entre varios componentes.
 */
export function convertir(c: ComponenteRcd, cantidad: number, ud: string): ResultadoComponente | ErrorConversion {
  const u = unidadRcd(ud);
  const conv = c.conversion;
  if (!MODOS_POR_UNIDAD[u].includes(conv.modo))
    return { error: `La partida se mide en ${UD_TXT[u]}: no admite «${NOMBRE_MODO[conv.modo]}».` };
  const parte = c.parte ?? 1;
  if (!(parte > 0 && parte <= 1)) return { error: 'El reparto tiene que estar entre 0 y 1.' };
  const q = cantidad * parte;
  const qTxt = parte === 1 ? `${fmtCuenta(cantidad)} ${UD_TXT[u]}` : `${fmtCuenta(cantidad)} ${UD_TXT[u]} × ${fmtCuenta(parte)}`;
  const rho = c.densidad?.tPorM3 ?? null;
  const faltan: string[] = [];
  const res = (t: number | null, m3EnObra: number | null, formula: string, m3Aparente: number | null = null): ResultadoComponente => ({
    t,
    m3EnObra,
    m3Aparente,
    formula,
    faltan,
  });

  switch (conv.modo) {
    case 'volumen': {
      if (rho == null) faltan.push('densidad');
      const t = rho != null ? q * rho : null;
      return res(t, q, t != null ? `${qTxt} × ${fmtCuenta(rho!)} t/m³ = ${fmtCuenta(r3(t))} t` : `${qTxt} (falta la densidad)`);
    }
    case 'espesor': {
      if (conv.espesor == null) faltan.push('espesor');
      if (rho == null) faltan.push('densidad');
      const m3 = conv.espesor != null ? q * conv.espesor : null;
      const t = m3 != null && rho != null ? m3 * rho : null;
      const base = conv.espesor != null ? `${qTxt} × ${fmtCuenta(conv.espesor)} m` : `${qTxt} × (falta el espesor)`;
      return res(t, m3, t != null ? `${base} × ${fmtCuenta(rho!)} t/m³ = ${fmtCuenta(r3(t))} t` : `${base}${rho == null ? ' × (falta la densidad)' : ''}`);
    }
    case 'pesoSuperficie': {
      if (conv.tPorM2 == null) faltan.push('peso por m²');
      const t = conv.tPorM2 != null ? q * conv.tPorM2 : null;
      const m3 = conv.espesor != null ? q * conv.espesor : null;
      return res(t, m3, t != null ? `${qTxt} × ${fmtCuenta(conv.tPorM2!)} t/m² = ${fmtCuenta(r3(t))} t` : `${qTxt} × (falta el peso por m²)`);
    }
    case 'seccion': {
      if (conv.seccion == null) faltan.push('sección');
      if (rho == null) faltan.push('densidad');
      const m3 = conv.seccion != null ? q * conv.seccion : null;
      const t = m3 != null && rho != null ? m3 * rho : null;
      const base = conv.seccion != null ? `${qTxt} × ${fmtCuenta(conv.seccion)} m²` : `${qTxt} × (falta la sección)`;
      return res(t, m3, t != null ? `${base} × ${fmtCuenta(rho!)} t/m³ = ${fmtCuenta(r3(t))} t` : `${base}${rho == null ? ' × (falta la densidad)' : ''}`);
    }
    case 'pesoUnidad': {
      if (conv.kgPorUd == null) faltan.push(u === 'm' ? 'peso por metro' : 'peso por unidad');
      const t = conv.kgPorUd != null ? (q * conv.kgPorUd) / 1000 : null;
      const m3 = conv.m3PorUd != null ? q * conv.m3PorUd : t != null && rho ? t / rho : null;
      const porUd = u === 'm' ? 'kg/m' : 'kg/ud';
      return res(t, m3, t != null ? `${qTxt} × ${fmtCuenta(conv.kgPorUd!)} ${porUd} = ${fmtCuenta(r3(t))} t` : `${qTxt} × (falta el peso)`);
    }
    case 'masa': {
      const t = u === 'kg' ? q / 1000 : q;
      const m3 = rho ? t / rho : null;
      return res(t, m3, u === 'kg' ? `${qTxt} = ${fmtCuenta(r3(t))} t` : `${fmtCuenta(r3(t))} t`);
    }
    case 'directo': {
      const t = q * conv.tPorUd;
      const m3 = q * conv.m3PorUd;
      const formula = `${qTxt} × ${fmtCuenta(r4(conv.tPorUd * 1000))} kg/${UD_TXT[u]} = ${fmtCuenta(r3(t))} t`;
      return conv.m3Base === 'aparente' ? res(t, null, formula, m3) : res(t, m3, formula);
    }
  }
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000;
const r4 = (n: number): number => Math.round(n * 1e4) / 1e4;

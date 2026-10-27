/* ===========================================================================
   core/rcd/ecoeficiencia — estimación por ratios de la herramienta
   «-RCDs =+ ECO-eficiencia» (equipo ECO-ARQ, Universidad de Sevilla; manual de
   2012, hoja de 2013), con el método de Llatas (2011).

   USO PROVISIONAL (plan D8): el manual no permite reproducir sus datos sin
   autorización de la Consejería y de los autores; se usa mientras se pide.

   Reproduce las fórmulas de la hoja (`tablas/ecoeficiencia-2013.json`, que
   extrae `scripts/rcd/extraer_ecoeficiencia.py`):
     · nivel detallado (vivienda de nueva planta), por código:
         V = S · ratio · Π coeficiente(opción elegida)
             + Σ (s_e / S − s_e,ref / S_ref) · f_e · S
       con S la superficie construida y s_e las superficies del proyecto
       (forjados, cubiertas, hoja exterior, particiones, pavimentos) frente a
       las del edificio de referencia; un sumando solo cuenta si se da s_e;
     · tierras: limpieza y desbroce (solar × 0,2), excavación (ocupación ×
       0,75 × coeficiente de cimentación, más arquetas) y vaciado de sótano
       (plantas bajo rasante × 3 m × ocupación);
     · nivel básico (otros usos, rehabilitación, demolición): S · ratio del
       tipo de obra · coeficiente de plantas.
   Los volúmenes son APARENTES (de escombro); t = V · densidad aparente.
   El test los compara con los que calcula la propia hoja en Excel.
   =========================================================================== */
import tabla from './tablas/ecoeficiencia-2013.json';
import type { CodigoLer, GrupoOpcionEco, SuperficieEco, TipoObraEcoBasico } from './tipos';
import { fmtCuenta } from './conversion';

export const ECO_ID: string = tabla.id;
export const ECO_FUENTE = `${tabla.fuente}, ${tabla.autor}. ${tabla.edicion}`;
export const ECO_CITA_CORTA = 'Herramienta -RCDs =+ ECO-eficiencia (ECO-ARQ, Universidad de Sevilla, 2013)';

export interface OpcionEco {
  id: string;
  hoja: string;
}

export const GRUPOS_ECO: readonly GrupoOpcionEco[] = [
  'tipologia',
  'plantas',
  'cimentacion',
  'estructuraVertical',
  'estructuraHorizontal',
  'cubierta',
  'fachada',
  'pavimento',
];

/** Opciones de cada grupo, en el orden de la hoja (el índice manda). */
export function opcionesEco(g: GrupoOpcionEco): readonly OpcionEco[] {
  return (tabla.opciones as Record<GrupoOpcionEco, OpcionEco[]>)[g];
}

/** Opción por defecto de cada grupo: la primera de la hoja. */
export function opcionPorDefecto(g: GrupoOpcionEco): string {
  return opcionesEco(g)[0]!.id;
}

/** Nº de plantas sobre rasante → opción del grupo «plantas». */
export function plantasEco(n: number): string {
  if (n <= 1) return '1';
  if (n <= 3) return '2-3';
  if (n <= 5) return '4-5';
  if (n <= 8) return '6-8';
  return '>8';
}

export interface FilaEco {
  ler: CodigoLer;
  nombre: string;
  grupo: 'envases' | 'restos' | 'tierras';
  m3Aparente: number;
  t: number;
  densidadAparente: number;
  formula: string;
}

export interface EntradaEcoDetallado {
  superficieConstruida: number;
  opciones?: Partial<Record<GrupoOpcionEco, string>>;
  superficies?: Partial<Record<SuperficieEco, number>>;
  superficieSolar?: number | null;
  superficieOcupacion?: number | null;
  plantasBajoRasante?: number;
  /** false: las tierras salen de las partidas de excavación. */
  incluirTierras?: boolean;
}

function indice(g: GrupoOpcionEco, id: string | undefined): number {
  const ops = opcionesEco(g);
  const i = id ? ops.findIndex((o) => o.id === id) : 0;
  return i >= 0 ? i : 0;
}

interface FilaDetallada {
  ler: string;
  nombre: string;
  grupo: string;
  m3PorM2: number;
  densidadAparente: number;
  coef: Record<string, number[]>;
  sumandos: Record<string, number>;
}

/** Nivel detallado: vivienda de nueva planta. */
export function estimarEcoDetallado(e: EntradaEcoDetallado): FilaEco[] {
  const S = e.superficieConstruida;
  if (!(S > 0)) return [];
  const ref = tabla.referencia as Record<string, number>;
  const Sref = ref.superficieConstruida!;
  const sup = e.superficies ?? {};
  const desv = (k: SuperficieEco): number => {
    const s = sup[k];
    return s && s > 0 ? s / S - ref[k]! / Sref : 0;
  };
  const out: FilaEco[] = [];
  for (const f of tabla.detallado as FilaDetallada[]) {
    let coef = 1;
    for (const g of GRUPOS_ECO) coef *= f.coef[g]![indice(g, e.opciones?.[g])]!;
    let v = S * f.m3PorM2 * coef;
    for (const [k, factor] of Object.entries(f.sumandos)) v += desv(k as SuperficieEco) * factor * S;
    if (v <= 0) continue;
    if (f.grupo === 'tierras' && e.incluirTierras === false) continue;
    out.push(fila(f.ler, f.nombre, f.grupo as FilaEco['grupo'], v, f.densidadAparente,
      `${fmtCuenta(S)} m² construidos × ${fmtCuenta(round(v / S, 6))} m³/m²`));
  }
  if (e.incluirTierras !== false) {
    const t = tabla.tierras;
    const solar = e.superficieSolar ?? 0;
    if (solar > 0)
      out.push(fila(t.limpiezaDesbroce.ler, 'Tierras de la limpieza y desbroce', 'tierras', solar * t.limpiezaDesbroce.m3PorM2,
        t.limpiezaDesbroce.densidadAparente, `${fmtCuenta(solar)} m² de solar × ${fmtCuenta(t.limpiezaDesbroce.m3PorM2)} m³/m²`));
    const ocup = e.superficieOcupacion ?? 0;
    if (ocup > 0) {
      const c = t.excavacion.coefCimentacion[indice('cimentacion', e.opciones?.cimentacion)]!;
      const v = ocup * t.excavacion.m3PorM2 * c + desv('arquetas') * (t.excavacion.arquetas ?? 0) * S;
      if (v > 0)
        out.push(fila(t.excavacion.ler, 'Tierras de la excavación', 'tierras', v, t.excavacion.densidadAparente,
          `${fmtCuenta(ocup)} m² de ocupación × ${fmtCuenta(t.excavacion.m3PorM2)} m³/m² × ${fmtCuenta(c)} (cimentación)`));
      const pb = e.plantasBajoRasante ?? 0;
      if (pb > 0)
        out.push(fila(t.vaciadoSotano.ler, 'Tierras del vaciado del sótano', 'tierras', pb * t.vaciadoSotano.alturaPorPlanta * ocup,
          t.vaciadoSotano.densidadAparente, `${fmtCuenta(pb)} planta(s) × ${fmtCuenta(t.vaciadoSotano.alturaPorPlanta)} m × ${fmtCuenta(ocup)} m²`));
    }
  }
  return out;
}

interface FilaBasica {
  ler: string;
  nombre: string;
  densidadAparente: number;
  porTipo: Record<string, number | { estructuraHormigon: number; otraEstructura: number }>;
  /** La hoja no aplica el coeficiente de plantas a áridos, piedras y albero. */
  coefPlantas: boolean;
}

export const OPCIONES_PLANTAS_BASICO: readonly string[] = tabla.basico.coefPlantas.opciones;

/** Nº de plantas sobre rasante → opción de plantas del nivel básico. */
export function plantasEcoBasico(n: number): string {
  if (n <= 1) return '1';
  if (n <= 4) return '2-4';
  return '>4';
}

export interface ExtrasEcoBasico {
  /** Solo en obra nueva: limpieza y excavación salen del solar. */
  superficieSolar?: number | null;
  /** Volumen del vaciado del sótano (m³), tecleado. */
  volumenVaciado?: number | null;
  /** false: las tierras salen de las partidas de excavación. */
  incluirTierras?: boolean;
}

/** Nivel básico: otros usos, rehabilitación y demolición. `superficie` es la
 *  construida, la demolida o la rehabilitada según el tipo. */
export function estimarEcoBasico(
  tipo: TipoObraEcoBasico,
  superficie: number,
  plantas = '1',
  estructuraHormigon = false,
  extras: ExtrasEcoBasico = {},
): FilaEco[] {
  if (!(superficie > 0)) return [];
  const iPl = Math.max(0, OPCIONES_PLANTAS_BASICO.indexOf(plantas));
  const cPl = tabla.basico.coefPlantas.valores[iPl]!;
  const out: FilaEco[] = [];
  for (const f of tabla.basico.filas as FilaBasica[]) {
    const r = f.porTipo[tipo];
    const ratio = typeof r === 'number' ? r : r ? (estructuraHormigon ? r.estructuraHormigon : r.otraEstructura) : 0;
    const c = f.coefPlantas ? cPl : 1;
    const v = superficie * ratio * c;
    if (v <= 0) continue;
    const grupo: FilaEco['grupo'] = f.ler.startsWith('15') ? 'envases' : f.ler.startsWith('17 05') ? 'tierras' : 'restos';
    if (grupo === 'tierras' && extras.incluirTierras === false) continue;
    out.push(fila(f.ler, f.nombre, grupo, v, f.densidadAparente,
      `${fmtCuenta(superficie)} m² × ${fmtCuenta(round(ratio * c, 6))} m³/m²`));
  }
  const nueva = tipo === 'nuevaResidencial' || tipo === 'nuevaNoResidencial';
  if (nueva && extras.incluirTierras !== false) {
    const t = tabla.basico.tierras;
    const solar = extras.superficieSolar ?? 0;
    if (solar > 0) {
      out.push(fila(t.limpiezaDesbroce.ler, 'Tierras de la limpieza y desbroce', 'tierras', solar * t.limpiezaDesbroce.m3PorM2Solar,
        t.limpiezaDesbroce.densidadAparente, `${fmtCuenta(solar)} m² de solar × ${fmtCuenta(t.limpiezaDesbroce.m3PorM2Solar)} m³/m²`));
      out.push(fila(t.excavacion.ler, 'Tierras de la excavación', 'tierras', solar * t.excavacion.m3PorM2Solar,
        t.excavacion.densidadAparente, `${fmtCuenta(solar)} m² de solar × ${fmtCuenta(t.excavacion.m3PorM2Solar)} m³/m²`));
    }
    const vac = extras.volumenVaciado ?? 0;
    if (vac > 0)
      out.push(fila(t.vaciadoSotano.ler, 'Tierras del vaciado del sótano', 'tierras', vac, t.vaciadoSotano.densidadAparente,
        `${fmtCuenta(vac)} m³ de vaciado`));
  }
  return out;
}

function fila(ler: string, nombre: string, grupo: FilaEco['grupo'], v: number, dens: number, base: string): FilaEco {
  const t = v * dens;
  return {
    ler,
    nombre,
    grupo,
    m3Aparente: v,
    t,
    densidadAparente: dens,
    formula: `${base} = ${fmtCuenta(round(v, 3))} m³ × ${fmtCuenta(dens)} t/m³ = ${fmtCuenta(round(t, 3))} t`,
  };
}

const round = (n: number, d: number): number => Math.round(n * 10 ** d) / 10 ** d;

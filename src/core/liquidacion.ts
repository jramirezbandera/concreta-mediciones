/* ===========================================================================
   core/liquidacion — liquidación final: presupuestado frente a ejecutado a
   origen en la ÚLTIMA certificación (docs/plan-liquidacion.md).

   · Lo ejecutado sale del listado de esa certificación (`buildCertListado`):
     cantidades a origen, precios congelados al certificar, partidas cerradas,
     contradictorios y eliminadas. Así la liquidación cuadra al céntimo con la
     certificación que cierra la obra.
   · Lo presupuestado, del presupuesto actual (precio × K), como su documento.
   · Puro y sin React. Importes en céntimos.
   =========================================================================== */
import type { Cert, Chapter, PartidaBaja, PartidasMap, Rates, SubChapter } from './types';
import { buildCertListado } from './listado';
import { partidaImporte } from './medicion';
import { round2, scaleCents, sumCents, type Cents } from './money';
import { costesIndirectos } from './totales';

/** Por debajo de esto, la diferencia de cantidad es redondeo: «igual». */
const TOL = 0.005;

export type EstadoLiquidacion = 'igual' | 'exceso' | 'defecto' | 'noEjecutada' | 'contradictorio' | 'eliminada';

/** Etiqueta del estado en los documentos ('' = nada que señalar). */
export const ESTADO_LIQUIDACION: Record<EstadoLiquidacion, string> = {
  igual: '',
  exceso: 'Exceso',
  defecto: 'Defecto',
  noEjecutada: 'No se ejecuta',
  contradictorio: 'Precio contradictorio',
  eliminada: 'Eliminada del presupuesto',
};

/** Las líneas del resumen económico, en orden, para los tres formatos. */
export const LINEAS_RESUMEN_LIQUIDACION: ReadonlyArray<{ k: keyof LadoLiquidacion; label: string; fuerte?: boolean }> = [
  { k: 'cd', label: 'Costes directos' },
  { k: 'ci', label: 'Costes indirectos' },
  { k: 'pem', label: 'Ejecución material', fuerte: true },
  { k: 'ggbi', label: 'Gastos generales y B.I.' },
  { k: 'pec', label: 'Ejecución por contrata', fuerte: true },
  { k: 'iva', label: 'IVA' },
  { k: 'total', label: 'Total', fuerte: true },
];

export interface LiquidacionFila {
  id: string;
  pos: string;
  code: string;
  title: string;
  ud: string;
  presCant: number;
  /** Precio del presupuesto con K (euros, redondeado). */
  presPrecio: number;
  /** El mismo sin redondear: con K ≠ 1 es el que da el importe (fórmulas del Excel). */
  presPrecioExacto: number;
  presImporte: Cents;
  ejecCant: number;
  /** Precio con el que se certificó (congelado), con K (euros, redondeado). */
  ejecPrecio: number;
  ejecPrecioExacto: number;
  ejecImporte: Cents;
  difCant: number;
  difImporte: Cents;
  /** Ejecutado / presupuestado en %; `null` si no había nada presupuestado. */
  pct: number | null;
  estado: EstadoLiquidacion;
}

export interface LiquidacionGrupo {
  sub: SubChapter | null;
  depth: number;
  rows: LiquidacionFila[];
}

export interface LiquidacionCapitulo {
  id: string;
  code: string;
  title: string;
  grupos: LiquidacionGrupo[];
  pres: Cents;
  ejec: Cents;
}

/** Un lado del resumen económico. */
export interface LadoLiquidacion {
  cd: Cents;
  ci: Cents;
  pem: Cents;
  ggbi: Cents;
  pec: Cents;
  iva: Cents;
  total: Cents;
}

export interface Liquidacion {
  /** Número y periodo de la certificación de la que sale. */
  certNum: number;
  certPeriod: string;
  capitulos: LiquidacionCapitulo[];
  pres: LadoLiquidacion;
  ejec: LadoLiquidacion;
  /** Garantía retenida acumulada hasta esa cert; `null` si la obra no retuvo. */
  retenido: Cents | null;
  cuenta: Record<EstadoLiquidacion, number>;
  rates: Rates;
}

function estadoDe(presCant: number, ejecCant: number, cerrada: boolean): EstadoLiquidacion {
  if (cerrada && ejecCant === 0) return 'noEjecutada';
  const dif = ejecCant - presCant;
  if (Math.abs(dif) <= TOL) return 'igual';
  return dif > 0 ? 'exceso' : 'defecto';
}

function lado(cd: Cents, rates: Rates): LadoLiquidacion {
  const ci = costesIndirectos(cd, rates);
  const pem = cd + ci;
  const ggbi = scaleCents(pem, rates.gg + rates.bi);
  const pec = pem + ggbi;
  const iva = scaleCents(pec, rates.iva);
  return { cd, ci, pem, ggbi, pec, iva, total: pec + iva };
}

/** Liquidación con la última certificación; `null` si no hay ninguna. */
export function buildLiquidacion(
  chapters: Chapter[],
  partidas: PartidasMap,
  certs: Cert[],
  rates: Rates,
  bajas: Record<string, PartidaBaja> = {},
): Liquidacion | null {
  const index = certs.length - 1;
  const cl = buildCertListado(chapters, partidas, certs, index, rates, bajas);
  if (!cl) return null;
  const porId = new Map(
    Object.values(partidas)
      .flat()
      .map((p) => [p.id, p]),
  );
  const cuenta: Record<EstadoLiquidacion, number> = {
    igual: 0,
    exceso: 0,
    defecto: 0,
    noEjecutada: 0,
    contradictorio: 0,
    eliminada: 0,
  };
  const fila = (f: Omit<LiquidacionFila, 'difCant' | 'difImporte' | 'pct'>): LiquidacionFila => {
    cuenta[f.estado] += 1;
    return {
      ...f,
      difCant: round2(f.ejecCant - f.presCant),
      difImporte: f.ejecImporte - f.presImporte,
      pct: f.presCant > 0 ? (f.ejecCant / f.presCant) * 100 : null,
    };
  };

  const capitulos = cl.capitulos.map((c): LiquidacionCapitulo => {
    const eliminado = !chapters.some((ch) => ch.id === c.id);
    const grupos = c.grupos.map(
      (g): LiquidacionGrupo => ({
        sub: g.sub,
        depth: g.depth,
        rows: g.rows.map((r) => {
          const p = porId.get(r.id);
          return fila({
            id: r.id,
            pos: r.pos,
            code: r.code,
            title: r.title,
            ud: r.ud,
            presCant: p ? r.ofertada : 0,
            presPrecio: p ? round2((p.precio ?? 0) * rates.coefK) : 0,
            presPrecioExacto: p ? (p.precio ?? 0) * rates.coefK : 0,
            presImporte: p ? partidaImporte(p, rates.coefK) : 0,
            ejecCant: r.ejecutada,
            ejecPrecio: r.precio,
            ejecPrecioExacto: r.precioExacto,
            ejecImporte: r.aOrigen,
            estado: eliminado || !p ? 'eliminada' : estadoDe(r.ofertada, r.ejecutada, r.cerrada),
          });
        }),
      }),
    );
    if (c.extras.length) {
      grupos.push({
        sub: null,
        depth: 0,
        rows: c.extras.map((e) =>
          fila({
            id: e.id,
            pos: e.pos,
            code: 'P.C.',
            title: e.title,
            ud: e.ud,
            presCant: 0,
            presPrecio: 0,
            presPrecioExacto: 0,
            presImporte: 0,
            ejecCant: e.cantidad,
            ejecPrecio: e.precio,
            ejecPrecioExacto: e.precio,
            ejecImporte: e.aOrigen,
            estado: eliminado ? 'eliminada' : 'contradictorio',
          }),
        ),
      });
    }
    const filas = grupos.flatMap((g) => g.rows);
    return {
      id: c.id,
      code: c.code,
      title: c.title,
      grupos,
      pres: sumCents(filas.map((r) => r.presImporte)),
      ejec: sumCents(filas.map((r) => r.ejecImporte)),
    };
  });

  // Capítulos del presupuesto que la certificación no lista (vacíos): no aportan nada.
  const presCD = sumCents(capitulos.map((c) => c.pres));
  const ejecCD = sumCents(capitulos.map((c) => c.ejec));
  return {
    certNum: cl.num,
    certPeriod: cl.period,
    capitulos,
    pres: lado(presCD, rates),
    ejec: lado(ejecCD, rates),
    retenido: cl.retenidoAcumulado,
    cuenta,
    rates,
  };
}

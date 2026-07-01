/* ===========================================================================
   core/listado — modelos de FILAS de presentación para los exportadores (F7).
   ---------------------------------------------------------------------------
   PDF (doc de impresión), XLSX y DOCX comparten estas filas y el contrato de
   metadatos de obra (eng-review F7 §4); el BC3 NO pasa por aquí (serializa el
   grafo semántico directamente del modelo de dominio). Puro y sin React: los
   IMPORTES van en CÉNTIMOS y cada exportador los formatea a su manera.
   =========================================================================== */
import type { Cert, Chapter, Obra, PartidasMap, Rates, SubChapter } from './types';
import {
  certCalc,
  certPrecioK,
  certSnapshotOf,
  certTotals,
  extraCalc,
  extrasCantidad,
  prevDataOf,
  type CertTotals,
} from './certificacion';
import { groupBySub } from './grouping';
import { lineParcial, partidaCantidad, partidaImporte } from './medicion';
import { chapterTotals } from './totales';
import { rollupByDepth } from './tree';
import { round2, scaleCents, sumCents, type Cents } from './money';

/* ---- Metadatos de obra (contrato COMPARTIDO por PDF/XLSX/DOCX) ------------ */

export interface ObraMeta {
  denominacion: string;
  direccion: string;
  localidad: string;
  provincia: string;
  expediente: string;
  promotor: string;
  constructora: string;
  /** Técnico redactor, con nº de colegiado si lo hay ("Nombre · col. 1234"). */
  redactor: string;
  /** "Lugar, fecha" para el pie de firma ('' si ambos vacíos). */
  lugarFecha: string;
}

/** Lee una ruta anidada de la obra; '' si falta o no es string (como ObraModal). */
function str(obj: unknown, path: string): string {
  const v = path
    .split('.')
    .reduce<unknown>(
      (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
      obj,
    );
  return typeof v === 'string' ? v : '';
}

/** Metadatos de cabecera del documento (rutas del modal Datos de la obra). */
export function obraMeta(obra: Obra): ObraMeta {
  const redactor = str(obra, 'redactor.nombre');
  const colegiado = str(obra, 'redactor.colegiado');
  return {
    denominacion: str(obra, 'denominacion'),
    direccion: str(obra, 'direccion'),
    localidad: str(obra, 'localidad'),
    provincia: str(obra, 'provincia'),
    expediente: str(obra, 'expediente'),
    promotor: str(obra, 'promotor.nombre'),
    constructora: str(obra, 'constructor.nombre'),
    redactor: redactor && colegiado ? `${redactor} · col. ${colegiado}` : redactor,
    lugarFecha: [str(obra, 'lugar'), str(obra, 'fecha')].filter(Boolean).join(', '),
  };
}

/* ---- Presupuesto y mediciones (doc COMBINADO, eng-review F7 §7) ----------- */

export interface MedLineListado {
  id: string;
  comment: string;
  /** uds · largo · ancho · alto (vacío = factor 1, igual que la medición). */
  dims: (number | '')[];
  parcial: number;
}

export interface PartidaListadoRow {
  id: string;
  pos: string;
  code: string;
  title: string;
  desc: string;
  ud: string;
  cantidad: number;
  /** Precio unitario efectivo en euros (CON coeficiente K), redondeado a 2 dec. */
  precio: number;
  importe: Cents;
  med: MedLineListado[];
}

export interface GrupoListado {
  sub: SubChapter | null;
  /** 0 = grupo sin sub (directas del capítulo); 1 = sub; 2 = sub-sub… */
  depth: number;
  /** Filas DIRECTAS del contenedor (las de los descendientes van en sus grupos). */
  rows: PartidaListadoRow[];
  /** Importe ACUMULADO del subárbol (directas + descendientes): lo que pinta
   *  la cabecera del grupo. El total del capítulo NO es Σ de estos (sería
   *  doble cuenta): es la Σ de las filas directas de todos los grupos. */
  total: Cents;
}

export interface CapituloListado {
  id: string;
  code: string;
  title: string;
  grupos: GrupoListado[];
  total: Cents;
}

export interface PresupuestoListado {
  capitulos: CapituloListado[];
  pem: Cents;
}

/**
 * Filas del doc "Presupuesto y mediciones": cada partida con su precio y sus
 * líneas de medición debajo. Los capítulos VACÍOS no salen en el documento
 * (aportan 0 y ensucian el papel); el PEM no cambia por filtrarlos.
 */
export function buildPresupuestoListado(
  chapters: Chapter[],
  partidas: PartidasMap,
  coefK = 1,
): PresupuestoListado {
  const capitulos = chapters
    .map((ch) => {
      const gs = groupBySub(ch, partidas[ch.id] ?? []);
      const rowsPorGrupo = gs.map((g) =>
        g.items.map(
          (p): PartidaListadoRow => ({
            id: p.id,
            pos: p.pos,
            code: p.code,
            title: p.title,
            desc: p.desc,
            ud: p.ud,
            cantidad: partidaCantidad(p),
            precio: round2((p.precio ?? 0) * coefK),
            importe: partidaImporte(p, coefK),
            med: p.med.map((l) => ({
              id: l.id,
              comment: l.comment,
              dims: [l.uds, l.largo, l.ancho, l.alto],
              parcial: lineParcial(l),
            })),
          }),
        ),
      );
      const directos = rowsPorGrupo.map((rows) => sumCents(rows.map((r) => r.importe)));
      const acumulados = rollupByDepth(gs, directos);
      const cuenta = rollupByDepth(
        gs,
        gs.map((g) => g.items.length),
      );
      // Un contenedor intermedio sin filas directas pero CON descendientes se
      // conserva (su cabecera da contexto); solo caen los subárboles vacíos.
      const grupos = gs
        .map((g, i) => ({ sub: g.sub, depth: g.depth, rows: rowsPorGrupo[i]!, total: acumulados[i]! }))
        .filter((_, i) => cuenta[i]! > 0);
      return {
        id: ch.id,
        code: ch.code,
        title: ch.title,
        grupos,
        // Σ de filas DIRECTAS de todos los grupos: cada partida cuenta una vez.
        total: sumCents(directos),
      };
    })
    .filter((c) => c.grupos.length > 0);
  return { capitulos, pem: sumCents(capitulos.map((c) => c.total)) };
}

/* ---- Resumen de presupuesto ------------------------------------------------ */

export interface ResumenRow {
  id: string;
  code: string;
  title: string;
  importe: Cents;
  /** Peso sobre el PEM (0–100). */
  pct: number;
}

export interface ResumenListado {
  rows: ResumenRow[];
  pem: Cents;
  gg: Cents;
  bi: Cents;
  pec: Cents;
  iva: Cents;
  total: Cents;
  /** Tasas con las que se calculó (la hoja pinta los % editables/estáticos). */
  rates: Rates;
}

/**
 * Hoja resumen (port de resumen.jsx): desglose por capítulos + PEM → GG → BI →
 * PEC → IVA → total. GG y BI se redondean POR LÍNEA (como el prototipo): la
 * suma de las líneas mostradas ES el PEC mostrado (coherencia del documento).
 * Puede diferir ±1 cént. de `totales.pec` (que redondea gg+bi juntos).
 * A diferencia del presupuesto, lista TODOS los capítulos (es la estructura
 * de la obra, también los aún vacíos).
 */
export function buildResumen(
  chapters: Chapter[],
  partidas: PartidasMap,
  rates: Rates,
): ResumenListado {
  const totals = chapterTotals(partidas, rates.coefK);
  const pem = sumCents(chapters.map((ch) => totals[ch.id] ?? 0));
  const rows = chapters.map((ch) => {
    const importe = totals[ch.id] ?? 0;
    return {
      id: ch.id,
      code: ch.code,
      title: ch.title,
      importe,
      pct: pem > 0 ? (importe / pem) * 100 : 0,
    };
  });
  const gg = scaleCents(pem, rates.gg);
  const bi = scaleCents(pem, rates.bi);
  const pec = pem + gg + bi;
  const iva = scaleCents(pec, rates.iva);
  return { rows, pem, gg, bi, pec, iva, total: pec + iva, rates };
}

/* ---- Certificación (con snapshot de precios F7.0 + contradictorios) ------- */

export interface CertListadoRow {
  id: string;
  pos: string;
  code: string;
  title: string;
  ud: string;
  ofertada: number;
  ejecutada: number;
  pct: number;
  /** Precio efectivo de la cert en euros: congelado si hay snapshot (F7.0). */
  precio: number;
  aOrigen: Cents;
  anterior: Cents;
  estaCert: Cents;
}

export interface CertExtraListadoRow {
  id: string;
  pos: string;
  title: string;
  ud: string;
  cantidad: number;
  precio: number;
  aOrigen: Cents;
  anterior: Cents;
  estaCert: Cents;
}

export interface CertGrupoListado {
  sub: SubChapter | null;
  /** 0 = grupo sin sub; 1 = sub; 2 = sub-sub… (sangría en los documentos). */
  depth: number;
  rows: CertListadoRow[];
}

export interface CertCapituloListado {
  id: string;
  code: string;
  title: string;
  grupos: CertGrupoListado[];
  /** Precios contradictorios del capítulo (P.C., cert-local). */
  extras: CertExtraListadoRow[];
  aOrigen: Cents;
  anterior: Cents;
  estaCert: Cents;
}

export interface CertListado {
  num: number;
  period: string;
  retencion: number;
  /** Fecha del snapshot de precios (F7.0) — el doc la estampa (trazabilidad). */
  snapshotAt?: string;
  capitulos: CertCapituloListado[];
  totals: CertTotals;
}

/**
 * Filas del doc de certificación nº `index`: por capítulo (partidas con
 * ofertada/ejecutada/% y la doble semántica a-origen/anterior/esta cert,
 * valoradas con el snapshot de precios de la cert si lo tiene — F7.0) más sus
 * contradictorios. `null` si el índice no existe.
 */
export function buildCertListado(
  chapters: Chapter[],
  partidas: PartidasMap,
  certs: Cert[],
  index: number,
  rates: Rates,
): CertListado | null {
  const cert = certs[index];
  if (!cert) return null;
  const prevData = prevDataOf(certs, index);
  const prevExtras = index > 0 ? (certs[index - 1]?.extras ?? []) : [];
  const extras = cert.extras ?? [];
  const snap = certSnapshotOf(cert, rates.coefK);
  const prevExtraCant = extrasCantidad(prevExtras);

  const capitulos = chapters
    .map((ch) => {
      const gs = groupBySub(ch, partidas[ch.id] ?? []);
      const cuenta = rollupByDepth(
        gs,
        gs.map((g) => g.items.length),
      );
      const grupos = gs
        .filter((_, i) => cuenta[i]! > 0) // conserva contenedores con descendientes
        .map((g) => ({
          sub: g.sub,
          depth: g.depth,
          rows: g.items.map((p): CertListadoRow => {
            const k = certCalc(p, cert.data, prevData, rates.coefK, snap);
            return {
              id: p.id,
              pos: p.pos,
              code: p.code,
              title: p.title,
              ud: p.ud,
              ofertada: k.ofertada,
              ejecutada: k.ejecutada,
              pct: k.pct,
              precio: round2(certPrecioK(p, rates.coefK, snap)),
              aOrigen: k.aOrigen,
              anterior: k.anterior,
              estaCert: k.estaCert,
            };
          }),
        }));
      const chapExtras = extras
        .filter((e) => e.chapterId === ch.id)
        .map((e): CertExtraListadoRow => {
          const k = extraCalc(e, prevExtraCant[e.id] ?? 0);
          return {
            id: e.id,
            pos: e.pos,
            title: e.title,
            ud: e.ud,
            cantidad: e.cantidad,
            precio: e.precio,
            aOrigen: k.aOrigen,
            anterior: k.anterior,
            estaCert: k.estaCert,
          };
        });
      const all = [...grupos.flatMap((g) => g.rows), ...chapExtras];
      return {
        id: ch.id,
        code: ch.code,
        title: ch.title,
        grupos,
        extras: chapExtras,
        aOrigen: sumCents(all.map((r) => r.aOrigen)),
        anterior: sumCents(all.map((r) => r.anterior)),
        estaCert: sumCents(all.map((r) => r.estaCert)),
      };
    })
    .filter((c) => c.grupos.length > 0 || c.extras.length > 0);

  return {
    num: cert.num,
    period: cert.period,
    retencion: cert.retencion,
    snapshotAt: cert.snapshotAt,
    capitulos,
    totals: certTotals(
      Object.values(partidas).flat(),
      cert.data,
      prevData,
      rates,
      cert.retencion,
      rates.coefK,
      extras,
      prevExtras,
      snap,
      cert.ajustes ?? [],
    ),
  };
}

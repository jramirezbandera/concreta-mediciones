/* ===========================================================================
   features/exportar/xlsxBuilders — filas XLSX desde `core/listado` (F7.2).
   ---------------------------------------------------------------------------
   PURO (sin la librería en runtime: solo type-imports → no entra al bundle).
   POLÍTICA NUMÉRICA EXPLÍCITA (eng-review F7): cantidades, precios e importes
   van como CELDAS NUMÉRICAS (`type: Number`) con formato `#,##0.00` (Excel lo
   pinta es-ES: 1.234,56), NUNCA strings preformateados. Los importes llegan en
   céntimos (enteros exactos) y se convierten a euros con `toEur` justo al
   emitir la celda: la división entre 100 es la única operación de float y es
   exacta a 2 decimales.
   =========================================================================== */
import type { CellObject, Row } from 'write-excel-file/browser';
import type {
  CertListado,
  ObraMeta,
  PresupuestoListado,
  ResumenListado,
} from '../../core/listado';
import type { MedLineListado } from '../../core/listado';
import { toEur, type Cents } from '../../core/money';
import { docFileName } from './fileName';

/** Formato Excel de dinero/cantidades: 2 dec + miles (es-ES: 1.234,56). */
export const FMT_NUM = '#,##0.00';
/** Formato Excel de porcentaje ya expresado 0–100 (50,0%). */
export const FMT_PCT = '#,##0.0"%"';

const GRIS = '#64748b';
const BANDA = '#eef1f6';

/** Documento XLSX listo para `writeXlsxFile` (una hoja). */
export interface XlsxDoc {
  fileName: string;
  sheet: string;
  columns: { width?: number }[];
  rows: Row[];
}

/* ---- celdas ---------------------------------------------------------------- */

function txt(value: string, over: Partial<CellObject> = {}): CellObject {
  return { value, type: String, ...over };
}

/** Celda de dinero: euros NUMÉRICOS desde céntimos (política numérica F7.2). */
function eur(c: Cents, over: Partial<CellObject> = {}): CellObject {
  return { value: toEur(c), type: Number, format: FMT_NUM, align: 'right', ...over };
}

/** Celda numérica de cantidad (medición/rendimiento/ejecutada). */
function num(value: number, over: Partial<CellObject> = {}): CellObject {
  return { value, type: Number, format: FMT_NUM, align: 'right', ...over };
}

function bold(cell: CellObject): CellObject {
  return { ...cell, fontWeight: 'bold' };
}

/** Nombre de archivo .xlsx (sanitizado en `fileName.ts`, compartido con DOCX). */
export function xlsxFileName(titulo: string, denominacion: string): string {
  return docFileName(titulo, denominacion, 'xlsx');
}

/** ISO → dd/mm/aaaa ('' si falta/inválida). */
function fechaCorta(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES');
}

/** Cabecera compartida del documento (contrato de metadatos §4, como el PDF). */
function metaRows(titulo: string, meta: ObraMeta, extra: [string, string][] = []): Row[] {
  const pares: [string, string][] = [
    ['Expediente', meta.expediente],
    ['Promotor', meta.promotor],
    ['Constructora', meta.constructora],
    ['Técnico', meta.redactor],
    ...extra,
  ].filter((p): p is [string, string] => Boolean(p[1]));
  const dir = [meta.direccion, [meta.localidad, meta.provincia].filter(Boolean).join(' · ')]
    .filter(Boolean)
    .join(' · ');
  return [
    [txt(titulo.toUpperCase(), { textColor: GRIS, fontSize: 9 })],
    [txt(meta.denominacion || 'Obra sin denominación', { fontWeight: 'bold', fontSize: 14 })],
    ...(dir ? [[txt(dir, { textColor: GRIS })]] : []),
    ...pares.map((p): Row => [txt(p[0], { fontWeight: 'bold', fontSize: 9 }), txt(p[1], { columnSpan: 3 }), null, null]),
    [],
  ];
}

/* ---- Presupuesto y mediciones ---------------------------------------------- */

function medLabel(l: MedLineListado): string {
  const dims = l.dims
    .filter((v) => v !== '' && v != null)
    .map((v) => String(v).replace('.', ','))
    .join(' × ');
  const comment = l.comment || 'Sin comentario';
  return dims ? `${comment} — ${dims}` : comment;
}

/** Sangría de cabecera de grupo por profundidad (NBSP: Excel no la recorta). */
function sangria(depth: number): string {
  return '   '.repeat(Math.max(0, depth - 1));
}

export function buildPresupuestoXlsx(data: PresupuestoListado, meta: ObraMeta): XlsxDoc {
  const rows: Row[] = metaRows('Presupuesto y mediciones', meta);
  const header: Row = [
    txt('Nº', { fontWeight: 'bold', backgroundColor: BANDA }),
    txt('Código', { fontWeight: 'bold', backgroundColor: BANDA }),
    txt('Descripción', { fontWeight: 'bold', backgroundColor: BANDA }),
    txt('Ud.', { fontWeight: 'bold', backgroundColor: BANDA }),
    txt('Cantidad', { fontWeight: 'bold', backgroundColor: BANDA, align: 'right' }),
    txt('Precio', { fontWeight: 'bold', backgroundColor: BANDA, align: 'right' }),
    txt('Importe', { fontWeight: 'bold', backgroundColor: BANDA, align: 'right' }),
  ];
  for (const c of data.capitulos) {
    rows.push([
      txt(c.code, { fontWeight: 'bold' }),
      txt(c.title, { fontWeight: 'bold', columnSpan: 5 }),
      null,
      null,
      null,
      null,
      bold(eur(c.total)),
    ]);
    rows.push(header);
    for (const g of c.grupos) {
      if (g.sub) {
        rows.push([
          txt(sangria(g.depth) + g.sub.code, { textColor: GRIS, fontWeight: 'bold' }),
          txt(g.sub.title.toUpperCase(), { textColor: GRIS, fontWeight: 'bold', columnSpan: 5 }),
          null,
          null,
          null,
          null,
          eur(g.total, { textColor: GRIS }),
        ]);
      }
      for (const r of g.rows) {
        rows.push([
          txt(r.pos),
          txt(r.code),
          txt(r.title, { wrap: true }),
          txt(r.ud),
          num(r.cantidad),
          num(r.precio),
          eur(r.importe),
        ]);
        if (r.desc) {
          rows.push([null, null, txt(r.desc, { textColor: GRIS, fontSize: 9, wrap: true, columnSpan: 5 }), null, null, null, null]);
        }
        for (const l of r.med) {
          rows.push([
            null,
            null,
            txt(medLabel(l), { textColor: GRIS, fontSize: 9, indent: 1 }),
            null,
            num(l.parcial, { textColor: GRIS, fontSize: 9 }),
            null,
            null,
          ]);
        }
      }
    }
    rows.push([
      null,
      null,
      txt(`Total capítulo ${c.code} · ${c.title}`, { fontWeight: 'bold', columnSpan: 4 }),
      null,
      null,
      null,
      bold(eur(c.total, { topBorderStyle: 'thin' })),
    ]);
    rows.push([]);
  }
  rows.push([
    null,
    null,
    txt('Presupuesto de Ejecución Material (PEM)', { fontWeight: 'bold', columnSpan: 4 }),
    null,
    null,
    null,
    bold(eur(data.pem, { topBorderStyle: 'medium' })),
  ]);
  return {
    fileName: xlsxFileName('Presupuesto y mediciones', meta.denominacion),
    sheet: 'Presupuesto',
    columns: [{ width: 9 }, { width: 12 }, { width: 56 }, { width: 6 }, { width: 11 }, { width: 11 }, { width: 13 }],
    rows,
  };
}

/* ---- Resumen de presupuesto ------------------------------------------------ */

export function buildResumenXlsx(data: ResumenListado, meta: ObraMeta): XlsxDoc {
  const rows: Row[] = metaRows('Resumen de presupuesto', meta);
  rows.push([
    txt('Capítulo', { fontWeight: 'bold', backgroundColor: BANDA, columnSpan: 2 }),
    null,
    txt('% PEM', { fontWeight: 'bold', backgroundColor: BANDA, align: 'right' }),
    txt('Importe', { fontWeight: 'bold', backgroundColor: BANDA, align: 'right' }),
  ]);
  for (const r of data.rows) {
    rows.push([
      txt(r.code),
      txt(r.title, { wrap: true }),
      { value: r.pct, type: Number, format: FMT_PCT, align: 'right', textColor: GRIS },
      eur(r.importe),
    ]);
  }
  rows.push([]);
  const linea = (
    label: string,
    value: Cents,
    opts: { rate?: number; strong?: boolean } = {},
  ): Row => [
    null,
    txt(label, { fontWeight: opts.strong ? 'bold' : undefined }),
    opts.rate != null
      ? { value: opts.rate * 100, type: Number, format: FMT_PCT, align: 'right', textColor: GRIS }
      : null,
    opts.strong ? bold(eur(value, { topBorderStyle: 'thin' })) : eur(value),
  ];
  rows.push(linea('Presupuesto de Ejecución Material (PEM)', data.pem, { strong: true }));
  rows.push(linea('Gastos generales', data.gg, { rate: data.rates.gg }));
  rows.push(linea('Beneficio industrial', data.bi, { rate: data.rates.bi }));
  rows.push(linea('Presupuesto de Ejecución por Contrata (s/ IVA)', data.pec, { strong: true }));
  rows.push(linea('IVA', data.iva, { rate: data.rates.iva }));
  rows.push(linea('Presupuesto base de licitación', data.total, { strong: true }));
  return {
    fileName: xlsxFileName('Resumen de presupuesto', meta.denominacion),
    sheet: 'Resumen',
    columns: [{ width: 9 }, { width: 48 }, { width: 10 }, { width: 14 }],
    rows,
  };
}

/* ---- Certificación ----------------------------------------------------------- */

export function buildCertXlsx(data: CertListado, meta: ObraMeta): XlsxDoc {
  const congelados = fechaCorta(data.snapshotAt);
  const extra: [string, string][] = [
    ['Periodo', data.period],
    ['Precios congelados', congelados],
  ];
  const rows: Row[] = metaRows(`Certificación de obra nº ${data.num}`, meta, extra);
  const header: Row = [
    'Nº',
    'Código',
    'Descripción',
    'Ud.',
    'Ofertada',
    'Ejecutada',
    '%',
    'Precio',
    'A origen',
    'Anterior',
    'Esta cert.',
  ].map((h, i) =>
    txt(h, { fontWeight: 'bold', backgroundColor: BANDA, align: i >= 4 ? 'right' : 'left' }),
  );
  for (const c of data.capitulos) {
    rows.push([
      txt(c.code, { fontWeight: 'bold' }),
      txt(c.title, { fontWeight: 'bold', columnSpan: 7 }),
      null,
      null,
      null,
      null,
      null,
      null,
      bold(eur(c.aOrigen)),
      bold(eur(c.anterior)),
      bold(eur(c.estaCert)),
    ]);
    rows.push(header);
    for (const g of c.grupos) {
      if (g.sub) {
        rows.push([
          txt(sangria(g.depth) + g.sub.code, { textColor: GRIS, fontWeight: 'bold' }),
          txt(g.sub.title.toUpperCase(), { textColor: GRIS, fontWeight: 'bold', columnSpan: 10 }),
          ...Array<null>(9).fill(null),
        ]);
      }
      for (const r of g.rows) {
        rows.push([
          txt(r.pos),
          txt(r.code),
          txt(r.title, { wrap: true }),
          txt(r.ud),
          num(r.ofertada),
          num(r.ejecutada),
          { value: r.pct, type: Number, format: FMT_PCT, align: 'right', textColor: GRIS },
          num(r.precio),
          eur(r.aOrigen),
          eur(r.anterior),
          eur(r.estaCert),
        ]);
      }
    }
    for (const e of c.extras) {
      rows.push([
        txt(e.pos),
        txt('P.C.', { textColor: '#b45309', fontWeight: 'bold' }),
        txt(e.title || 'Precio contradictorio', { wrap: true }),
        txt(e.ud),
        null,
        num(e.cantidad),
        null,
        num(e.precio),
        eur(e.aOrigen),
        eur(e.anterior),
        eur(e.estaCert),
      ]);
    }
    rows.push([
      null,
      null,
      txt(`Total capítulo ${c.code}`, { fontWeight: 'bold', columnSpan: 6 }),
      ...Array<null>(5).fill(null),
      bold(eur(c.aOrigen, { topBorderStyle: 'thin' })),
      bold(eur(c.anterior, { topBorderStyle: 'thin' })),
      bold(eur(c.estaCert, { topBorderStyle: 'thin' })),
    ]);
    rows.push([]);
  }
  const t = data.totals;
  const fila = (label: string, value: Cents, strong = false): Row => [
    ...Array<null>(7).fill(null),
    txt(label, { fontWeight: strong ? 'bold' : undefined, columnSpan: 3 }),
    null,
    null,
    strong ? bold(eur(value, { topBorderStyle: 'thin' })) : eur(value),
  ];
  rows.push(fila('Ejecución material a origen', t.certPEM, true));
  rows.push(fila('Gastos generales y B.I.', t.ggbiOrigen));
  rows.push(fila('Ejecución por contrata a origen', t.pecOrigen));
  rows.push(fila('Certificado anterior', -t.pecPrev));
  rows.push(fila('Esta certificación', t.pecEsta, true));
  rows.push(fila(`Retención (${(data.retencion * 100).toLocaleString('es-ES')}%)`, -t.retencion));
  for (const a of t.ajustesRows) rows.push(fila(a.label || 'Ajuste', a.signo * a.importe));
  rows.push(fila('Base imponible', t.base));
  rows.push(fila('IVA', t.iva));
  rows.push(fila('Líquido a abonar', t.liquido, true));
  return {
    fileName: xlsxFileName(`Certificación nº ${data.num}`, meta.denominacion),
    sheet: `Certificación ${data.num}`,
    columns: [
      { width: 9 },
      { width: 12 },
      { width: 42 },
      { width: 6 },
      { width: 10 },
      { width: 10 },
      { width: 8 },
      { width: 10 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
    ],
    rows,
  };
}

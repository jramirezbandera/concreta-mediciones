/* ===========================================================================
   features/exportar/docxRender — documentos Word desde `core/listado` (F7.3).
   ---------------------------------------------------------------------------
   Importa `docx` ESTÁTICAMENTE, pero este módulo solo se alcanza por IMPORT
   DINÁMICO (`exportDocx` en docx.ts) → la librería entera vive en un chunk
   aparte, fuera del bundle inicial (eng-review F7).

   La FIDELIDAD Word es el trabajo duro (eng-review F7.3): página A4 con los
   mismos márgenes que el doc de impresión, banda de capítulo + cabecera de
   columnas marcadas `tableHeader` (se REPITEN en cada página), filas con
   `cantSplit` (no parten entre páginas), descripciones largas envueltas en la
   celda. En Word los números son TEXTO: aquí sí se formatea es-ES con
   `fmtNum`/`fmtCents` (a diferencia del XLSX, que exige celdas numéricas).
   =========================================================================== */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import {
  buildCertListado,
  buildPresupuestoListado,
  buildResumen,
  obraMeta,
  type CertListado,
  type MedLineListado,
  type ObraMeta,
  type PresupuestoListado,
  type ResumenListado,
} from '../../core/listado';
import { fmtCents, fmtNum, type Cents } from '../../core/money';
import type { Banco, Cert, Chapter, Obra, PartidasMap, Rates } from '../../core/types';
import type { PrintTarget } from '../print';
import { docFileName } from './fileName';

/* ---- constantes de página y paleta (espejo del doc de impresión) ---------- */

// Twips: A4 (210×297 mm) con márgenes 14/12/16/12 mm → contenido 10546.
const PAGE = { width: 11906, height: 16838 };
const MARGIN = { top: 794, right: 680, bottom: 907, left: 680 };

// Tamaños en MEDIOS puntos (docx): 9pt cuerpo, 8pt tablas densas, 16pt título.
const T_TITULO = 32;
const T_BODY = 18;
const T_SMALL = 16;
const T_TINY = 14;

const NEGRO = '111827';
const GRIS = '64748B';
const BORDE = 'D8DEE6';
const BANDA = 'EEF1F6';
const ACENTO = '2563EB';
const WARN = 'B45309';

interface RunOpts {
  bold?: boolean;
  color?: string;
  size?: number;
}

function run(text: string, o: RunOpts = {}): TextRun {
  return new TextRun({ text, bold: o.bold, color: o.color ?? NEGRO, size: o.size ?? T_BODY });
}

function paraRuns(children: TextRun[], align?: (typeof AlignmentType)[keyof typeof AlignmentType]) {
  return new Paragraph({ alignment: align, children });
}

interface CellOpts extends RunOpts {
  width: number;
  right?: boolean;
  fill?: string;
  span?: number;
  topBorder?: boolean;
}

/** Celda de un solo texto (la variante multi-párrafo usa `cellPars`). */
function cell(text: string, o: CellOpts): TableCell {
  return cellPars([paraRuns([run(text, o)], o.right ? AlignmentType.RIGHT : undefined)], o);
}

function cellPars(children: Paragraph[], o: CellOpts): TableCell {
  return new TableCell({
    // Las celdas con columnSpan (width 0) dejan que Word reparta el ancho.
    width: o.width > 0 ? { size: o.width, type: WidthType.DXA } : undefined,
    columnSpan: o.span,
    shading: o.fill ? { fill: o.fill } : undefined,
    borders: o.topBorder
      ? { top: { style: BorderStyle.SINGLE, size: 6, color: NEGRO } }
      : undefined,
    children,
  });
}

/** Tabla del listado: ancho fijo, sin verticales, horizontales finas. */
function tabla(columnWidths: number[], rows: TableRow[]): Table {
  return new Table({
    width: { size: columnWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: BORDE },
    },
    rows,
  });
}

const vacio = (spacing = 120) => new Paragraph({ spacing: { after: spacing }, children: [] });

/** ISO → dd/mm/aaaa ('' si falta/inválida). */
function fechaCorta(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES');
}

/* ---- cabecera y firma compartidas (contrato de metadatos §4) -------------- */

function cabecera(titulo: string, meta: ObraMeta, extra: [string, string][] = []): Paragraph[] {
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
  const out: Paragraph[] = [
    new Paragraph({
      spacing: { after: 60 },
      children: [run(titulo.toUpperCase(), { bold: true, color: ACENTO, size: T_TINY })],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [run(meta.denominacion || 'Obra sin denominación', { bold: true, size: T_TITULO })],
    }),
  ];
  if (dir) out.push(new Paragraph({ spacing: { after: 60 }, children: [run(dir, { color: GRIS })] }));
  const runs: TextRun[] = pares.flatMap((p, i) => [
    ...(i > 0 ? [run('   ·   ', { color: BORDE, size: T_SMALL })] : []),
    run(`${p[0]} `, { bold: true, size: T_SMALL }),
    run(p[1], { color: GRIS, size: T_SMALL }),
  ]);
  // El cierre de cabecera (regla inferior) va SIEMPRE, haya pares o no.
  out.push(
    new Paragraph({
      spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NEGRO, space: 6 } },
      children: runs,
    }),
  );
  return out;
}

function firma(meta: ObraMeta): Paragraph[] {
  if (!meta.lugarFecha && !meta.redactor) return [];
  const out: Paragraph[] = [];
  if (meta.lugarFecha) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 700 },
        children: [run(meta.lugarFecha, { color: GRIS })],
      }),
    );
  }
  if (meta.redactor) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: meta.lugarFecha ? 800 : 700 },
        children: [run(meta.redactor, { bold: true })],
      }),
    );
  }
  return out;
}

/* ---- Presupuesto y mediciones ---------------------------------------------- */

// Nº·Código · Descripción · Ud. · Cantidad · Precio · Importe = 10546 twips.
const W_PRES = [1100, 5100, 480, 1100, 1100, 1666];

/** Sangría de cabecera de grupo por profundidad (NBSP: Word no la recorta). */
function sangria(depth: number): string {
  return '   '.repeat(Math.max(0, depth - 1));
}

function medLinea(l: MedLineListado): Paragraph {
  const dims = l.dims
    .filter((v) => v !== '' && v != null)
    .map((v) => fmtNum(Number(v)))
    .join(' × ');
  const texto = `· ${l.comment || 'Sin comentario'}${dims ? ` — ${dims}` : ''} = ${fmtNum(l.parcial)}`;
  return new Paragraph({ children: [run(texto, { color: GRIS, size: T_TINY })] });
}

function presupuestoBloques(data: PresupuestoListado): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const c of data.capitulos) {
    const rows: TableRow[] = [
      // Banda de capítulo + cabecera de columnas: tableHeader → se repiten por página.
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: [
          cell(c.code, { width: W_PRES[0]!, bold: true }),
          cell(c.title, { width: 0, span: 4, bold: true }),
          cell(fmtCents(c.total), { width: W_PRES[5]!, right: true, bold: true }),
        ],
      }),
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: ['Nº · Código', 'Descripción y mediciones', 'Ud.', 'Cantidad', 'Precio', 'Importe'].map(
          (h, i) =>
            cell(h, {
              width: W_PRES[i]!,
              right: i >= 3,
              bold: true,
              color: GRIS,
              size: T_TINY,
              fill: BANDA,
            }),
        ),
      }),
    ];
    for (const g of c.grupos) {
      if (g.sub) {
        rows.push(
          new TableRow({
            cantSplit: true,
            children: [
              cell(sangria(g.depth) + g.sub.code, { width: W_PRES[0]!, bold: true, color: GRIS, size: T_SMALL, fill: BANDA }),
              cell(g.sub.title.toUpperCase(), { width: 0, span: 4, bold: true, color: GRIS, size: T_SMALL, fill: BANDA }),
              cell(fmtNum(g.total / 100), { width: W_PRES[5]!, right: true, color: GRIS, size: T_SMALL, fill: BANDA }),
            ],
          }),
        );
      }
      for (const r of g.rows) {
        const desc: Paragraph[] = [paraRuns([run(r.title, { bold: true })])];
        if (r.desc) desc.push(paraRuns([run(r.desc, { color: GRIS, size: T_SMALL })]));
        for (const l of r.med) desc.push(medLinea(l));
        rows.push(
          new TableRow({
            cantSplit: true,
            children: [
              cellPars(
                [paraRuns([run(r.pos)]), paraRuns([run(r.code, { color: GRIS, size: T_TINY })])],
                { width: W_PRES[0]! },
              ),
              cellPars(desc, { width: W_PRES[1]! }),
              cell(r.ud, { width: W_PRES[2]! }),
              cell(fmtNum(r.cantidad), { width: W_PRES[3]!, right: true }),
              cell(fmtNum(r.precio), { width: W_PRES[4]!, right: true }),
              cell(fmtNum(r.importe / 100), { width: W_PRES[5]!, right: true }),
            ],
          }),
        );
      }
    }
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          cell(`Total capítulo ${c.code} · ${c.title}`, { width: 0, span: 5, bold: true, topBorder: true }),
          cell(fmtNum(c.total / 100), { width: W_PRES[5]!, right: true, bold: true, topBorder: true }),
        ],
      }),
    );
    out.push(tabla(W_PRES, rows), vacio(160));
  }
  out.push(
    tabla(W_PRES, [
      new TableRow({
        cantSplit: true,
        children: [
          cell('Presupuesto de Ejecución Material (PEM)', { width: 0, span: 5, bold: true, size: 22, topBorder: true }),
          cell(fmtCents(data.pem), { width: W_PRES[5]!, right: true, bold: true, size: 22, topBorder: true }),
        ],
      }),
    ]),
  );
  return out;
}

/* ---- Resumen de presupuesto ------------------------------------------------ */

const W_RES = [700, 6160, 1300, 2386];

function resumenBloques(data: ResumenListado): (Paragraph | Table)[] {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: ['Capítulo', '', '% PEM', 'Importe'].map((h, i) =>
        cell(h, { width: W_RES[i]!, right: i >= 2, bold: true, color: GRIS, size: T_TINY, fill: BANDA }),
      ),
    }),
    ...data.rows.map(
      (r) =>
        new TableRow({
          cantSplit: true,
          children: [
            cell(r.code, { width: W_RES[0]!, color: GRIS }),
            cell(r.title, { width: W_RES[1]! }),
            cell(`${fmtNum(r.pct, 1)}%`, { width: W_RES[2]!, right: true, color: GRIS, size: T_SMALL }),
            cell(fmtNum(r.importe / 100), { width: W_RES[3]!, right: true }),
          ],
        }),
    ),
  ];
  const linea = (label: string, value: Cents, o: { rate?: number; strong?: boolean; size?: number } = {}) =>
    new TableRow({
      cantSplit: true,
      children: [
        cell(label, { width: 0, span: 2, bold: o.strong, size: o.size, topBorder: o.strong }),
        cell(o.rate != null ? `${fmtNum(o.rate * 100, 1)}%` : '', {
          width: W_RES[2]!,
          right: true,
          color: GRIS,
          size: T_SMALL,
          topBorder: o.strong,
        }),
        cell(fmtCents(value), { width: W_RES[3]!, right: true, bold: o.strong, size: o.size, topBorder: o.strong }),
      ],
    });
  rows.push(
    linea('Presupuesto de Ejecución Material (PEM)', data.pem, { strong: true }),
    linea('Gastos generales', data.gg, { rate: data.rates.gg }),
    linea('Beneficio industrial', data.bi, { rate: data.rates.bi }),
    linea('Presupuesto de Ejecución por Contrata (s/ IVA)', data.pec, { strong: true }),
    linea('IVA', data.iva, { rate: data.rates.iva }),
    linea('Presupuesto base de licitación', data.total, { strong: true, size: 26 }),
  );
  return [tabla(W_RES, rows)];
}

/* ---- Certificación ----------------------------------------------------------- */

// 9 columnas (como el PDF de cert) = 10546 twips.
const W_CERT = [1000, 2900, 420, 880, 880, 880, 1180, 1180, 1226];

function certBloques(data: CertListado): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const c of data.capitulos) {
    const rows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: [
          cell(c.code, { width: W_CERT[0]!, bold: true, size: T_SMALL }),
          cell(c.title, { width: 0, span: 7, bold: true, size: T_SMALL }),
          cell(fmtNum(c.aOrigen / 100), { width: W_CERT[8]!, right: true, bold: true, size: T_SMALL }),
        ],
      }),
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: ['Nº · Código', 'Descripción', 'Ud.', 'Ofertada', 'Ejecutada', 'Precio', 'A origen', 'Anterior', 'Esta cert.'].map(
          (h, i) =>
            cell(h, { width: W_CERT[i]!, right: i >= 3, bold: true, color: GRIS, size: T_TINY, fill: BANDA }),
        ),
      }),
    ];
    for (const g of c.grupos) {
      if (g.sub) {
        rows.push(
          new TableRow({
            cantSplit: true,
            children: [
              cell(sangria(g.depth) + g.sub.code, { width: W_CERT[0]!, bold: true, color: GRIS, size: T_TINY, fill: BANDA }),
              cell(g.sub.title.toUpperCase(), { width: 0, span: 8, bold: true, color: GRIS, size: T_TINY, fill: BANDA }),
            ],
          }),
        );
      }
      for (const r of g.rows) {
        rows.push(
          new TableRow({
            cantSplit: true,
            children: [
              cellPars(
                [
                  paraRuns([run(r.pos, { size: T_SMALL })]),
                  paraRuns([run(r.code, { color: GRIS, size: T_TINY })]),
                ],
                { width: W_CERT[0]! },
              ),
              cell(r.title, { width: W_CERT[1]!, size: T_SMALL }),
              cell(r.ud, { width: W_CERT[2]!, size: T_SMALL }),
              cell(fmtNum(r.ofertada), { width: W_CERT[3]!, right: true, size: T_SMALL }),
              cell(fmtNum(r.ejecutada), { width: W_CERT[4]!, right: true, size: T_SMALL }),
              cell(fmtNum(r.precio), { width: W_CERT[5]!, right: true, size: T_SMALL }),
              cell(fmtNum(r.aOrigen / 100), { width: W_CERT[6]!, right: true, size: T_SMALL }),
              cell(fmtNum(r.anterior / 100), { width: W_CERT[7]!, right: true, size: T_SMALL }),
              cell(fmtNum(r.estaCert / 100), { width: W_CERT[8]!, right: true, size: T_SMALL }),
            ],
          }),
        );
      }
    }
    for (const e of c.extras) {
      rows.push(
        new TableRow({
          cantSplit: true,
          children: [
            cellPars(
              [
                paraRuns([run(e.pos, { size: T_SMALL })]),
                paraRuns([run('P.C.', { bold: true, color: WARN, size: T_TINY })]),
              ],
              { width: W_CERT[0]! },
            ),
            cell(e.title || 'Precio contradictorio', { width: W_CERT[1]!, size: T_SMALL }),
            cell(e.ud, { width: W_CERT[2]!, size: T_SMALL }),
            cell('—', { width: W_CERT[3]!, right: true, size: T_SMALL, color: GRIS }),
            cell(fmtNum(e.cantidad), { width: W_CERT[4]!, right: true, size: T_SMALL }),
            cell(fmtNum(e.precio), { width: W_CERT[5]!, right: true, size: T_SMALL }),
            cell(fmtNum(e.aOrigen / 100), { width: W_CERT[6]!, right: true, size: T_SMALL }),
            cell(fmtNum(e.anterior / 100), { width: W_CERT[7]!, right: true, size: T_SMALL }),
            cell(fmtNum(e.estaCert / 100), { width: W_CERT[8]!, right: true, size: T_SMALL }),
          ],
        }),
      );
    }
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          cell(`Total capítulo ${c.code}`, { width: 0, span: 6, bold: true, size: T_SMALL, topBorder: true }),
          cell(fmtNum(c.aOrigen / 100), { width: W_CERT[6]!, right: true, bold: true, size: T_SMALL, topBorder: true }),
          cell(fmtNum(c.anterior / 100), { width: W_CERT[7]!, right: true, bold: true, size: T_SMALL, topBorder: true }),
          cell(fmtNum(c.estaCert / 100), { width: W_CERT[8]!, right: true, bold: true, size: T_SMALL, topBorder: true }),
        ],
      }),
    );
    out.push(tabla(W_CERT, rows), vacio(160));
  }
  // Resumen económico hasta el líquido (alineado a la derecha, como el PDF).
  const t = data.totals;
  const fila = (label: string, value: Cents, strong = false, size?: number) =>
    new TableRow({
      cantSplit: true,
      children: [
        cell(label, { width: 2800, bold: strong, size, topBorder: strong }),
        cell(fmtCents(value), { width: 1600, right: true, bold: strong, size, topBorder: strong }),
      ],
    });
  out.push(
    new Table({
      alignment: AlignmentType.RIGHT,
      width: { size: 4400, type: WidthType.DXA },
      columnWidths: [2800, 1600],
      margins: { top: 40, bottom: 40, left: 60, right: 60 },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: BORDE },
      },
      rows: [
        fila('Ejecución material a origen', t.certPEM, true),
        fila('Gastos generales y B.I.', t.ggbiOrigen),
        fila('Ejecución por contrata a origen', t.pecOrigen),
        fila('Certificado anterior', -t.pecPrev),
        fila('Esta certificación', t.pecEsta, true),
        fila(`Retención (${fmtNum(data.retencion * 100, 1)}%)`, -t.retencion),
        ...t.ajustesRows.map((a) => fila(a.label || 'Ajuste', a.signo * a.importe)),
        fila('Base imponible', t.base),
        fila('IVA', t.iva),
        fila('Líquido a abonar', t.liquido, true, 24),
      ],
    }),
  );
  return out;
}

/* ---- documento + API -------------------------------------------------------- */

function makeDoc(children: (Paragraph | Table)[]): Document {
  return new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: T_BODY, color: NEGRO } } } },
    sections: [{ properties: { page: { size: PAGE, margin: MARGIN } }, children }],
  });
}

/** Estado de dominio que necesita el render (estructural, para tests). */
export interface DocxState {
  chapters: Chapter[];
  partidas: PartidasMap;
  recursos: Banco;
  certs: Cert[];
  rates: Rates;
  obra: Obra;
}

export interface DocxResult {
  blob: Blob;
  fileName: string;
}

/** Documento Word del listado pedido (`null` si la cert no existe). */
export async function docxFor(target: PrintTarget, s: DocxState): Promise<DocxResult | null> {
  const meta = obraMeta(s.obra);
  let titulo: string;
  let bloques: (Paragraph | Table)[];
  let extra: [string, string][] = [];
  if (target.kind === 'presupuesto') {
    titulo = 'Presupuesto y mediciones';
    bloques = presupuestoBloques(buildPresupuestoListado(s.chapters, s.partidas, s.rates.coefK));
  } else if (target.kind === 'resumen') {
    titulo = 'Resumen de presupuesto';
    bloques = resumenBloques(buildResumen(s.chapters, s.partidas, s.rates));
  } else {
    const cl = buildCertListado(s.chapters, s.partidas, s.certs, target.index, s.rates);
    if (!cl) return null;
    titulo = `Certificación de obra nº ${cl.num}`;
    extra = (
      [
        ['Periodo', cl.period],
        ['Ejecución global', `${fmtNum(cl.totals.pctGlobal, 1)}%`],
        ['Precios congelados', fechaCorta(cl.snapshotAt)],
      ] as [string, string][]
    ).filter((p) => Boolean(p[1]));
    bloques = certBloques(cl);
  }
  const doc = makeDoc([...cabecera(titulo, meta, extra), ...bloques, ...firma(meta)]);
  return {
    blob: await Packer.toBlob(doc),
    fileName: docFileName(titulo.replace('Certificación de obra', 'Certificación'), meta.denominacion, 'docx'),
  };
}

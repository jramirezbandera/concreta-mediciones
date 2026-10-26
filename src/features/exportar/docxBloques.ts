/* ===========================================================================
   features/exportar/docxBloques — pinta en Word un documento de
   `core/documento` (secciones, párrafos, listas y tablas) con las piezas de
   los listados (`docxRender`: página A4, cabecera de obra, tablas con
   cabecera repetida y filas que no parten, firma). Añade estilos de título de
   Word (Título 1) para que el índice de la memoria recoja cada apartado. Lo
   usan el estudio de residuos (`docxRcd`) y el plan de control de calidad
   (`docxPcc`). Solo se alcanza por import dinámico (chunk aparte).
   =========================================================================== */
import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, Table, TableRow, TextRun } from 'docx';
import type { Documento, Parrafo, TablaDoc, Trozo } from '../../core/documento/tipos';
import type { ObraMeta } from '../../core/listado';
import { BANDA, BORDE, cabecera, cell, firma, GRIS, MARGIN, NEGRO, PAGE, run, T_BODY, T_SMALL, T_TINY, tabla, WARN } from './docxRender';

const trozo = (t: Trozo, size = T_BODY): TextRun =>
  t.pendiente ? run(t.texto, { bold: true, color: WARN, size }) : run(t.texto, { bold: t.negrita, size });

const parrafo = (p: Parrafo, extra: { bullet?: boolean } = {}): Paragraph =>
  new Paragraph({
    spacing: { after: 100 },
    ...(extra.bullet ? { bullet: { level: 0 } } : {}),
    children: p.map((t) => trozo(t)),
  });

function celdaTexto(x: string | Trozo): Trozo {
  return typeof x === 'string' ? { texto: x } : x;
}

function tablaDoc(t: TablaDoc): Table {
  const anchos = t.columnas.map((c) => c.ancho);
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: t.columnas.map((c) => cell(c.titulo, { width: c.ancho, right: c.derecha, bold: true, color: GRIS, size: T_TINY, fill: BANDA })),
    }),
    ...t.filas.map(
      (f) =>
        new TableRow({
          cantSplit: true,
          children: f.map((x, i) => {
            const tz = celdaTexto(x);
            return cell(tz.texto, {
              width: anchos[i]!,
              right: t.columnas[i]?.derecha,
              size: T_SMALL,
              bold: tz.pendiente || tz.negrita,
              color: tz.pendiente ? WARN : undefined,
            });
          }),
        }),
    ),
  ];
  if (t.pie)
    rows.push(
      new TableRow({
        cantSplit: true,
        children: t.pie.map((x, i) => cell(celdaTexto(x).texto, { width: anchos[i]!, right: t.columnas[i]?.derecha, bold: true, size: T_SMALL, topBorder: true })),
      }),
    );
  return tabla(anchos, rows);
}

/** Bloques Word del documento (sin cabecera ni firma): para el render y los tests. */
export function bloques(doc: Pick<Documento, 'secciones'>): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const s of doc.secciones) {
    out.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 280, after: s.cita ? 40 : 120 },
        children: [new TextRun({ text: s.titulo })],
      }),
    );
    if (s.cita) out.push(new Paragraph({ spacing: { after: 120 }, children: [run(s.cita, { color: GRIS, size: T_TINY })] }));
    for (const b of s.bloques) {
      if (b.kind === 'p') out.push(parrafo(b.p));
      else if (b.kind === 'lista') for (const i of b.items) out.push(parrafo(i, { bullet: true }));
      else {
        out.push(tablaDoc(b.t));
        out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      }
    }
  }
  return out;
}

/** El documento entero en .docx: cabecera de obra, bloques y firma del técnico (o la línea de pendiente). */
export async function documentoDocx(doc: Documento, meta: ObraMeta, fecha: string, sinFirma: string): Promise<Blob> {
  const pie = doc.firma
    ? firma({ firmantes: [{ rol: 'El técnico redactor', nombre: doc.firma.nombre, sub: doc.firma.sub || undefined }], lugar: meta.localidad, fecha })
    : [
        new Paragraph({
          spacing: { before: 600 },
          alignment: AlignmentType.RIGHT,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDE, space: 6 } },
          children: [run(sinFirma, { bold: true, color: WARN })],
        }),
      ];
  const document = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: T_BODY, color: NEGRO } },
        heading1: { run: { font: 'Calibri', size: 24, bold: true, color: NEGRO }, paragraph: { spacing: { before: 280, after: 120 }, keepNext: true } },
      },
    },
    sections: [{ properties: { page: { size: PAGE, margin: MARGIN } }, children: [...cabecera(doc.titulo, meta), ...bloques(doc), ...pie] }],
  });
  return Packer.toBlob(document);
}

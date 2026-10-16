/* ===========================================================================
   features/exportar/docxRcd — el estudio de gestión de residuos en Word.

   Pinta `core/rcd/documento` (el texto ya decidido) con las mismas piezas que
   los listados (`docxRender`: página A4, cabecera de obra, tablas con cabecera
   repetida y filas que no parten, firma). Añade estilos de título de Word
   (Título 1) para que el índice de la memoria recoja cada apartado. Solo se
   alcanza por import dinámico, como `docxRender` (chunk aparte).
   =========================================================================== */
import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, Table, TableRow, TextRun } from 'docx';
import { obraMeta } from '../../core/listado';
import { calcularEstudioRcd } from '../../core/rcd/calculo';
import { documentoRcd, type DocumentoRcd, type Parrafo, type TablaDoc, type Trozo } from '../../core/rcd/documento';
import type { EstudioRcdDatos } from '../../core/rcd/tipos';
import type { Chapter, Obra, PartidasMap, Rates } from '../../core/types';
import { BANDA, BORDE, cabecera, cell, firma, GRIS, MARGIN, NEGRO, PAGE, run, T_BODY, T_SMALL, T_TINY, tabla, WARN } from './docxRender';
import { docFileName } from './fileName';

export interface DocxRcdState {
  chapters: Chapter[];
  partidas: PartidasMap;
  rates: Rates;
  obra: Obra;
  estudioRcd?: EstudioRcdDatos;
}

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
export function bloquesRcd(doc: DocumentoRcd): (Paragraph | Table)[] {
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

export interface DocxResult {
  blob: Blob;
  fileName: string;
}

/** El estudio de residuos de la obra en Word (`null` si no tiene estudio). */
export async function docxRcdFor(s: DocxRcdState, hoy: string): Promise<DocxResult | null> {
  if (!s.estudioRcd) return null;
  const r = calcularEstudioRcd({ chapters: s.chapters, partidas: s.partidas, rates: s.rates, obra: s.obra, estudio: s.estudioRcd, hoy });
  const meta = obraMeta(s.obra);
  const doc = documentoRcd(r, s.estudioRcd, {
    denominacion: meta.denominacion,
    localidad: meta.localidad,
    promotor: meta.promotor,
    constructora: meta.constructora,
  });
  const pie = doc.firma
    ? firma({ firmantes: [{ rol: 'El técnico redactor', nombre: doc.firma.nombre, sub: doc.firma.sub || undefined }], lugar: meta.localidad, fecha: r.fecha })
    : [
        new Paragraph({
          spacing: { before: 600 },
          alignment: AlignmentType.RIGHT,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDE, space: 6 } },
          children: [run('Pendiente: técnico que redacta y firma el estudio.', { bold: true, color: WARN })],
        }),
      ];
  const document = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: T_BODY, color: NEGRO } },
        heading1: { run: { font: 'Calibri', size: 24, bold: true, color: NEGRO }, paragraph: { spacing: { before: 280, after: 120 }, keepNext: true } },
      },
    },
    sections: [{ properties: { page: { size: PAGE, margin: MARGIN } }, children: [...cabecera(doc.titulo, meta), ...bloquesRcd(doc), ...pie] }],
  });
  return { blob: await Packer.toBlob(document), fileName: docFileName('Estudio de residuos', meta.denominacion, 'docx') };
}

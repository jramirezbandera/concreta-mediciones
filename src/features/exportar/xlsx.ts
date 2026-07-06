/* ===========================================================================
   features/exportar/xlsx — exportador XLSX (F7.2).
   La librería (`write-excel-file`, MIT, ~fflate como única dep; elegida frente
   a exceljs: 1,8 MB vs 21,8 MB unpacked y API browser-first) se carga por
   IMPORT DINÁMICO: fuera del bundle inicial (eng-review F7).
   =========================================================================== */
import type { Feature } from 'write-excel-file/browser';
import {
  buildCertListado,
  buildPresupuestoListado,
  buildResumen,
  firmaFor,
  obraMeta,
} from '../../core/listado';
import { useObraStore } from '../../store';
import type { PrintTarget } from '../print';
import {
  buildCertXlsx,
  buildPresupuestoXlsx,
  buildResumenXlsx,
  type XlsxDoc,
} from './xlsxBuilders';

/** Filas XLSX del listado pedido, desde el estado actual de la obra. */
export function xlsxDocFor(target: PrintTarget): XlsxDoc | null {
  const s = useObraStore.getState();
  const meta = obraMeta(s.obra);
  if (target.kind === 'presupuesto') {
    return buildPresupuestoXlsx(
      buildPresupuestoListado(s.chapters, s.partidas, s.rates.coefK),
      meta,
      firmaFor('presupuesto', s.obra, undefined, new Date().toISOString()),
    );
  }
  if (target.kind === 'resumen') {
    return buildResumenXlsx(
      buildResumen(s.chapters, s.partidas, s.rates),
      meta,
      firmaFor('resumen', s.obra, undefined, new Date().toISOString()),
    );
  }
  const cl = buildCertListado(s.chapters, s.partidas, s.certs, target.index, s.rates, s.bajas);
  return cl && buildCertXlsx(cl, meta, firmaFor('cert', s.obra, s.certs[target.index]));
}

/**
 * Configuración de IMPRESIÓN de la hoja (F7.2b): A4, orientación por documento,
 * encaje a 1 página de ANCHO (alto libre), tabla centrada, márgenes de ~1 cm y
 * pie «Página N de M» — el archivo sale listo para imprimir sin tocar nada.
 * La librería no expone `pageSetup`: se inyecta el XML del worksheet por su
 * mecanismo de `features` (plugin de transformación, sin reabrir el zip).
 * Orden de elementos del esquema: `sheetPr` abre el worksheet (habilita el
 * modo «ajustar a página»); `printOptions → pageMargins → pageSetup →
 * headerFooter` van tras `sheetData`/`mergeCells`, donde inserta el plugin.
 */
export function printSetupFeature(
  orientation: XlsxDoc['orientation'],
): Feature<File | Blob | ArrayBuffer> {
  return {
    files: {
      transform: {
        'xl/worksheets/sheet{id}.xml': {
          transform: (content) =>
            content.replace(
              /(<worksheet[^>]*>)/,
              '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>',
            ),
          insert: () =>
            '<printOptions horizontalCentered="1"/>' +
            '<pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
            `<pageSetup paperSize="9" orientation="${orientation}" fitToWidth="1" fitToHeight="0"/>` +
            // «&P de &N» = página N de M (los «&» van escapados en el XML).
            '<headerFooter><oddFooter>&amp;C&amp;8P&#225;gina &amp;P de &amp;N</oddFooter></headerFooter>',
        },
      },
    },
  };
}

/** Genera y DESCARGA el .xlsx del listado pedido (celdas numéricas y fórmulas
 *  vivas, F7.2/F7.2b) ya configurado para imprimir. */
export async function exportXlsx(target: PrintTarget): Promise<void> {
  const doc = xlsxDocFor(target);
  if (!doc) return;
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  await writeXlsxFile(
    doc.rows,
    { sheet: doc.sheet, columns: doc.columns },
    { features: [printSetupFeature(doc.orientation)] },
  ).toFile(doc.fileName);
}

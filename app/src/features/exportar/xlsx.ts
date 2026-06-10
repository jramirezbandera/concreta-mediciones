/* ===========================================================================
   features/exportar/xlsx — exportador XLSX (F7.2).
   La librería (`write-excel-file`, MIT, ~fflate como única dep; elegida frente
   a exceljs: 1,8 MB vs 21,8 MB unpacked y API browser-first) se carga por
   IMPORT DINÁMICO: fuera del bundle inicial (eng-review F7).
   =========================================================================== */
import {
  buildCertListado,
  buildPresupuestoListado,
  buildResumen,
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
    );
  }
  if (target.kind === 'resumen') {
    return buildResumenXlsx(buildResumen(s.chapters, s.partidas, s.rates), meta);
  }
  const cl = buildCertListado(s.chapters, s.partidas, s.certs, target.index, s.rates);
  return cl && buildCertXlsx(cl, meta);
}

/** Genera y DESCARGA el .xlsx del listado pedido (celdas numéricas, F7.2). */
export async function exportXlsx(target: PrintTarget): Promise<void> {
  const doc = xlsxDocFor(target);
  if (!doc) return;
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  await writeXlsxFile(doc.rows, { sheet: doc.sheet, columns: doc.columns }).toFile(doc.fileName);
}

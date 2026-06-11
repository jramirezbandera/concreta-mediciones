/* ===========================================================================
   features/exportar/bc3 — exportador BC3/FIEBDC-3 (F7.4).
   El writer (`core/bc3export`) es puro y diminuto (sin librerías): no necesita
   import dinámico como XLSX/DOCX. Exporta SIEMPRE la obra completa (el árbol
   presupuesto+mediciones); las certificaciones a BC3 quedan en TODOS.md T-12.
   =========================================================================== */
import { obraToBc3 } from '../../core/bc3export';
import { useObraStore } from '../../store';
import { downloadBlob } from './download';
import { docFileName } from './fileName';

/** Bytes (windows-1252) y nombre del .bc3 de la obra, desde el estado actual. */
export function bc3FileFor(): { bytes: Uint8Array; fileName: string } {
  const s = useObraStore.getState();
  return {
    bytes: obraToBc3({
      chapters: s.chapters,
      partidas: s.partidas,
      recursos: s.recursos,
      rates: s.rates,
      obra: s.obra,
    }),
    fileName: docFileName('Obra completa', s.obra.denominacion, 'bc3'),
  };
}

/** Genera y DESCARGA el .bc3 (abre en Presto, Arquímedes y otros FIEBDC-3). */
export function exportBc3(): void {
  const { bytes, fileName } = bc3FileFor();
  downloadBlob(new Blob([bytes as BlobPart], { type: 'application/octet-stream' }), fileName);
}

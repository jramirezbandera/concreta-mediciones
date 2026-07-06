import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportXlsx, printSetupFeature, xlsxDocFor } from './xlsx';
import { useObraStore } from '../../store';

const { toFile, writeXlsxFile } = vi.hoisted(() => {
  const toFile = vi.fn(async () => {});
  return { toFile, writeXlsxFile: vi.fn(() => ({ toFile, toBlob: vi.fn() })) };
});
vi.mock('write-excel-file/browser', () => ({ default: writeXlsxFile }));

beforeEach(() => {
  useObraStore.getState().reset();
  vi.clearAllMocks();
});

describe('xlsxDocFor (estado → filas, F7.2)', () => {
  it('construye los 3 docs desde el estado de la obra', () => {
    expect(xlsxDocFor({ kind: 'presupuesto' })?.sheet).toBe('Presupuesto');
    expect(xlsxDocFor({ kind: 'resumen' })?.sheet).toBe('Resumen');
    expect(xlsxDocFor({ kind: 'cert', index: 2 })?.sheet).toBe('Certificación 3');
  });

  it('cert con índice inválido → null (no descarga)', () => {
    expect(xlsxDocFor({ kind: 'cert', index: 99 })).toBeNull();
  });

  it('el nombre de archivo lleva la denominación de la obra', () => {
    expect(xlsxDocFor({ kind: 'resumen' })?.fileName).toBe(
      'Resumen de presupuesto - Reforma vivienda C Mayor 14.xlsx',
    );
  });

  it('presupuesto/resumen imprimen en vertical; la cert (11 columnas), apaisada', () => {
    expect(xlsxDocFor({ kind: 'presupuesto' })?.orientation).toBe('portrait');
    expect(xlsxDocFor({ kind: 'resumen' })?.orientation).toBe('portrait');
    expect(xlsxDocFor({ kind: 'cert', index: 0 })?.orientation).toBe('landscape');
  });
});

describe('printSetupFeature (configuración de impresión, F7.2b)', () => {
  const feature = printSetupFeature('landscape');
  const worksheet = feature.files!.transform!['xl/worksheets/sheet{id}.xml']!;

  it('inyecta A4 + orientación + encaje a 1 página de ancho + pie con numeración', () => {
    const xml = worksheet.insert!(
      {} as never,
      { sheetIndex: 0, sheetId: '1' },
    )!;
    expect(xml).toContain('<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>');
    expect(xml).toContain('<pageMargins');
    expect(xml).toContain('<oddFooter>&amp;C&amp;8P&#225;gina &amp;P de &amp;N</oddFooter>');
  });

  it('habilita «ajustar a página» con un sheetPr al abrir el worksheet', () => {
    const out = worksheet.transform!(
      '<worksheet xmlns="x"><sheetData/></worksheet>',
      {} as never,
      { sheetIndex: 0, sheetId: '1' },
    );
    expect(out).toBe(
      '<worksheet xmlns="x"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetData/></worksheet>',
    );
  });
});

describe('exportXlsx (import dinámico + descarga)', () => {
  it('pasa filas/hoja/columnas + el feature de impresión y descarga con el nombre del doc', async () => {
    await exportXlsx({ kind: 'presupuesto' });
    expect(writeXlsxFile).toHaveBeenCalledTimes(1);
    const [rows, opts, extras] = writeXlsxFile.mock.calls[0] as unknown as [
      unknown[],
      { sheet: string; columns: unknown[] },
      { features: unknown[] },
    ];
    expect(rows.length).toBeGreaterThan(10);
    expect(opts.sheet).toBe('Presupuesto');
    expect(opts.columns).toHaveLength(7);
    expect(extras.features).toHaveLength(1);
    expect(toFile).toHaveBeenCalledWith('Presupuesto y mediciones - Reforma vivienda C Mayor 14.xlsx');
  });

  it('con target inválido no toca la librería', async () => {
    await exportXlsx({ kind: 'cert', index: 99 });
    expect(writeXlsxFile).not.toHaveBeenCalled();
  });
});

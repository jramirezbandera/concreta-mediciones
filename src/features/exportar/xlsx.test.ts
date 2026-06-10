import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportXlsx, xlsxDocFor } from './xlsx';
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
});

describe('exportXlsx (import dinámico + descarga)', () => {
  it('pasa filas/hoja/columnas a la librería y descarga con el nombre del doc', async () => {
    await exportXlsx({ kind: 'presupuesto' });
    expect(writeXlsxFile).toHaveBeenCalledTimes(1);
    const [rows, opts] = writeXlsxFile.mock.calls[0] as unknown as [
      unknown[],
      { sheet: string; columns: unknown[] },
    ];
    expect(rows.length).toBeGreaterThan(10);
    expect(opts.sheet).toBe('Presupuesto');
    expect(opts.columns).toHaveLength(7);
    expect(toFile).toHaveBeenCalledWith('Presupuesto y mediciones - Reforma vivienda C Mayor 14.xlsx');
  });

  it('con target inválido no toca la librería', async () => {
    await exportXlsx({ kind: 'cert', index: 99 });
    expect(writeXlsxFile).not.toHaveBeenCalled();
  });
});
